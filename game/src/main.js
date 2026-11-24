// Sunset Syndicate — deterministic open world, third-person camera, ordered systems.
import { SeededRandom } from './core/rng.js';
import { EntityPool, SystemRegistry } from './core/registry.js';
import { FixedStepLoop } from './core/loop.js';
import { PlayerInput } from './core/input.js';
import { DeterministicShotDirector } from './core/shots.js';
import { normalizeSettings, loadSave } from './core/save.js';
import { CityRenderer } from './render/renderer.js';
import { CoastalPostFX } from './render/postfx.js';
import { SolmarBayWorld } from './world/city.js';
import { PlayerCharacter } from './entities/player.js';
import { ThirdPersonCameraRig } from './camera/rig.js';
import { CameraDebugOverlay } from './ui/debug.js';
import { VehicleFleet } from './entities/vehicles.js';
import { VehicleCinematicDirector } from './camera/vehicle-cinematic.js';
import { SynthesizedEngineAudio } from './systems/engine-audio.js';
import { AdaptiveQualityGovernor } from './render/auto-quality.js';
import { SunsetInterface } from './ui/menus.js';

function bootSunsetSyndicate() {
  const params = new URLSearchParams(location.search);
  let saved = null;
  try { saved = loadSave(localStorage); } catch { /* Storage can be unavailable in private tabs. */ }
  const settings = normalizeSettings(saved?.settings);
  if (['low', 'med', 'high', 'ultra'].includes(params.get('quality'))) settings.quality = params.get('quality');
  const view = new CityRenderer(document.getElementById('game'), settings.quality);
  view.post = new CoastalPostFX(view.renderer); view.resize();
  const seed = params.get('seed') || saved?.seed || '1';
  const game = {
    seed, params, settings, view,
    entities: new EntityPool(384), systems: new SystemRegistry(),
    player: null, cameraRig: null, wanted: null, missionDirector: null,
    shotReady: false, rng: new SeededRandom(seed),
  };
  game.world = new SolmarBayWorld(view, game.rng.fork('world'));
  game.input = new PlayerInput(document.getElementById('game')); game.input.sensitivity = settings.sensitivity;
  game.player = new PlayerCharacter(game);
  game.cameraRig = new ThirdPersonCameraRig(view.camera, game.player); game.cameraRig.setPreset(settings.cameraPreset);
  game.vehicles = new VehicleFleet(game, 64);
  game.heroCar = game.vehicles.spawn('sports', 153, -105, 0);
  game.vehicleCinematic = new VehicleCinematicDirector();
  game.audio = new SynthesizedEngineAudio(game);
  game.autoQuality = new AdaptiveQualityGovernor(view, settings.autoQuality && !params.has('shot'));
  if (params.has('debug')) game.debug = new CameraDebugOverlay(game);
  game.registerSystem = (name, update, order = 100) => game.systems.register(name, update, order);
  game.components = game.entities.components;
  game.registerComponent = name => game.entities.register(name);
  // Extension order: input 0, vehicles 20, player 30, AI 40, world 50,
  // combat 55, wanted 60, missions 65, camera 80, HUD 100, audio 120.
  game.registerSystem('input', dt => game.input.sampleGamepad(dt), 0);
  game.registerSystem('interface-controls', () => game.ui?.pollControls(), 5);
  game.registerSystem('vehicle-physics', dt => game.vehicles.updatePhysics(dt), 20);
  game.registerSystem('player', dt => game.player.update(dt, game), 30);
  game.registerSystem('vehicle-enter-exit', dt => game.vehicles.updateInteraction(dt), 35);
  game.registerSystem('world', dt => game.world.update(dt, game), 50);
  game.registerSystem('third-person-camera', dt => game.cameraRig.update(dt, game), 80);
  game.registerSystem('interface-autosave', dt => game.ui?.update(dt), 100);
  game.registerSystem('engine-audio', dt => game.audio.update(dt), 120);
  game.registerSystem('input-end-tick', () => game.input.endTick(), 1000);
  game.backdropTime = 0; game.backdropAccumulator = 0;
  game.loop = new FixedStepLoop(dt => game.systems.update(dt, game), (alpha, dt) => {
    if (game.loop.paused && !game.loop.manual) {
      game.input.sampleGamepad(dt); game.ui?.pollControls();
      game.backdropAccumulator += dt;
      while (game.backdropAccumulator >= 1 / 60) {
        game.backdropAccumulator -= 1 / 60; game.backdropTime += 1 / 60;
        game.world.sky.update(1 / 60, game.player.position);
        game.world.water.update(1 / 60);
      }
      game.input.endTick();
    }
    game.player.present(alpha); game.vehicles.present(alpha);
    game.cameraRig.present(alpha, game); view.render(dt, game.loop.time + game.backdropTime);
    game.ui?.present(dt);
    game.debug?.update();
    if (!game.loop.manual) game.autoQuality.update(dt);
  });
  game.step = (dt, present = true) => game.loop.step(dt, present);
  game.camera = view.camera;
  game.vehicles.seatPlayer(game.heroCar);
  game.ui = new SunsetInterface(game, saved);
  game.hud = game.ui.hud;
  game.snapshot = () => ({ seed: game.seed, ticks: game.loop.ticks,
    player: { position: game.player.position.toArray(), heading: game.player.heading, mode: game.player.mode },
    camera: { position: game.cameraRig.position.toArray(), ...game.cameraRig.debug },
    vehicle: game.player.vehicle ? { position: game.player.vehicle.position.toArray(), speed: game.player.vehicle.speed,
      gear: game.player.vehicle.gear, rpm: game.player.vehicle.rpm } : null,
    entities: game.entities.count, buildings: game.world.buildings.count });
  game.shots = new DeterministicShotDirector(game);
  game.shots.registerPose('onfoot', g => {
    if (g.player.vehicle) g.player.vehicle.driver = null;
    g.player.mode = 'foot'; g.player.vehicle = null;
    g.player.teleport(194, .15, -105, 0); g.world.sky.timeOfDay = 17.2;
  });
  game.shots.registerPose('boulevard', g => { g.player.teleport(148, .15, -105, 0); g.world.sky.timeOfDay = 17.2; });
  game.shots.registerHook((name, g) => {
    if (['boulevard', 'start', 'play'].includes(name)) {
      g.heroCar.position.set(153, .15, -105); g.heroCar.previous.copy(g.heroCar.position);
      g.vehicles.seatPlayer(g.heroCar);
    }
  });
  window.__game = game;
  document.getElementById('boot-message').classList.add('hidden');
  if (params.has('shot')) { game.ui.show('playing'); game.shots.seek(params.get('shot')); }
  else game.step(1 / 60);
  let wasLocked = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    if (wasLocked && !locked && game.ui.screen === 'playing') game.ui.show('pause');
    wasLocked = locked;
  });
  game.loop.start();
}
try { bootSunsetSyndicate(); }
catch (error) { document.getElementById('boot-message').textContent = `Unable to start: ${error.message}`; }
