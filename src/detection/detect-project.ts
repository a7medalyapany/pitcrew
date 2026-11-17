import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import type {
  DetectionConfidence,
  DetectionRecord,
  DetectProjectOptions,
  NestedManifest,
  ProjectDetectionReport,
} from "./types.js";

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_DIRECTORY_ENTRIES = 2048;
const MAX_MANIFESTS = 256;
const DEFAULT_NESTED_DIRECTORY_LIMIT = 64;
const MAX_NESTED_DIRECTORY_LIMIT = 128;
const IGNORED_DIRECTORIES = new Set([
  ".git", ".hg", ".svn", ".next", ".nuxt", ".output", ".turbo", ".vercel",
  ".cache", ".yarn", ".pnpm-store", ".venv", "venv", "env", "node_modules",
  "vendor", "dist", "build", "coverage", "target", "Pods", "DerivedData",
]);

const MANIFESTS: ReadonlyArray<{ name: string; ecosystem: string }> = [
  { name: "package.json", ecosystem: "javascript" },
  { name: "tsconfig.json", ecosystem: "javascript" },
  { name: "pnpm-lock.yaml", ecosystem: "javascript" },
  { name: "yarn.lock", ecosystem: "javascript" },
  { name: "package-lock.json", ecosystem: "javascript" },
  { name: "bun.lock", ecosystem: "javascript" },
  { name: "bun.lockb", ecosystem: "javascript" },
  { name: "go.mod", ecosystem: "go" },
  { name: "go.work", ecosystem: "go" },
  { name: "pyproject.toml", ecosystem: "python" },
  { name: "requirements.txt", ecosystem: "python" },
  { name: "Pipfile", ecosystem: "python" },
  { name: "uv.lock", ecosystem: "python" },
  { name: "poetry.lock", ecosystem: "python" },
  { name: "Cargo.toml", ecosystem: "rust" },
  { name: "Cargo.lock", ecosystem: "rust" },
  { name: "pom.xml", ecosystem: "java-kotlin" },
  { name: "build.gradle", ecosystem: "java-kotlin" },
  { name: "build.gradle.kts", ecosystem: "java-kotlin" },
  { name: "settings.gradle", ecosystem: "java-kotlin" },
  { name: "settings.gradle.kts", ecosystem: "java-kotlin" },
  { name: "global.json", ecosystem: "dotnet" },
  { name: "*.sln", ecosystem: "dotnet" },
  { name: "*.csproj", ecosystem: "dotnet" },
  { name: "*.sln", ecosystem: "dotnet" },
  { name: "*.csproj", ecosystem: "dotnet" },
  { name: "Gemfile", ecosystem: "ruby" },
  { name: ".ruby-version", ecosystem: "ruby" },
  { name: "composer.json", ecosystem: "php" },
  { name: "mix.exs", ecosystem: "elixir" },
  { name: "pubspec.yaml", ecosystem: "dart" },
  { name: "Package.swift", ecosystem: "swift" },
  { name: "CMakeLists.txt", ecosystem: "c-cpp" },
  { name: "meson.build", ecosystem: "c-cpp" },
  { name: "Makefile", ecosystem: "c-cpp" },
];

const FRAMEWORK_CONFIGS: ReadonlyArray<{ name: string; framework: string }> = [
  { name: "next.config.js", framework: "Next.js" }, { name: "next.config.mjs", framework: "Next.js" },
  { name: "next.config.ts", framework: "Next.js" }, { name: "vite.config.js", framework: "Vite" },
  { name: "vite.config.ts", framework: "Vite" }, { name: "vite.config.mjs", framework: "Vite" },
  { name: "angular.json", framework: "Angular" }, { name: "nuxt.config.ts", framework: "Nuxt" },
  { name: "nuxt.config.js", framework: "Nuxt" }, { name: "astro.config.mjs", framework: "Astro" },
  { name: "astro.config.ts", framework: "Astro" }, { name: "svelte.config.js", framework: "Svelte" },
  { name: "vue.config.js", framework: "Vue" },
];

