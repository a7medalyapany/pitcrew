import type { Adapter } from "./contract.js";
import type { AdapterId } from "./types.js";
import { genericAdapter } from "./generic.js";

const runtimeAdapters: Readonly<Partial<Record<AdapterId, Adapter>>> = Object.freeze({
  generic: genericAdapter,
});

/** Returns a concrete runtime implementation when that adapter is implemented. */
export function getRuntimeAdapter(id: AdapterId): Adapter | undefined {
  return runtimeAdapters[id];
}
