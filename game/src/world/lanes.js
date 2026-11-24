import { SeededRandom } from '../core/rng.js';
export const SIGNAL_CYCLE = 64;
export function signalClock(graph, nodeId, time) {
  return ((time + graph.intersections[nodeId].offset) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
}
export function signalPhase(graph, nodeId, approach, time) {
  const phase = signalClock(graph, nodeId, time), vertical = approach === 'north' || approach === 'south';
  if (vertical) return phase < 20 ? 'green' : phase < 23 ? 'amber' : 'red';
  return phase >= 25 && phase < 45 ? 'green' : phase >= 45 && phase < 48 ? 'amber' : 'red';
}
export function walkSignal(graph, nodeId, time, duration = 0) {
  const phase = signalClock(graph, nodeId, time);
  return phase >= 50 && phase + duration <= 60;
}
export function addLaneGraphs(graph, seed = 1) {
  const rng = seed instanceof SeededRandom ? seed : new SeededRandom(seed);
  graph.intersections = graph.nodes.map(node => ({ id: node.id, x: node.x, z: node.z, offset: rng.int(0, 63), incoming: [] }));
  graph.lanes = graph.edges.map(edge => {
    const a = graph.nodes[edge.from], b = graph.nodes[edge.to];
    const ux = (b.x - a.x) / edge.length, uz = (b.z - a.z) / edge.length;
    const offset = ux === 0 && a.x === 160 ? 6.5 : 3.8;
    const approach = ux > 0 ? 'west' : ux < 0 ? 'east' : uz > 0 ? 'south' : 'north';
    graph.intersections[edge.to].incoming.push(edge.id);
    return { id: edge.id, from: edge.from, to: edge.to, ux, uz, approach,
      ax: a.x + ux * 16 + uz * offset, az: a.z + uz * 16 - ux * offset,
      bx: b.x - ux * 16 + uz * offset, bz: b.z - uz * 16 - ux * offset,
      length: edge.length - 32, speedLimit: edge.speedLimit, next: graph.nodes[edge.to].edges };
  });
  const nodes = [], edges = [];
  const corner = (id, sx, sz) => id * 4 + (sx > 0 ? 2 : 0) + (sz > 0 ? 1 : 0);
  for (const node of graph.nodes) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    nodes.push({ id: nodes.length, x: node.x + sx * (node.x === 160 ? 16 : 12), z: node.z + sz * 12, edges: [] });
  }
  const connect = (a, b, crossing = -1) => {
    const from = nodes[a], to = nodes[b];
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    for (const pair of [[a, b], [b, a]]) {
      const edge = { id: edges.length, from: pair[0], to: pair[1], length, crossing };
      nodes[edge.from].edges.push(edge.id); edges.push(edge);
    }
  };
  for (const node of graph.nodes) {
    for (const side of [-1, 1]) {
      connect(corner(node.id, -1, side), corner(node.id, 1, side), node.id);
      connect(corner(node.id, side, -1), corner(node.id, side, 1), node.id);
    }
  }
  for (const edge of graph.edges) {
    const lane = graph.lanes[edge.id];
    if (lane.ux > 0) for (const side of [-1, 1]) connect(corner(edge.from, 1, side), corner(edge.to, -1, side));
    if (lane.uz > 0) for (const side of [-1, 1]) connect(corner(edge.from, side, 1), corner(edge.to, side, -1));
  }
  graph.sidewalk = { nodes, edges }; return graph;
}
