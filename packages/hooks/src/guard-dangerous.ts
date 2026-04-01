// PreToolUse hook: blocks dangerous commands in bypassPermissions mode.
// Reads Claude Code hook JSON from stdin, inspects the command,
// and exits 2 to BLOCK if it matches a dangerous pattern.
//
// Exit codes: 0 = allowed, 2 = BLOCKED

const input = await Bun.stdin.text();

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
}

let parsed: HookInput;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0); // Can't parse — fail open
}

const command = parsed.tool_input?.command;
if (!command) {
  process.exit(0);
}

const lower = command.toLowerCase();

function block(reason: string): never {
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════════╗");
  console.error("║  DANGEROUS COMMAND BLOCKED                                      ║");
  console.error("╠══════════════════════════════════════════════════════════════════╣");
  console.error(`║  Command: ${truncate(command, 53).padEnd(53)} ║`);
  console.error(`║  Reason:  ${truncate(reason, 53).padEnd(53)} ║`);
  console.error("║                                                                  ║");
  console.error("║  If this is intentional, ask the user to run it manually.        ║");
  console.error("╚══════════════════════════════════════════════════════════════════╝");
  console.error("");
  process.exit(2);
}

// --- sudo ---
if (/\bsudo\b/.test(lower)) {
  block("Agents must never use sudo or elevate privileges");
}

// --- System package managers ---
const pkgPatterns: [RegExp, string][] = [
  [/\bapt\s+install\b/, "System package install (apt)"],
  [/\bapt-get\s+install\b/, "System package install (apt-get)"],
  [/\bdnf\s+install\b/, "System package install (dnf)"],
  [/\byum\s+install\b/, "System package install (yum)"],
  [/\bpacman\s+-[a-z]*s/i, "System package install (pacman)"],
  [/\bbrew\s+install\b/, "Package install (brew)"],
  [/\bgem\s+install\b/, "System gem install"],
];
for (const [re, reason] of pkgPatterns) {
  if (re.test(lower)) {
    block(`${reason} — use project tools instead`);
  }
}

// --- pip install --system ---
if (/\bpip.*install\b/.test(lower) && /--system/.test(lower)) {
  block("System-level pip install — use a virtualenv instead");
}

// --- npm install -g / --global ---
if (/\bnpm.*install\b/.test(lower) && /(\s-g\b|--global)/.test(lower)) {
  block("Global npm install — use project dependencies instead");
}

// --- rm -rf / ---
if (/\brm\b/.test(lower)) {
  const fields = lower.split(/\s+/);
  let hasRm = false;
  let hasRf = false;
  for (const f of fields) {
    if (f === "rm") hasRm = true;
    if (f.startsWith("-") && f.includes("r") && f.includes("f")) hasRf = true;
    if (hasRm && hasRf && (f === "/" || f === "/*")) {
      block("Filesystem destruction (rm -rf /)");
    }
  }
}

// --- git push --force (allow --force-with-lease and --force-if-includes) ---
if (/\bgit\b.*\bpush\b/.test(lower)) {
  const sanitized = lower.replace(/--force-with-lease/g, "").replace(/--force-if-includes/g, "");
  if (/(\s--force\b|\s-f\b)/.test(sanitized)) {
    block("Force push rewrites remote history — use --force-with-lease");
  }
}

// --- git reset --hard ---
if (/\bgit\b.*\breset\b.*--hard/.test(lower)) {
  block("Hard reset discards all uncommitted changes irreversibly");
}

// --- git clean -f ---
if (/\bgit\b.*\bclean\b.*-f/.test(lower)) {
  block("git clean -f deletes untracked files irreversibly");
}

// --- SQL destruction ---
if (/\bdrop\b.*\btable\b/.test(lower)) block("Database table destruction");
if (/\bdrop\b.*\bdatabase\b/.test(lower)) block("Database destruction");
if (/\btruncate\b.*\btable\b/.test(lower)) block("Database table truncation");

// All checks passed
process.exit(0);
