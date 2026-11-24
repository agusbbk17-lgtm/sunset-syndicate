// Sunset Syndicate — deterministic open world, third-person camera, ordered systems.
import { SeededRandom } from './core/rng.js';
import { EntityPool, SystemRegistry } from './core/registry.js';
import { FixedStepLoop } from './core/loop.js';
import { PlayerInput } from './core/input.js';
import { DeterministicShotDirector } from './core/shots.js';
import { DEFAULT_SETTINGS, loadSave } from './core/save.js';
import { CityRenderer } from './render/renderer.js';
import { CoastalPostFX } from './render/postfx.js';
import { SolmarBayWorld } from './world/city.js';
import { PlayerCharacter } from './entities/player.js';
import { ThirdPersonCameraRig } from './camera/rig.js';
import { CameraDebugOverlay } from './ui/debug.js';

function bootSunsetSyndicate() {
  const params = new URLSearchParams(location.search);
  let saved = null;
  try { saved = loadSave(localStorage); } catch { /* Storage can be unavailable in private tabs. */ }
  const settings = { ...DEFAULT_SETTINGS, ...saved?.settings };
  settings.quality = params.get('quality') || settings.quality;
  const view = new CityRenderer(document.getElementById('game'), settings.quality);
  view.post = new CoastalPostFX(view.renderer); view.resize();
  const game = {
    seed: params.get('seed') || '1', params, settings, view,
    entities: new EntityPool(384), systems: new SystemRegistry(),
    player: null, cameraRig: null, wanted: null, missionDirector: null,
    shotReady: false, rng: new SeededRandom(params.get('seed') || '1'),
  };
  game.world = new SolmarBayWorld(view, game.rng.fork('world'));
  game.input = new PlayerInput(document.getElementById('game')); game.input.sensitivity = settings.sensitivity;
  game.player = new PlayerCharacter(game);
  game.cameraRig = new ThirdPersonCameraRig(view.camera, game.player); game.cameraRig.setPreset(settings.cameraPreset);
  if (params.has('debug')) game.debug = new CameraDebugOverlay(game);
  game.registerSystem = (name, update, order = 100) => game.systems.register(name, update, order);
  // Extension order: input 0, vehicles 20, player 30, AI 40, world 50,
  // combat 55, wanted 60, missions 65, camera 80, HUD 100, audio 120.
  game.registerSystem('input', dt => game.input.sampleGamepad(dt), 0);
  game.registerSystem('player', dt => game.player.update(dt, game), 30);
  game.registerSystem('world', dt => game.world.update(dt, game), 50);
  game.registerSystem('third-person-camera', dt => game.cameraRig.update(dt, game), 80);
  game.registerSystem('input-end-tick', () => game.input.endTick(), 1000);
  game.loop = new FixedStepLoop(dt => game.systems.update(dt, game), (alpha, dt) => {
    game.player.present(alpha); game.cameraRig.present(alpha, game); view.render(dt, game.loop.time);
    game.debug?.update();
  });
  game.step = (dt, present = true) => game.loop.step(dt, present);
  game.snapshot = () => ({ seed: game.seed, ticks: game.loop.ticks,
    player: { position: game.player.position.toArray(), heading: game.player.heading, mode: game.player.mode },
    camera: { position: game.cameraRig.position.toArray(), ...game.cameraRig.debug },
    entities: game.entities.count, buildings: game.world.buildings.count });
  game.shots = new DeterministicShotDirector(game);
  game.shots.registerPose('onfoot', g => { g.player.teleport(194, .15, -105, 0); g.world.sky.timeOfDay = 17.2; });
  game.shots.registerPose('boulevard', g => { g.player.teleport(148, .15, -105, 0); g.world.sky.timeOfDay = 17.2; });
  window.__game = game;
  document.getElementById('boot-message').classList.add('hidden');
  if (params.has('shot')) game.shots.seek(params.get('shot'));
  game.loop.start();
}
try { bootSunsetSyndicate(); }
catch (error) { document.getElementById('boot-message').textContent = `Unable to start: ${error.message}`; }
