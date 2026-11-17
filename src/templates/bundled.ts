import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { bundledTemplateCatalog } from "./catalog.js";
import { loadTemplateIndex } from "./index/loader.js";
import { validateTemplateSources } from "./index/source-validator.js";
import type { TemplateIndex } from "./index/types.js";
import type { TemplateAsset, TemplateDefinition } from "./types.js";

const TEMPLATE_ID = "core-workflow";
const TEMPLATE_VERSION = "0.1.0";

export interface BundledTemplateResources {
  readonly root: string;
  readonly template: TemplateDefinition;
  readonly index: TemplateIndex;
  readonly sources: Readonly<Record<string, string>>;
}

/** Load and validate the packaged core template without touching the target project. */
export async function loadBundledTemplate(): Promise<BundledTemplateResources> {
  const template = bundledTemplateCatalog.find((item) => item.id === TEMPLATE_ID);
  if (!template || template.version !== TEMPLATE_VERSION) {
    throw new Error("Bundled core template catalog is inconsistent with its version contract.");
  }
  const root = await resolveBundledTemplateRoot();
  await validateTemplateSources(root, template);
  const index = await loadTemplateIndex(join(root, "index.json"), bundledTemplateCatalog);
  const sources = await readTemplateSources(root, template.assets);
  return Object.freeze({ root, template, index, sources });
}

async function resolveBundledTemplateRoot(): Promise<string> {
  const candidates = [
    fileURLToPath(new URL("./core/", import.meta.url)),
    fileURLToPath(new URL("./templates/core/", import.meta.url)),
  ];
  for (const candidate of candidates) {
    try {
      const info = await lstat(candidate);
      if (info.isDirectory() && !info.isSymbolicLink()) return candidate;
    } catch {
      // Try the next known source/package layout.
    }
  }
  throw new Error("Bundled core template assets are missing. Rebuild Pitcrew so its template files are packaged.");
}

async function readTemplateSources(root: string, assets: readonly TemplateAsset[]): Promise<Readonly<Record<string, string>>> {
  const sources = Object.create(null) as Record<string, string>;
  let totalBytes = 0;
  for (const asset of assets) {
    if (asset.source.type === "file") {
      const content = await readSafeTemplateFile(root, asset.source.path);
      totalBytes += Buffer.byteLength(content, "utf8");
      sources[asset.source.path] = content;
      continue;
    }
    const directory = join(root, ...asset.source.path.split("/"));
    await readTemplateDirectory(root, directory, asset.source.path, sources, (bytes) => { totalBytes += bytes; });
  }
  if (totalBytes > 20 * 1024 * 1024) throw new Error("Bundled template exceeds the 20 MiB source limit.");
  return Object.freeze(sources);
}

async function readTemplateDirectory(
  root: string,
  directory: string,
  relativeDirectory: string,
  sources: Record<string, string>,
  onBytes: (bytes: number) => void,
): Promise<void> {
  const names = await readdir(directory);
  for (const name of names.sort(comparePath)) {
    const absolute = join(directory, name);
    const relativePath = `${relativeDirectory}/${name}`;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Bundled template contains a symlink at '${relativePath}'.`);
    if (info.isDirectory()) {
      await readTemplateDirectory(root, absolute, relativePath, sources, onBytes);
      continue;
    }
    if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new Error(`Bundled template entry '${relativePath}' is not a supported regular file.`);
    const content = await readSafeTemplateFile(root, relativePath);
    onBytes(Buffer.byteLength(content, "utf8"));
    sources[relativePath] = content;
  }
}

async function readSafeTemplateFile(root: string, relativePath: string): Promise<string> {
  const absolute = resolve(root, ...relativePath.split("/"));
  const rel = relative(root, absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep)) throw new Error("Bundled template path escaped its root.");
  const info = await lstat(absolute);
  if (info.isSymbolicLink() || !info.isFile() || info.size > 10 * 1024 * 1024) throw new Error(`Bundled template file '${relativePath}' is unsafe or too large.`);
  return readFile(absolute, "utf8");
}

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