const AGENT_CONFIGS: ReadonlyArray<{ path: string; label: string }> = [
  { path: "AGENTS.md", label: "AGENTS.md instructions" },
  { path: "CLAUDE.md", label: "Claude Code instructions" },
  { path: "AI_WORKFLOW.md", label: "Generic AI workflow instructions" },
  { path: ".claude/settings.json", label: "Claude Code settings" },
  { path: ".claude/commands", label: "Claude Code commands" },
  { path: ".agents/skills", label: "Shared agent skills" },
  { path: ".codex/config.toml", label: "Codex configuration" },
  { path: "opencode.json", label: "OpenCode configuration" },
  { path: ".opencode", label: "OpenCode configuration directory" },
  { path: ".cursor/rules", label: "Cursor rules" },
  { path: ".github/copilot-instructions.md", label: "GitHub Copilot instructions" },
  { path: ".windsurfrules", label: "Windsurf rules" },
  { path: ".aider.conf.yml", label: "Aider configuration" },
];

const CONTENT_MANIFEST_NAMES = new Set([
  "package.json", "go.mod", "go.work", "pyproject.toml", "requirements.txt", "Pipfile",
  "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "composer.json",
]);

const SKIP_FILE_NAMES = new Set([
  ".env", ".env.local", ".npmrc", ".pypirc", "auth.json", "credentials.json",
  "secrets.json", "id_rsa", "id_ed25519",
]);

/**
 * Detect project characteristics from an explicit root and a bounded, shallow
 * set of manifests. This function is advisory and read-only: it never executes
 * project commands, follows symlinks, or returns manifest/config contents.
 */
