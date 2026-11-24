// Sunset Syndicate: ordered systems, fixed-budget entities, deterministic Solmar Bay.
import * as THREE from '../vendor/three.module.min.js';
import { SeededRandom } from './core/rng.js';
import { EntityPool, SystemRegistry } from './core/registry.js';
import { FixedStepLoop } from './core/loop.js';
import { CityRenderer } from './render/renderer.js';

function bootSunsetSyndicate() {
  const params = new URLSearchParams(location.search);
  const view = new CityRenderer(document.getElementById('game'), params.get('quality') || 'med');
  const game = {
    seed: params.get('seed') || '1', params, view, world: { scene: view.scene },
    entities: new EntityPool(384), systems: new SystemRegistry(),
    player: null, cameraRig: null, wanted: null, missionDirector: null,
    shotReady: false, rng: new SeededRandom(params.get('seed') || '1'),
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#758a80' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  view.scene.add(ground, new THREE.HemisphereLight('#b7d2ec', '#865431', 2));
  const sun = new THREE.DirectionalLight('#ffd5a0', 3);
  sun.position.set(-30, 40, -20);
  sun.castShadow = true;
  view.scene.add(sun);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: '#e9754b', roughness: .35 }));
  marker.position.y = 1;
  marker.castShadow = true;
  view.scene.add(marker);
  game.loop = new FixedStepLoop(dt => game.systems.update(dt, game), (alpha, dt) => view.render(dt, game.loop.time));
  game.step = dt => game.loop.step(dt);
  game.registerSystem = (name, update, order) => game.systems.register(name, update, order);
  game.snapshot = () => ({ seed: game.seed, ticks: game.loop.ticks });
  window.__game = game;
  document.getElementById('boot-message').classList.add('hidden');
  game.loop.start();
}
try { bootSunsetSyndicate(); }
catch (error) { document.getElementById('boot-message').textContent = error.message; }
