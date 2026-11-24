import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// make.fun's hand-in library is the kit's own file and RULES.txt requires it byte for byte
// unchanged, so its 1,203 lines are not ours to split; pin its hash instead. Everything else
// in the repository, authored here, stays under the 500-line limit.
const KIT_LIBRARY = 'vendor/makefun-game.ts';
const KIT_LIBRARY_SHA256 = 'dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129';

test('all repository text files stay below 500 lines and authored game code has no unseeded RNG', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const library = join(root, KIT_LIBRARY);
  assert.equal(createHash('sha256').update(readFileSync(library)).digest('hex'), KIT_LIBRARY_SHA256,
    `${KIT_LIBRARY} must be the kit's copy, unchanged: the gate rebuilds the dossier with this library`);
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { visit(path); continue; }
      if (!/\.(?:js|mjs|ts|css|html|json|md)$/.test(path) && !['LICENSE', '.gitignore'].includes(entry.name)) continue;
      if (path === library) continue;
      const source = readFileSync(path, 'utf8'), lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
      assert.ok(lines < 500, `${path}: ${lines} lines`);
      if (path.includes('/game/src/')) assert.equal(/Math\s*\.\s*random\s*\(/.test(source), false, path);
    }
  }
  visit(root);
});
