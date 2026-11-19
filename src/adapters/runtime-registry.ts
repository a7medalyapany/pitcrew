import type { Adapter } from "./contract.js";
import type { AdapterId } from "./types.js";
import { genericAdapter } from "./generic.js";
import { codexAdapter } from "./codex.js";
import { opencodeAdapter } from "./opencode.js";
import { claudeAdapter } from "./claude.js";

const runtimeAdapters: Readonly<Partial<Record<AdapterId, Adapter>>> = Object.freeze({
  claude: claudeAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
  generic: genericAdapter,
});

/** Returns a concrete runtime implementation when that adapter is implemented. */
export function getRuntimeAdapter(id: AdapterId): Adapter | undefined {
  return runtimeAdapters[id];
}
