const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git", "node_modules", "vendor", "dist", "build", "coverage", ".next",
  ".nuxt", ".output", ".turbo", ".cache", ".pnpm-store", ".venv", "venv",
  "env", "pods", "deriveddata", "target", ".ssh", ".aws", ".azure", ".gnupg",
  ".docker", ".kube", ".terraform", ".pulumi", ".secrets", ".vault",
  "secrets", "credentials", ".credentials",
]);

const SENSITIVE_FILE_NAMES = new Set([
  ".npmrc", ".pypirc", ".netrc", ".envrc", "auth.json", "credentials.json",
  "secrets.json", "id_rsa", "id_ed25519", "credentials", "token",
]);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|tfstate|tfvars|asc)$/i,
];

const WINDOWS_RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/** Returns true for directory names that must not be traversed during inspection. */
export function isExcludedDirectoryName(name: string): boolean {
  return EXCLUDED_DIRECTORY_NAMES.has(name.toLowerCase());
}

/** Returns true for filenames that may contain credentials or sensitive local state. */
export function isSensitiveFileName(name: string): boolean {
  const normalized = name.toLowerCase();
  return SENSITIVE_FILE_NAMES.has(normalized) ||
    SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

/** Returns true when a path contains an excluded directory or sensitive filename. */
export function isSensitiveRelativePath(path: string): boolean {
  const segments = path.split("/");
  if (segments.some(isExcludedDirectoryName)) return true;
  const fileName = segments.at(-1);
  return fileName !== undefined && isSensitiveFileName(fileName);
}

/**
 * Validates a portable project-relative path. The policy is intentionally
 * stricter than the host OS so manifests behave consistently across platforms.
 */
export function isSafeInspectionPath(path: string): boolean {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.length > 1024 ||
    path.includes("\0") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[a-z]:/i.test(path)
  ) return false;

  return path.split("/").every((segment) =>
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !/[<>:"|?*]/.test(segment) &&
    !/[. ]$/.test(segment) &&
    !WINDOWS_RESERVED_NAMES.has(segment.split(".")[0]?.toLowerCase() ?? "")
  );
}
