#!/usr/bin/env node
import { Command } from "commander";
import { CLI_NAME } from "./identity.js";
import { listAdapters } from "./adapters/registry.js";

const program = new Command();

program
  .name(CLI_NAME)
  .description(
    "Install and maintain AI coding workflows safely across projects.",
  )
  .version("0.1.0");

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

program.parse();
