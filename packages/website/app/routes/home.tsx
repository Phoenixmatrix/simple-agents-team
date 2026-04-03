import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "px — orchestrate Claude Code agents" },
    {
      name: "description",
      content:
        "A CLI tool that orchestrates multiple Claude Code agents using tmux, SQLite, and a task tracker.",
    },
  ];
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function TerminalBlock({
  lines,
}: {
  lines: { prompt?: boolean; text: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-gray-500 font-mono">terminal</span>
      </div>
      <div className="p-5 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={line.prompt ? "text-gray-300" : "text-gray-500"}>
            {line.prompt && <span className="text-emerald-400">$ </span>}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.06]">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">px</span>
            <span className="text-xs text-gray-500 font-mono mt-0.5">
              /pɪks/
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#quickstart"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Quickstart
            </a>
            <a
              href="https://github.com/Phoenixmatrix/px#readme"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/Phoenixmatrix/px"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <GithubIcon className="w-5 h-5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open source CLI tool
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Orchestrate
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Claude Code agents
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            A coordinator dispatches work to parallel workers, each in its own
            tmux session. A release agent merges branches. A daemon monitors
            everything.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-950 font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Get started
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </a>
            <a
              href="https://github.com/Phoenixmatrix/px"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Architecture diagram */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <TerminalBlock
            lines={[
              { prompt: true, text: "px start" },
              { text: "" },
              { prompt: true, text: "tmux list-sessions" },
              { text: "px:          1 windows (attached)" },
              { text: "px-daemon:   1 windows" },
              { text: "px-release:  1 windows" },
              { text: "" },
              { prompt: true, text: "px tracker status" },
              { text: "Tasks:" },
              { text: "  T-1  [in-progress]  add login page        → alice" },
              { text: "  T-2  [in-progress]  auth API endpoints    → bob" },
              { text: "  T-3  [assigned]     session middleware     → bob" },
              { text: "  R-1  [ready]        merge auth-login-page → release" },
              { text: "" },
              { text: "Workers:" },
              { text: "  coordinator  [busy]   px:0.0" },
              { text: "  alice        [busy]   px-alice:0.0" },
              { text: "  bob          [busy]   px-bob:0.0" },
              { text: "  release      [idle]   px-release:0.0" },
              { text: "  daemon       [busy]   px-daemon:0.0" },
            ]}
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="pb-24 px-6 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need for multi-agent workflows
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Built on tmux, SQLite, and Claude Code. No custom runtimes, no
              containers &mdash; just your terminal.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon="🎯"
              title="Task tracker"
              description="SQLite-backed task board with dependencies, assignments, and portfolios. Workers auto-pick up tasks when idle."
            />
            <FeatureCard
              icon="🔀"
              title="Parallel workers"
              description="Spawn as many workers as you need. Each runs in its own tmux session with full Claude Code capabilities."
            />
            <FeatureCard
              icon="🚀"
              title="Release agent"
              description="Dedicated agent handles merging, quality gates, and pushing. Workers never merge their own branches."
            />
            <FeatureCard
              icon="📦"
              title="Portfolios"
              description="Group related tasks onto a named integration branch. Collect multiple changes before merging to main."
            />
            <FeatureCard
              icon="📊"
              title="Status daemon"
              description="Live dashboard polls the database, shows worker status, and nudges idle workers back to life."
            />
            <FeatureCard
              icon="⚡"
              title="Single binary"
              description="Compiled with Bun for instant startup. Download, chmod, and go &mdash; no runtime dependencies."
            />
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section id="quickstart" className="pb-24 px-6 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Up and running in seconds
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-lg mx-auto">
            px requires{" "}
            <a
              href="https://github.com/tmux/tmux/wiki/Installing"
              className="text-gray-300 underline underline-offset-4 hover:text-white transition-colors"
            >
              tmux
            </a>{" "}
            and{" "}
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/overview"
              className="text-gray-300 underline underline-offset-4 hover:text-white transition-colors"
            >
              Claude Code
            </a>
            . Download the binary, put it on your PATH, and start orchestrating.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Linux (x64)
              </h3>
              <TerminalBlock
                lines={[
                  {
                    prompt: true,
                    text: "curl -fsSL -o px https://github.com/Phoenixmatrix/px/releases/latest/download/px-linux-x64",
                  },
                  { prompt: true, text: "chmod +x px && sudo mv px /usr/local/bin/" },
                ]}
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Linux (arm64)
              </h3>
              <TerminalBlock
                lines={[
                  {
                    prompt: true,
                    text: "curl -fsSL -o px https://github.com/Phoenixmatrix/px/releases/latest/download/px-linux-arm64",
                  },
                  { prompt: true, text: "chmod +x px && sudo mv px /usr/local/bin/" },
                ]}
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                macOS (Apple Silicon)
              </h3>
              <TerminalBlock
                lines={[
                  {
                    prompt: true,
                    text: "curl -fsSL -o px https://github.com/Phoenixmatrix/px/releases/latest/download/px-darwin-arm64",
                  },
                  { prompt: true, text: "chmod +x px && sudo mv px /usr/local/bin/" },
                ]}
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Start the coordinator
              </h3>
              <TerminalBlock
                lines={[
                  { prompt: true, text: "cd your-project/" },
                  { prompt: true, text: "px start" },
                ]}
              />
            </div>
          </div>

          <p className="text-center mt-10 text-sm text-gray-500">
            See the{" "}
            <a
              href="https://github.com/Phoenixmatrix/px#readme"
              className="text-gray-300 underline underline-offset-4 hover:text-white transition-colors"
            >
              full documentation
            </a>{" "}
            for development setup, commands reference, and workflow details.
          </p>
        </div>
      </section>

      {/* Workflow */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
            How it works
          </h2>
          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "You tell the coordinator what to build",
                description:
                  'Be explicit about task breakdown and parallelization. "Create three tasks: login UI, auth API, session middleware. Spawn two workers."',
              },
              {
                step: "2",
                title: "Workers execute in parallel",
                description:
                  "Each worker picks up tasks, writes code, runs quality gates, commits, and hands off to the release agent.",
              },
              {
                step: "3",
                title: "Release agent integrates",
                description:
                  "Merges worker branches into main or a portfolio branch, runs checks, and pushes. Workers never merge their own code.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold">px</span>
            <span className="text-gray-600 text-sm">
              &middot; Open source under MIT
            </span>
          </div>
          <a
            href="https://github.com/Phoenixmatrix/px"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
