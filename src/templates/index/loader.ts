import { lstat, readFile } from "node:fs/promises";
import type { TemplateCatalog } from "../types.js";
import type { TemplateIndex } from "./types.js";
import { TemplateIndexLoadError } from "./errors.js";
import { validateTemplateIndex } from "./validator.js";

/** Maximum accepted JSON index size (1 MiB). */
export const MAX_TEMPLATE_INDEX_BYTES = 1024 * 1024;

/** Read, parse, and validate a JSON template index without modifying files. */
export async function loadTemplateIndex(
  filePath: string,
  catalog: TemplateCatalog,
): Promise<TemplateIndex> {
  let contents: string;

  try {
    const fileInfo = await lstat(filePath);
    if (fileInfo.isSymbolicLink()) {
      throw new Error("index file must not be a symbolic link");
    }
    if (!fileInfo.isFile()) {
      throw new Error("index path is not a regular file");
    }
    if (fileInfo.size > MAX_TEMPLATE_INDEX_BYTES) {
      throw new Error(`index exceeds the ${MAX_TEMPLATE_INDEX_BYTES}-byte size limit`);
    }

    contents = await readFile(filePath, "utf8");
    if (Buffer.byteLength(contents, "utf8") > MAX_TEMPLATE_INDEX_BYTES) {
      throw new Error(`index exceeds the ${MAX_TEMPLATE_INDEX_BYTES}-byte size limit`);
    }
  } catch (error) {
    throw new TemplateIndexLoadError(filePath, errorMessage(error), error);
  }

  let input: unknown;
  try {
    input = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new TemplateIndexLoadError(filePath, "file does not contain valid JSON", error);
  }

  return validateTemplateIndex(input, catalog);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
