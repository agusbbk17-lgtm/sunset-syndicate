import * as THREE from '../../vendor/three.module.min.js';
import { addLaneGraphs } from './lanes.js';
export { signalPhase, walkSignal, SIGNAL_CYCLE } from './lanes.js';
export const STREET_X = [-620, -500, -380, -260, -140, -20, 160];
export const STREET_Z = [-660, -540, -420, -300, -180, -60, 60, 180, 300, 420, 540, 660];
export const LANDMARKS = {
  'Pearl Boulevard': { x: 160, z: -60 }, 'Cinder Docks': { x: 160, z: -540 },
  'Aster Plaza': { x: -140, z: 180 }, 'Mirage Bank': { x: -20, z: 60 },
  'Coral Boardwalk': { x: 210, z: 60 }, 'Paloma Park': { x: -260, z: 420 },
  'Westwind Lookout': { x: -620, z: 540 }, 'Crown Overpass': { x: -20, z: 360 },
};
export function createRoadGraph(seed = 1) {
  const nodes = [], edges = [], lookup = new Map();
  for (const x of STREET_X) for (const z of STREET_Z) {
    const node = { id: nodes.length, x, z, edges: [] }; lookup.set(`${x},${z}`, node); nodes.push(node);
  }
  for (const node of nodes) for (const [dx, dz] of [[120, 0], [-120, 0], [180, 0], [-180, 0], [0, 120], [0, -120]]) {
    const target = lookup.get(`${node.x + dx},${node.z + dz}`);
    if (!target) continue;
    const edge = { id: edges.length, from: node.id, to: target.id, lane: true,
      length: Math.hypot(dx, dz), speedLimit: node.x === 160 && dx === 0 ? 24 : 16 };
    edges.push(edge); node.edges.push(edge.id);
  }
  return addLaneGraphs({ nodes, edges, landmarks: LANDMARKS }, seed);
}
export function nearestRoadNode(graph, point) {
  return graph.nodes.reduce((best, node) => Math.hypot(node.x - point.x, node.z - point.z) <
    Math.hypot(best.x - point.x, best.z - point.z) ? node : best);
}
export function findRoadRoute(graph, from, to) {
  const start = nearestRoadNode(graph, typeof from === 'string' ? LANDMARKS[from] : from);
  const goal = nearestRoadNode(graph, typeof to === 'string' ? LANDMARKS[to] : to);
  const distances = new Map([[start.id, 0]]), previous = new Map(), open = new Set([start.id]);
  while (open.size) {
    const id = [...open].reduce((a, b) => distances.get(a) < distances.get(b) ? a : b); open.delete(id);
    if (id === goal.id) break;
    for (const edgeId of graph.nodes[id].edges) {
      const edge = graph.edges[edgeId], next = distances.get(id) + edge.length;
      if (next < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, next); previous.set(edge.to, { id, edgeId }); open.add(edge.to);
      }
    }
  }
  if (!distances.has(goal.id)) return [];
  const route = []; let current = goal.id;
  while (current !== start.id) { const prev = previous.get(current); route.unshift(graph.edges[prev.edgeId]); current = prev.id; }
  return route;
}
export function instanceGeometry(scene, geometry, material, entries, shadow = true) {
  if (!entries.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  entries.forEach((entry, i) => {
    dummy.position.set(entry.x, entry.y, entry.z); dummy.rotation.set(0, entry.yaw || 0, 0);
    dummy.scale.set(entry.w, entry.h, entry.d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (entry.color) mesh.setColorAt(i, new THREE.Color(entry.color));
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); scene.add(mesh); return mesh;
}
export function instanceBoxes(scene, material, entries, shadow = true) {
  return instanceGeometry(scene, new THREE.BoxGeometry(1, 1, 1), material, entries, shadow);
}
export function buildSolmarRoads(scene, textures, collision, seed = 1) {
  const road = [], pavement = [], paint = [], yellow = [], rail = [];
  for (const x of STREET_X) {
    const width = x === 160 ? 26 : 18;
    road.push({ x, y: .02, z: 0, w: width, h: .12, d: 1460 });
    for (const side of [-1, 1]) pavement.push({ x: x + side * (width / 2 + 3.1), y: .13, z: 0, w: 6, h: .24, d: 1460 });
    for (let z = -720; z < 720; z += 12) {
      if (STREET_Z.some(cross => Math.abs(cross - z) < 13)) continue;
      for (const side of [-1, 1]) yellow.push({ x: x + side * .25, y: .091, z, w: .14, h: .012, d: 6 });
      if (x === 160) for (const side of [-1, 1]) paint.push({ x: x + side * 6.5, y: .093, z, w: .18, h: .012, d: 5 });
    }
  }
  for (const z of STREET_Z) {
    road.push({ x: -230, y: .025, z, w: 900, h: .12, d: 18 });
    for (const side of [-1, 1]) pavement.push({ x: -230, y: .125, z: z + side * 12, w: 900, h: .24, d: 6 });
    for (let x = -690; x < 210; x += 12) {
      if (STREET_X.some(cross => Math.abs(cross - x) < 20)) continue;
      yellow.push({ x, y: .096, z, w: 5, h: .012, d: .2 });
    }
    for (const x of STREET_X) for (const side of [-1, 1]) for (let i = -6; i <= 6; i += 2) {
      paint.push({ x: x + i, y: .1, z: z + side * 12, w: 1, h: .012, d: 4 });
    }
  }
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#e6e8ea', map: textures.asphalt(), roughness: .78 }), road, false);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#b8b4a9', roughness: .92 }), pavement, false);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#e0ddd0', roughness: .9 }), paint, false);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#ddb35a', roughness: .85 }), yellow, false);
  // An elevated highway traverses the street grid; supports are real colliders.
  const highway = [{ x: -240, y: 7, z: 360, w: 900, h: .7, d: 19 }];
  for (let x = -650; x < 190; x += 75) {
    rail.push({ x, y: 3.4, z: 360, w: 2, h: 6.5, d: 9 });
    collision.add({ x: x - 1, y: 0, z: 355.5 }, { x: x + 1, y: 7, z: 364.5 }, 'overpass-pillar');
  }
  for (const side of [-1, 1]) highway.push({ x: -240, y: 7.8, z: 360 + side * 9.2, w: 900, h: 1, d: .4 });
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#8f9896', roughness: .8 }), [...highway, ...rail]);
  collision.add({ x: -690, y: 6.65, z: 350.5 }, { x: 210, y: 7.35, z: 369.5 }, 'overpass-deck');
  const bridge = [];
  for (const side of [-1, 1]) bridge.push({ x: 370, y: 1.7, z: -540 + side * 9, w: 310, h: .6, d: .5 });
  bridge.push({ x: 370, y: 1, z: -540, w: 310, h: .7, d: 18 });
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#b8b9ac', roughness: .8 }), bridge);
  const boardwalk = [{ x: 207, y: .14, z: 0, w: 19, h: .25, d: 1380 }];
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#b99371', roughness: .86 }), boardwalk, false);
  return createRoadGraph(seed);
}