export async function detectProject(
  rootPath: string,
  options: DetectProjectOptions = {},
): Promise<ProjectDetectionReport> {
  if (typeof rootPath !== "string" || rootPath.length === 0 || rootPath.includes("\0")) {
    throw new TypeError("Project root must be a non-empty path without null bytes.");
  }

  const absoluteRoot = resolve(rootPath);
  const requestedRootInfo = await lstat(absoluteRoot);
  if (requestedRootInfo.isSymbolicLink()) {
    throw new TypeError("Project root must not be a symbolic link.");
  }
  const canonicalRoot = await realpath(absoluteRoot);
  const rootInfo = await lstat(canonicalRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new TypeError("Project root must be an existing directory.");
  }

  const requestedLimit = options.maxNestedDirectories ?? DEFAULT_NESTED_DIRECTORY_LIMIT;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 0) {
    throw new TypeError("maxNestedDirectories must be a non-negative integer.");
  }
  const nestedLimit = Math.min(requestedLimit, MAX_NESTED_DIRECTORY_LIMIT);

  const warnings: string[] = [];
  if (requestedLimit > MAX_NESTED_DIRECTORY_LIMIT) {
    warnings.push(`maxNestedDirectories was capped at ${MAX_NESTED_DIRECTORY_LIMIT}.`);
  }
  const evidenceFiles = new Set<string>();
  const manifestPaths: string[] = [];
  const rootEntries = await listDirectory(canonicalRoot, warnings);
  for (const name of rootEntries) {
    if (isManifestName(name)) {
      if (manifestPaths.length < MAX_MANIFESTS) manifestPaths.push(name);
      else warnings.push(`Manifest scan capped at ${MAX_MANIFESTS} files.`);
    }
  }

  const rootDirectories: string[] = [];
  for (const name of rootEntries.sort((a, b) => a.localeCompare(b))) {
    if (name.startsWith(".") || IGNORED_DIRECTORIES.has(name)) continue;
    const info = await safeLstat(join(canonicalRoot, name));
    if (info?.isDirectory() && !info.isSymbolicLink()) rootDirectories.push(name);
  }
  const inspectedDirectories = rootDirectories.slice(0, nestedLimit);
  const scanDirectories = [...inspectedDirectories];
  let directoryScanCapped = rootDirectories.length > inspectedDirectories.length ||
    (nestedLimit > 0 && inspectedDirectories.length >= nestedLimit);
  for (const parentName of inspectedDirectories) {
    if (scanDirectories.length >= nestedLimit) break;
    const parentPath = join(canonicalRoot, parentName);
    const parentInfo = await safeLstat(parentPath);
    if (!parentInfo?.isDirectory() || parentInfo.isSymbolicLink()) continue;
    const childNames = await listDirectory(parentPath, warnings);
    for (const childName of childNames.sort((a, b) => a.localeCompare(b))) {
      if (childName.startsWith(".") || IGNORED_DIRECTORIES.has(childName)) continue;
      const childPath = join(parentPath, childName);
      const childInfo = await safeLstat(childPath);
      if (!childInfo?.isDirectory() || childInfo.isSymbolicLink()) continue;
      if (scanDirectories.length >= nestedLimit) { directoryScanCapped = true; break; }
      scanDirectories.push(`${parentName}/${childName}`);
    }
  }
  if (nestedLimit > 0 && scanDirectories.length >= nestedLimit) directoryScanCapped = true;
  if (directoryScanCapped) {
    warnings.push(`Nested directory scan capped at ${nestedLimit} directories across the first two levels.`);
  }

  const nestedManifests: NestedManifest[] = [];
  for (const directoryName of scanDirectories) {
    const directoryPath = join(canonicalRoot, ...directoryName.split("/"));
    const directoryInfo = await safeLstat(directoryPath);
    if (!directoryInfo?.isDirectory() || directoryInfo.isSymbolicLink()) continue;
    const childNames = await listDirectory(directoryPath, warnings);
    for (const name of childNames) {
      const manifest = MANIFESTS.find((candidate) => candidate.name === name || (candidate.name.startsWith("*.") && name.endsWith(candidate.name.slice(1))));
      if (!manifest || SKIP_FILE_NAMES.has(name)) continue;
      const relativePath = `${directoryName}/${name}`;
      const info = await safeLstat(join(directoryPath, name));
      if (!info?.isFile() || info.isSymbolicLink()) continue;
      if (manifestPaths.length >= MAX_MANIFESTS) {
        warnings.push(`Manifest scan capped at ${MAX_MANIFESTS} files.`);
        continue;
      }
      nestedManifests.push({ path: relativePath, ecosystem: manifest.ecosystem });
      manifestPaths.push(relativePath);
    }
  }

  const uniqueManifestPaths = [...new Set(manifestPaths)].sort((a, b) => a.localeCompare(b));
  const manifestContents = new Map<string, string>();
  for (const manifestPath of uniqueManifestPaths) {
    const manifestName = manifestPath.split("/").at(-1) ?? "";
    if (!CONTENT_MANIFEST_NAMES.has(manifestName) && !manifestName.endsWith(".csproj")) continue;
    const content = await readBoundedTextFile(canonicalRoot, manifestPath, warnings);
    if (content !== undefined) {
      manifestContents.set(manifestPath, content);
      evidenceFiles.add(manifestPath);
    }
  }

  const languages = new RecordCollector();
  const frameworks = new RecordCollector();
  const packageManagers = new RecordCollector();
  const agentConfigs = new RecordCollector();

  for (const [path, ecosystem] of uniqueManifestPaths.map((path) => {
    const basename = path.split("/").at(-1) ?? path;
    return [path, MANIFESTS.find((item) => item.name === basename || (item.name.startsWith("*.") && basename.endsWith(item.name.slice(1))))?.ecosystem ?? "unknown"] as const;
  })) {
    const confidence: DetectionConfidence = path.includes("/") ? "medium" : "high";
    addLanguageDetections(languages, ecosystem, path, confidence);
    addPackageManagerDetections(packageManagers, path, ecosystem, confidence);
  }

  if (uniqueManifestPaths.some((path) => path.split("/").at(-1) === "tsconfig.json")) {
    const tsconfigPath = uniqueManifestPaths.find((path) => path.split("/").at(-1) === "tsconfig.json") ?? "tsconfig.json";
    languages.add("TypeScript", "language", tsconfigPath, tsconfigPath.includes("/") ? "medium" : "high");
  }

  for (const [path, content] of manifestContents) {
    const packageData = path.endsWith("package.json") ? parsePackageJson(content) : undefined;
    if (path.endsWith("package.json") && !packageData) {
      warnings.push(`Could not parse ${path}; language detection uses the manifest filename only.`);
    }
    if (packageData) {
      if (typeof packageData.packageManager === "string") {
        const manager = packageData.packageManager.split("@")[0] ?? "";
        if (["npm", "pnpm", "yarn", "bun"].includes(manager)) {
          packageManagers.add(manager, "packageManager", path, "high");
        }
      }
      const dependencyNames = collectDependencyNames(packageData);
      if (dependencyNames.has("typescript") || uniqueManifestPaths.includes("tsconfig.json") || uniqueManifestPaths.some((item) => item.endsWith("/tsconfig.json"))) {
        languages.add("TypeScript", "language", path, "high");
      }
      addJavaScriptFrameworks(frameworks, dependencyNames, path);
      if (Array.isArray(packageData.workspaces) || isObject(packageData.workspaces)) {
        evidenceFiles.add(path);
      }
    }
    if (path.endsWith("go.mod")) addGoFrameworks(frameworks, content, path);
    if (path.endsWith("pyproject.toml") || path.endsWith("requirements.txt") || path.endsWith("Pipfile")) {
      addPythonFrameworks(frameworks, content, path);
    }
    if (path.endsWith("Cargo.toml")) addRustFrameworks(frameworks, content, path);
    if (path.endsWith("pom.xml") || path.endsWith("build.gradle") || path.endsWith("build.gradle.kts")) {
      addJavaFrameworks(frameworks, content, path);
    }
    if (path.endsWith("composer.json")) addPhpFrameworks(frameworks, content, path);
    if (path.endsWith(".csproj")) addDotNetFrameworks(frameworks, content, path);
  }

  for (const config of FRAMEWORK_CONFIGS) {
    if (rootEntries.includes(config.name)) {
      const info = await safeLstat(join(canonicalRoot, config.name));
      if (info?.isFile() && !info.isSymbolicLink()) {
        frameworks.add(config.framework, "framework", config.name, "high");
        evidenceFiles.add(config.name);
      }
    }
  }
  for (const readme of ["README.md", "README"]) {
    const readmeInfo = await safeLstat(join(canonicalRoot, readme));
    if (readmeInfo?.isFile() && !readmeInfo.isSymbolicLink()) evidenceFiles.add(readme);
  }
  const docsInfo = await safeLstat(join(canonicalRoot, "docs"));
  if (docsInfo?.isDirectory() && !docsInfo.isSymbolicLink()) evidenceFiles.add("docs");

  const workspaceMarkers = await detectWorkspaceMarkers(canonicalRoot, rootEntries, manifestContents, evidenceFiles);
  await detectAgentConfigs(canonicalRoot, agentConfigs, evidenceFiles, warnings);

  const hasNestedManifests = nestedManifests.length > 0;
  const workspaceKind = workspaceMarkers.length > 0
    ? "monorepo"
    : hasNestedManifests || directoryScanCapped
      ? "ambiguous"
      : "single";

  return Object.freeze({
    rootPath: canonicalRoot,
    languages: languages.toArray(),
    frameworks: frameworks.toArray(),
    packageManagers: packageManagers.toArray(),
    agentConfigs: agentConfigs.toArray(),
    workspace: Object.freeze({
      kind: workspaceKind,
      markers: Object.freeze(workspaceMarkers),
      nestedManifests: Object.freeze(nestedManifests
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((item) => Object.freeze({ ...item }))),
    }),
    evidenceFiles: Object.freeze([...evidenceFiles].sort((a, b) => a.localeCompare(b))),
    warnings: Object.freeze(warnings),
  });
}

