#!/usr/bin/env node
import { Command, type OptionValues } from "commander";
import { CLI_NAME, CLI_VERSION } from "./identity.js";
import { listAdapters } from "./adapters/registry.js";
import { applyPreparedInit, formatInitResult, InitCommandError, prepareInit } from "./commands/init.js";

const program = new Command();

program
  .name(CLI_NAME)
  .description("Install and maintain AI coding workflows safely across projects.")
  .version(CLI_VERSION);

program
  .command("adapters")
  .description("List the AI coding tools supported by Pitcrew.")
  .action(() => {
    const adapters = listAdapters();
    console.log("Supported AI coding tools:\n");
    for (const adapter of adapters) {
      console.log(`  ${adapter.metadata.displayName} (${adapter.id})`);
      console.log(`    ${adapter.metadata.description}`);
    }
  });

program
  .command("init")
  .description("Preview or install the shared core workflow in an existing project.")
  .argument("[target]", "Existing project directory", ".")
  .option("--profile <profile>", "Workflow profile (minimal, standard, strict)", "standard")
  .option("--adapter <adapter>", "Selected adapter ID; repeat to select multiple adapters", collect, [])
  .option("--agent <adapters>", "Comma-separated adapter IDs (for example: claude,codex,opencode)", collect, [])
  .option("--project-name <name>", "Project name used in generated workflow documents")
  .option("--summary <text>", "Short project summary used in generated workflow documents")
  .option("--dry-run", "Preview only; never modify the target directory")
  .option("--approve <path>", "Explicitly approve one exact file destination; repeat for every file", collect, [])
  .option("--json", "Print machine-readable output")
  .action(async (target: string, options: OptionValues) => {
    try {
      if (options.dryRun && options.approve.length > 0) {
        throw new InitCommandError("INVALID_INPUT", "--dry-run cannot be combined with --approve.");
      }
      const prepared = await prepareInit({
        targetPath: target,
        profile: options.profile,
        adapters: [
          ...(options.adapter as string[]),
          ...(options.agent as string[]).flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean)),
        ],
        projectName: options.projectName,
        projectSummary: options.summary,
      });

      if (options.dryRun || options.approve.length === 0) {
        if (options.json) {
          console.log(formatInitResult(prepared, true));
        } else {
          console.log(formatInitResult(prepared));
          if (!options.dryRun) console.log("\nPreview only. No files were changed. Supply --approve for every listed path to apply this plan.");
        }
        process.exitCode = prepared.conflicts.length > 0 ? 2 : 0;
        return;
      }

      const result = await applyPreparedInit(prepared, options.approve as string[]);
      if (options.json) {
        console.log(JSON.stringify({
          detection: prepared.detection,
          preview: prepared.preview,
          transaction: result.transaction,
          manifestPath: result.manifestPath,
          preservedConflicts: result.conflicts.map((item) => ({ destination: item.destination, kind: item.kind, reason: item.reason })),
        }, null, 2));
      } else {
        console.log(formatInitResult(prepared));
        console.log("\nInstallation committed.");
        console.log(`  Transaction: ${result.transaction.transactionId}`);
        console.log(`  Manifest: ${result.manifestPath}`);
        const changedFiles = result.transaction.applied.filter((item) => item.kind === "createFile" || item.kind === "updateFile");
        console.log(`  Files written: ${changedFiles.length}`);
        for (const file of changedFiles) console.log(`    ${file.destination}`);
        if (result.conflicts.length) {
          console.log("\nExisting content was preserved at these paths:");
          for (const conflict of result.conflicts) console.log(`  ${conflict.destination}: ${conflict.reason ?? conflict.kind}`);
        }
      }
      process.exitCode = result.conflicts.length > 0 ? 2 : 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      if (options.json) console.error(JSON.stringify({ error: message, code: error instanceof InitCommandError ? error.code : "OPERATIONAL_FAILURE" }));
      else console.error(`pitcrew init: ${message}`);
      const nodeCode = error instanceof Error && "code" in error ? String(error.code) : "";
      const expectedOperational = error instanceof InitCommandError ||
        (error instanceof Error && ["TargetInspectionError", "ManifestStorageError", "InstallTransactionError", "SafeFileReadError"].includes(error.name)) ||
        ["EACCES", "EPERM", "ENOENT", "ENOTDIR", "EEXIST"].includes(nodeCode);
      process.exitCode = error instanceof InitCommandError && error.code === "INVALID_INPUT" ? 3
        : error instanceof InitCommandError && (error.code === "APPROVAL_MISMATCH" || error.code === "NO_INSTALLABLE_FILES") ? 2
          : expectedOperational ? 1 : 4;
    }
  });

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

program.parse();
