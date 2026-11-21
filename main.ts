// Solmara Spot the Difference — entry hand-in program (Node 22+, stdlib only).
//
// What it does, in order:
//   1. Finds this repository's root from this file's own location.
//   2. Copies game/ and screenshots/ into the output directory
//      (process.env.MAKEFUN_OUTPUT_DIR, or /output in the grader).
//   3. Refuses to hand in a broken entry: game/index.html must exist, and
//      screenshots/ must hold 3 or 4 images, each no bigger than 256 KiB.
//   4. Writes /output/dossier.json with buildDossier from the vendored
//      make.fun library, so the judge reads exactly what the scorer checks.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const MAX_SCREENSHOT_BYTES = 256 * 1024;
const DOSSIER_TEXT_CAP = 163840;

function fail(message: string): never {
  throw new Error('solmara entry: ' + message);
}

function checkEntryPoint(): void {
  const index = join(REPO_ROOT, 'game', 'index.html');
  if (!existsSync(index)) fail('game/index.html is missing');
  if (!statSync(index).isFile()) fail('game/index.html is not a regular file');
}

function checkScreenshots(): string[] {
  const dir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(dir)) fail('screenshots/ is missing');
  const shots = readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    fail(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  for (const name of shots) {
    const path = join(dir, name);
    if (!statSync(path).isFile()) fail(`screenshots/${name} is not a regular file`);
    const size = statSync(path).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
  return shots;
}

function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

function main(): void {
  checkEntryPoint();
  const shots = checkScreenshots();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyTree(join(REPO_ROOT, 'game'), join(OUTPUT_DIR, 'game'));
  copyTree(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'));

  // The scorer's own caps (from the kit's reference/gate.json): only
  // text_max_bytes shapes the dossier bytes; the others refuse an entry
  // the scorer would refuse, so a bad entry fails loudly here instead.
  const dossier = buildDossier(OUTPUT_DIR, {
    text_max_bytes: DOSSIER_TEXT_CAP,
    screenshots: { max: 4, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  // The grader runs this program twice and both runs must write the same
  // bytes, so prove the dossier is deterministic before handing it in:
  // build it a second time and refuse to ship if the two copies differ.
  const dossierAgain = buildDossier(OUTPUT_DIR, {
    text_max_bytes: DOSSIER_TEXT_CAP,
    screenshots: { max: 4, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  if (!Buffer.from(dossierAgain).equals(Buffer.from(dossier))) fail('dossier.json is not deterministic across builds');
  if (Buffer.byteLength(dossier, 'utf8') > 1572864) {
    fail('dossier.json is over the 1.5 MiB gate cap');
  }
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);

  console.log(`handed in ${shots.length} screenshots: ${shots.join(', ')}`);
  console.log(`output written to ${OUTPUT_DIR}`);
}

main();