class RecordCollector {
  private readonly records = new Map<string, { value: string; kind: string; confidence: DetectionConfidence; evidence: Set<string> }>();
  add(value: string, kind: string, evidence: string, confidence: DetectionConfidence): void {
    const key = `${kind}\0${value.toLowerCase()}`;
    const current = this.records.get(key) ?? { value, kind, confidence, evidence: new Set<string>() };
    current.evidence.add(evidence);
    if (confidenceRank(confidence) > confidenceRank(current.confidence)) current.confidence = confidence;
    this.records.set(key, current);
  }

  toArray(): readonly DetectionRecord[] {
    return Object.freeze([...this.records.values()]
      .sort((a, b) => a.value.localeCompare(b.value))
      .map((record) => Object.freeze({
        value: record.value,
        kind: record.kind,
        confidence: record.confidence,
        evidence: Object.freeze([...record.evidence].sort((a, b) => a.localeCompare(b))),
        status: "detected" as const,
      })));
  }
}

function addLanguageDetections(collector: RecordCollector, ecosystem: string, path: string, confidence: DetectionConfidence): void {
  const values: Record<string, string[]> = {
    javascript: ["JavaScript"], go: ["Go"], python: ["Python"], rust: ["Rust"],
    "java-kotlin": ["Java", "Kotlin"], dotnet: [], ruby: ["Ruby"],
    php: ["PHP"], elixir: ["Elixir"], dart: ["Dart"], swift: ["Swift"], "c-cpp": ["C/C++"],
  };
  for (const value of values[ecosystem] ?? []) collector.add(value, "language", path, confidence);
  const basename = path.split("/").at(-1) ?? path;
  if (ecosystem === "dotnet" && basename.endsWith(".csproj")) collector.add("C#", "language", path, confidence);
}

