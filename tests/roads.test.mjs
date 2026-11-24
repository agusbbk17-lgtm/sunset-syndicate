import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoadGraph, findRoadRoute } from '../game/src/world/roads.js';
test('named landmark route uses connected directional lane edges only', () => {
  const graph = createRoadGraph(), route = findRoadRoute(graph, 'Pearl Boulevard', 'Cinder Docks');
  assert.equal(route.reduce((sum, edge) => sum + edge.length, 0), 480);
  assert.ok(route.every(edge => edge.lane));
  for (let i = 1; i < route.length; i++) assert.equal(route[i - 1].to, route[i].from);
});
