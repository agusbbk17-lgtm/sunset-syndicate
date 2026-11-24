// Sunset Syndicate — Solmar Bay, an original static third-person city game.
// game/index.html loads our ES modules; game/vendor contains pinned Three.js.
// This Node 22 hand-in copies game/ and screenshots/ without a build or network.
// Run: node serve.ts; hand-in locally: MAKEFUN_OUTPUT_DIR=out node main.ts.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

for (const directory of ['game', 'screenshots']) {
  if (!existsSync(join(here, directory)) || !statSync(join(here, directory)).isDirectory()) {
    throw new Error(`Sunset Syndicate needs its ${directory}/ directory before hand-in.`);
  }
}
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
