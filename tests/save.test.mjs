import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSave, decodeSave, loadSave, storeSave } from '../game/src/core/save.js';
test('save round-trip retains settings and progress', () => {
  const data = { cash: 250, position: [148, .15, -105], settings: { quality: 'med' } };
  assert.deepEqual(decodeSave(encodeSave(data)), data);
});
test('corrupt, truncated, wrong-version and blocked storage cannot throw', () => {
  for (const data of ['{', '{"version":1', 'null', '{"version":2,"data":{}}']) assert.equal(decodeSave(data), null);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadSave(blocked), null); assert.equal(storeSave(blocked, {}), false);
});