function addPackageManagerDetections(collector: RecordCollector, path: string, ecosystem: string, confidence: DetectionConfidence): void {
  const name = path.split("/").at(-1) ?? path;
  const managers: Record<string, string> = {
    "pnpm-lock.yaml": "pnpm", "yarn.lock": "Yarn", "package-lock.json": "npm",
    "bun.lock": "Bun", "bun.lockb": "Bun", "uv.lock": "uv", "poetry.lock": "Poetry",
    "Pipfile": "Pipenv", "requirements.txt": "pip", "Cargo.lock": "Cargo",
    "go.mod": "Go modules", "go.work": "Go workspaces", "pom.xml": "Maven",
    "build.gradle": "Gradle", "build.gradle.kts": "Gradle", "Gemfile": "Bundler",
    "composer.json": "Composer", "mix.exs": "Mix", "global.json": ".NET SDK", "pubspec.yaml": "Pub",
    "Package.swift": "SwiftPM", "CMakeLists.txt": "CMake", "meson.build": "Meson",
  };
  const manager = managers[name];
  if (manager) collector.add(manager, "packageManager", path, ecosystem === "javascript" && confidence === "high" ? "medium" : confidence);
  if (ecosystem === "dotnet" && (name.endsWith(".csproj") || name.endsWith(".sln"))) collector.add("dotnet", "packageManager", path, confidence);
}

function addJavaScriptFrameworks(collector: RecordCollector, dependencies: Set<string>, path: string): void {
  const frameworks: Record<string, string> = {
    next: "Next.js", react: "React", vite: "Vite", "@nestjs/core": "NestJS",
    express: "Express", fastify: "Fastify", "@angular/core": "Angular", vue: "Vue",
    svelte: "Svelte", nuxt: "Nuxt", astro: "Astro", "@remix-run/react": "Remix",
    "@tanstack/react-start": "TanStack Start", hono: "Hono",
  };
  for (const [dependency, label] of Object.entries(frameworks)) {
    if (dependencies.has(dependency)) collector.add(label, "framework", path, "high");
  }
}

