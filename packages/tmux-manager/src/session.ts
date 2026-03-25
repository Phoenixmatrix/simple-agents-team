import { $ } from "bun";

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
}

export interface CaptureOptions {
  /** Number of history lines to include (default: 0, no history) */
  history?: number;
  /** Start line number (negative = history lines before visible area) */
  start?: number;
  /** End line number (negative = from bottom of visible area) */
  end?: number;
}

export class TmuxSession {
  readonly name: string;

  private constructor(name: string) {
    this.name = name;
  }

  /**
   * Create a new tmux session. Throws if the session already exists.
   */
  static async create(name: string): Promise<TmuxSession> {
    await $`tmux new-session -d -s ${name}`.quiet();
    return new TmuxSession(name);
  }

  /**
   * Attach to an existing tmux session by name. Throws if it doesn't exist.
   */
  static async attach(name: string): Promise<TmuxSession> {
    await $`tmux has-session -t ${name}`.quiet();
    return new TmuxSession(name);
  }

  /**
   * List all tmux sessions.
   */
  static async list(): Promise<string[]> {
    try {
      const fmt = "#{session_name}";
      const result = await $`tmux list-sessions -F ${fmt}`.quiet();
      return result.text().trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Kill this session.
   */
  async kill(): Promise<void> {
    await $`tmux kill-session -t ${this.name}`.quiet();
  }

  // --- Window management ---

  /**
   * Create a new window in this session.
   */
  async createWindow(name: string): Promise<TmuxWindow> {
    await $`tmux new-window -t ${this.name} -n ${name}`.quiet();
    const windows = await this.listWindows();
    const window = windows.find((w) => w.name === name);
    if (!window) throw new Error(`Failed to create window "${name}"`);
    return window;
  }

  /**
   * Close a window by index.
   */
  async closeWindow(index: number): Promise<void> {
    await $`tmux kill-window -t ${this.name}:${index}`.quiet();
  }

  /**
   * List all windows in this session.
   */
  async listWindows(): Promise<TmuxWindow[]> {
    const fmt = "#{window_index},#{window_name},#{window_active}";
    const result =
      await $`tmux list-windows -t ${this.name} -F ${fmt}`.quiet();
    return result
      .text()
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [index, name, active] = line.split(",");
        return {
          index: parseInt(index, 10),
          name,
          active: active === "1",
        };
      });
  }

  // --- Active window ---

  /**
   * Get the currently active window.
   */
  async getActiveWindow(): Promise<TmuxWindow> {
    const windows = await this.listWindows();
    const active = windows.find((w) => w.active);
    if (!active) throw new Error("No active window found");
    return active;
  }

  /**
   * Select (focus) a window by index.
   */
  async selectWindow(index: number): Promise<void> {
    await $`tmux select-window -t ${this.name}:${index}`.quiet();
  }

  // --- Sending keys ---

  /**
   * Send keys to a window. If no window index is given, sends to the active window.
   */
  async sendKeys(keys: string, windowIndex?: number): Promise<void> {
    const target =
      windowIndex !== undefined
        ? `${this.name}:${windowIndex}`
        : this.name;
    await $`tmux send-keys -t ${target} ${keys} Enter`.quiet();
  }

  /**
   * Send raw keys without appending Enter.
   */
  async sendKeysRaw(keys: string, windowIndex?: number): Promise<void> {
    const target =
      windowIndex !== undefined
        ? `${this.name}:${windowIndex}`
        : this.name;
    await $`tmux send-keys -t ${target} ${keys}`.quiet();
  }

  // --- Reading output ---

  /**
   * Capture the current visible content of a window's pane.
   */
  async capture(
    windowIndex?: number,
    options: CaptureOptions = {},
  ): Promise<string> {
    const target =
      windowIndex !== undefined
        ? `${this.name}:${windowIndex}`
        : this.name;
    const args: string[] = [];
    if (options.start !== undefined) {
      args.push("-S", String(options.start));
    }
    if (options.end !== undefined) {
      args.push("-E", String(options.end));
    }
    const result =
      await $`tmux capture-pane -t ${target} -p ${{ raw: args.join(" ") }}`.quiet();
    return result.text();
  }

  /**
   * Watch a window's output, calling the callback with new content at the given interval.
   * Returns a cleanup function to stop watching.
   */
  watch(
    callback: (content: string) => void,
    intervalMs: number = 1000,
    windowIndex?: number,
  ): () => void {
    let lastContent = "";
    const timer = setInterval(async () => {
      try {
        const content = await this.capture(windowIndex);
        if (content !== lastContent) {
          lastContent = content;
          callback(content);
        }
      } catch {
        // Session or window may have been closed
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }
}
