import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

// Import persona markdown files as text
import coordinatorPersona from "../../../personas/coordinator/persona.md" with { type: "text" };
import workerPersona from "../../../personas/worker/persona.md" with { type: "text" };
import releasePersona from "../../../personas/release/persona.md" with { type: "text" };

// Import settings as JSON
import coordinatorSettings from "../../../personas/coordinator/settings.json";
import workerSettings from "../../../personas/worker/settings.json";
import releaseSettings from "../../../personas/release/settings.json";

const PERSONAS_DIR = resolve(process.env.HOME ?? "~", ".sat", "personas");

const personas: Record<string, { persona: string; settings: unknown }> = {
  coordinator: { persona: coordinatorPersona, settings: coordinatorSettings },
  worker: { persona: workerPersona, settings: workerSettings },
  release: { persona: releasePersona, settings: releaseSettings },
};

let _synced = false;

/** Ensures persona files exist at ~/.sat/personas/ — writes them on first call. */
export function ensurePersonas() {
  if (_synced) return;
  _synced = true;

  for (const [name, data] of Object.entries(personas)) {
    const dir = resolve(PERSONAS_DIR, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "persona.md"), data.persona);
    writeFileSync(resolve(dir, "settings.json"), JSON.stringify(data.settings, null, 2));
  }
}

/** Returns the path to a persona directory under ~/.sat/personas/. */
export function getPersonaDir(name: string): string {
  ensurePersonas();
  return resolve(PERSONAS_DIR, name);
}

/** Returns the path to a persona's settings.json. */
export function getSettingsPath(name: string): string {
  return resolve(getPersonaDir(name), "settings.json");
}