function addGoFrameworks(collector: RecordCollector, content: string, path: string): void {
  const candidates: Array<[RegExp, string]> = [
    [/github\.com\/gin-gonic\/gin/, "Gin"], [/github\.com\/labstack\/echo/, "Echo"],
    [/github\.com\/gofiber\/fiber/, "Fiber"], [/github\.com\/go-chi\/chi/, "Chi"],
  ];
  for (const [pattern, value] of candidates) if (pattern.test(content)) collector.add(value, "framework", path, "high");
}

function addPythonFrameworks(collector: RecordCollector, content: string, path: string): void {
  const candidates: Array<[RegExp, string]> = [
    [/(?:^|[\s"'])django(?:[\s=<>~!"']|$)/im, "Django"],
    [/(?:^|[\s"'])fastapi(?:[\s=<>~!"']|$)/im, "FastAPI"],
    [/(?:^|[\s"'])flask(?:[\s=<>~!"']|$)/im, "Flask"],
  ];
  for (const [pattern, value] of candidates) if (pattern.test(content)) collector.add(value, "framework", path, "medium");
}

function addRustFrameworks(collector: RecordCollector, content: string, path: string): void {
  for (const [pattern, value] of [[/\baxum\b/, "Axum"], [/\bactix-web\b/, "Actix Web"], [/\brocket\b/, "Rocket"]] as const) {
    if (pattern.test(content)) collector.add(value, "framework", path, "medium");
  }
}

function addJavaFrameworks(collector: RecordCollector, content: string, path: string): void {
  if (/spring-boot|org\.springframework\.boot/i.test(content)) collector.add("Spring Boot", "framework", path, "medium");
  if (/quarkus/i.test(content)) collector.add("Quarkus", "framework", path, "medium");
}

function addDotNetFrameworks(collector: RecordCollector, content: string, path: string): void {
  if (/Microsoft\.AspNetCore|Microsoft\.NET\.Sdk\.Web/i.test(content)) collector.add("ASP.NET Core", "framework", path, "medium");
}

function addPhpFrameworks(collector: RecordCollector, content: string, path: string): void {
  if (/"laravel\/framework"/.test(content)) collector.add("Laravel", "framework", path, "high");
  if (/"symfony\/framework-bundle"/.test(content)) collector.add("Symfony", "framework", path, "high");
}

function parsePackageJson(content: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(content);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function collectDependencyNames(packageData: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const value = packageData[key];
    if (!isObject(value)) continue;
    for (const name of Object.keys(value)) names.add(name);
  }
  return names;
}

async function detectWorkspaceMarkers(
  root: string,
  rootEntries: readonly string[],
  contents: ReadonlyMap<string, string>,
  evidence: Set<string>,
): Promise<string[]> {
  const markers = new Set<string>();
  const names = new Set(rootEntries);
  if (names.has("pnpm-workspace.yaml")) markers.add("pnpm-workspace.yaml");
  if (names.has("lerna.json")) markers.add("lerna.json");
  if (names.has("nx.json")) markers.add("nx.json");
  if (names.has("turbo.json")) markers.add("turbo.json");
  const packageJson = parsePackageJson(contents.get("package.json") ?? "");
  if (packageJson && (Array.isArray(packageJson.workspaces) || isObject(packageJson.workspaces))) markers.add("package.json#workspaces");
  const cargo = contents.get("Cargo.toml");
  if (cargo && /^\s*\[workspace\]/m.test(cargo)) markers.add("Cargo.toml#[workspace]");
  const goWork = contents.get("go.work");
  if (goWork) markers.add("go.work");
  const pyproject = contents.get("pyproject.toml");
  if (pyproject && /^\s*\[tool\.uv\.workspace\]/m.test(pyproject)) markers.add("pyproject.toml#[tool.uv.workspace]");
  const pom = contents.get("pom.xml");
  if (pom && /<modules>\s*[\s\S]*?<\/modules>/i.test(pom)) markers.add("pom.xml#modules");
  for (const settingsPath of ["settings.gradle", "settings.gradle.kts"]) {
    const settings = contents.get(settingsPath);
    if (settings && /^\s*include(?:\s*\(|\s+['"])/m.test(settings)) markers.add(`${settingsPath}#include`);
  }
  const verifiedMarkers: string[] = [];
  for (const marker of markers) {
    const markerFile = marker.split("#")[0] ?? marker;
    const info = await safeLstat(join(root, markerFile));
    if (info?.isFile() && !info.isSymbolicLink()) {
      verifiedMarkers.push(marker);
      evidence.add(markerFile);
    }
  }
  return verifiedMarkers.sort((a, b) => a.localeCompare(b));
}

async function detectAgentConfigs(
  root: string,
  collector: RecordCollector,
  evidence: Set<string>,
  warnings: string[],
): Promise<void> {
  for (const candidate of AGENT_CONFIGS) {
    const info = await lstatWithoutSymlinkParents(root, candidate.path);
    if (!info || (!info.isFile() && !info.isDirectory())) continue;
    const resolved = await safeRealpath(join(root, ...candidate.path.split("/")));
    if (!resolved || !isWithinRoot(root, resolved)) {
      warnings.push(`Skipped agent configuration path outside the selected project root: ${candidate.path}`);
      continue;
    }
    evidence.add(candidate.path);
    collector.add(candidate.label, "agentConfig", candidate.path, "high");
  }
}

async function listDirectory(path: string, warnings: string[]): Promise<string[]> {
  const names: string[] = [];
  try {
    const directory = await opendir(path);
    for await (const entry of directory) {
      names.push(entry.name);
      if (names.length >= MAX_DIRECTORY_ENTRIES) {
        warnings.push(`Directory entry scan capped at ${MAX_DIRECTORY_ENTRIES}: ${path}`);
        break;
      }
    }
    return names;
  } catch {
    warnings.push(`Could not inspect directory: ${path}`);
    return [];
  }
}

async function safeLstat(path: string) {
  try { return await lstat(path); } catch { return undefined; }
}

async function lstatWithoutSymlinkParents(root: string, relativePath: string) {
  const segments = relativePath.split("/");
  let currentPath = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment || segment === "." || segment === "..") return undefined;
    currentPath = join(currentPath, segment);
    const info = await safeLstat(currentPath);
    if (!info || info.isSymbolicLink()) return undefined;
    if (index < segments.length - 1 && !info.isDirectory()) return undefined;
    if (index === segments.length - 1) return info;
  }
  return undefined;
}

async function safeRealpath(path: string): Promise<string | undefined> {
  try { return await realpath(path); } catch { return undefined; }
}

async function readBoundedTextFile(root: string, relativePath: string, warnings: string[]): Promise<string | undefined> {
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || SKIP_FILE_NAMES.has(segment))) return undefined;
  const path = join(root, ...segments);
  const info = await safeLstat(path);
  if (!info?.isFile() || info.isSymbolicLink() || info.size > MAX_MANIFEST_BYTES) {
    if (info && info.size > MAX_MANIFEST_BYTES) warnings.push(`Skipped oversized manifest: ${relativePath}`);
    return undefined;
  }
  const resolved = await safeRealpath(path);
  if (!resolved || !isWithinRoot(root, resolved)) {
    warnings.push(`Skipped manifest outside the selected project root: ${relativePath}`);
    return undefined;
  }
  try { return await readFile(path, "utf8"); }
  catch { warnings.push(`Could not read manifest: ${relativePath}`); return undefined; }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function isManifestName(name: string): boolean {
  return MANIFESTS.some((manifest) => manifest.name === name || (manifest.name.startsWith("*.") && name.endsWith(manifest.name.slice(1))));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function confidenceRank(value: DetectionConfidence): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}
