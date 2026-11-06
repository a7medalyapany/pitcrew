import type { AdapterId, AdapterDefinition } from "./types.js";

const adapters: readonly AdapterDefinition[] = [
  {
    id: "claude",
    metadata: {
      displayName: "Claude Code",
      description: "Anthropic Claude Code integration.",
      docsUrl: "https://code.claude.com/docs/en/overview",
    },
    capabilities: {
      rootInstructions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      skills: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      subagents: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      commands: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      hooks: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      permissions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      mcpConfig: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      nestedInstructions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      reviewMode: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
    },
  },
  {
    id: "codex",
    metadata: {
      displayName: "OpenAI Codex",
      description: "OpenAI Codex integration.",
      docsUrl: "https://developers.openai.com/codex",
    },
    capabilities: {
      rootInstructions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      skills: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      subagents: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      commands: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      hooks: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      permissions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      mcpConfig: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      nestedInstructions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      reviewMode: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
    },
  },
  {
    id: "opencode",
    metadata: {
      displayName: "OpenCode",
      description: "OpenCode integration.",
      docsUrl: "https://opencode.ai/docs",
    },
    capabilities: {
      rootInstructions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      skills: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      subagents: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      commands: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      hooks: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      permissions: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      mcpConfig: {
        targetSupport: "supported",
        integration: { status: "notImplemented" },
      },
      nestedInstructions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      reviewMode: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
    },
  },
  {
    id: "generic",
    metadata: {
      displayName: "Generic",
      description: "Manual workflow instructions for other AI tools.",
    },
    capabilities: {
      rootInstructions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      skills: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      subagents: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      commands: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      hooks: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      permissions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      mcpConfig: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      nestedInstructions: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
      reviewMode: {
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      },
    },
  },
];

export function listAdapters(): readonly AdapterDefinition[] {
  return adapters;
}

export function getAdapter(id: string): AdapterDefinition | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

export function isAdapterId(id: string): id is AdapterId {
  return adapters.some((adapter) => adapter.id === id);
}
