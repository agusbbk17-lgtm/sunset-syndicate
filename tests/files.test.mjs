import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
test('all repository text files stay below 500 lines and authored game code has no unseeded RNG', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { visit(path); continue; }
      if (!/\.(?:js|mjs|ts|css|html|json|md)$/.test(path) && !['LICENSE', '.gitignore'].includes(entry.name)) continue;
      const source = readFileSync(path, 'utf8'), lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
      assert.ok(lines < 500, `${path}: ${lines} lines`);
      if (path.includes('/game/src/')) assert.equal(/Math\s*\.\s*random\s*\(/.test(source), false, path);
    }
  }
  visit(root);
});
