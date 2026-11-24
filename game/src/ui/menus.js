import { SunsetHUD } from './hud.js';
import { SolmarFullMap } from './full-map.js';
import { storeSave } from '../core/save.js';
export class SunsetInterface {
  constructor(game, saved) {
    this.game = game; this.saved = saved; this.screen = 'main'; this.backScreen = 'main'; this.saveTimer = 0;
    const parent = document.getElementById('ui'); this.hud = new SunsetHUD(game, parent);
    this.root = document.createElement('div'); this.root.id = 'screens';
    this.root.innerHTML = `
      <section id="screen-main" class="screen main-menu">
        <div class="menu-kicker"><i></i> A SOLMAR BAY STORY</div>
        <h1>SUNSET<br><span>SYNDICATE</span></h1><p class="menu-description">A city of salt, steel, and second chances.<br>Make the coast your own.</p>
        <div class="menu-actions"><button data-action="start" class="primary">ENTER SOLMAR BAY <span>↗</span></button><button data-action="continue" id="continue-button">CONTINUE</button><button data-action="settings">SETTINGS</button><button data-action="controls">CONTROLS</button></div>
        <div class="menu-footer"><b>17:12 · GOLDEN HOUR</b><span>ORIGINAL OPEN WORLD · KEYBOARD + MOUSE</span></div>
      </section>
      <section id="screen-pause" class="screen panel-screen" hidden><div class="panel"><small>SUNSET SYNDICATE</small><h2>OFF THE CLOCK.</h2><p>Solmar Bay will wait.</p><button class="primary" data-action="resume">RESUME</button><button data-action="map">CITY MAP</button><button data-action="settings">SETTINGS</button><button data-action="controls">CONTROLS</button><button data-action="save">SAVE GAME</button><button data-action="main">MAIN MENU</button><span id="save-notice"></span></div></section>
      <section id="screen-settings" class="screen panel-screen" hidden><div class="panel settings-panel"><small>MAKE IT YOUR COAST</small><h2>SETTINGS</h2>
        <label>Quality<select id="setting-quality"><option value="low">Low</option><option value="med">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></label>
        <label>Camera distance<select id="setting-camera"><option value="0">Near</option><option value="1">Medium</option><option value="2">Far</option></select></label>
        <label>Vertical field of view <output id="fov-value"></output><input id="setting-fov" type="range" min="50" max="80" step="1"></label>
        <label>Look sensitivity<input id="setting-sensitivity" type="range" min="0.25" max="2" step="0.05"></label>
        <label>Master volume<input id="setting-volume" type="range" min="0" max="1" step="0.05"></label>
        <label>Engine volume<input id="setting-engineVolume" type="range" min="0" max="1" step="0.05"></label>
        <label class="check-label">Reduce motion<input id="setting-reduceMotion" type="checkbox"></label>
        <label class="check-label">Adaptive quality<input id="setting-autoQuality" type="checkbox" checked></label>
        <button class="primary" data-action="back">BACK</button></div></section>
      <section id="screen-map" class="screen map-screen" hidden><header><div><small>SOLMAR BAY</small><h2>THE WHOLE COAST.</h2></div><button data-action="resume">BACK TO STREETS</button></header><canvas id="full-map" width="1100" height="720"></canvas><footer>CLICK LAND TO SET A WAYPOINT <button data-action="clear-waypoint">CLEAR ROUTE</button><span>M / ESC · CLOSE</span></footer></section>
      <section id="screen-controls" class="screen panel-screen" hidden><div class="panel controls-panel"><small>LEARN THE STREETS</small><h2>CONTROLS</h2><dl>
        <dt>WASD / left stick</dt><dd>Walk / drive</dd><dt>Mouse / right stick</dt><dd>Look around · click the world to capture mouse</dd><dt>Shift / left stick click</dt><dd>Sprint</dd><dt>Space / A</dt><dd>Jump / handbrake</dd><dt>C / B</dt><dd>Crouch</dd><dt>E or F / X</dt><dd>Enter / exit a nearby stopped vehicle</dd><dt>V / Y</dt><dd>Near / Medium / Far camera · hold in car for cinematic</dd><dt>B</dt><dd>Hold to look behind while driving</dd><dt>Right mouse / X key</dt><dd>Aim framing / swap shoulder</dd><dt>M / View</dt><dd>Map and waypoint</dd><dt>Escape / Menu</dt><dd>Pause</dd></dl><button class="primary" data-action="back">BACK</button></div></section>`;
    parent.append(this.root);
    this.panels = new Map([...this.root.querySelectorAll('.screen')].map(element => [element.id.slice(7), element]));
    this.fullMap = new SolmarFullMap(this.root.querySelector('#full-map'), this.hud.minimap);
    this.root.querySelector('#continue-button').hidden = !saved?.position;
    this.root.addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) this.action(action); });
    this.setupSettings(); this.show('main');
  }
  setupSettings() {
    const game = this.game;
    const fields = { quality: 'quality', camera: 'cameraPreset', fov: 'fov', sensitivity: 'sensitivity', volume: 'volume', engineVolume: 'engineVolume', reduceMotion: 'reduceMotion', autoQuality: 'autoQuality' };
    for (const [id, key] of Object.entries(fields)) {
      const field = this.root.querySelector(`#setting-${id}`);
      if (field.type === 'checkbox') field.checked = game.settings[key];
      else field.value = game.settings[key];
      field.addEventListener('input', () => {
        game.settings[key] = field.type === 'checkbox' ? field.checked : id === 'quality' ? field.value : Number(field.value);
        if (key === 'quality') { game.view.setQuality(game.settings.quality); game.autoQuality.reset(); }
        if (key === 'cameraPreset') game.cameraRig.setPreset(game.settings.cameraPreset);
        if (key === 'sensitivity') game.input.sensitivity = game.settings.sensitivity;
        if (key === 'autoQuality') game.autoQuality.enabled = game.settings.autoQuality && !game.params.has('shot');
        this.root.querySelector('#fov-value').textContent = `${game.settings.fov}°`;
        game.audio.update(); this.save(false);
      });
    }
    this.root.querySelector('#fov-value').textContent = `${game.settings.fov}°`;
  }
  show(screen) {
    this.screen = screen;
    for (const [name, panel] of this.panels) panel.hidden = name !== screen;
    this.hud.root.hidden = screen !== 'playing'; this.game.loop.paused = screen !== 'playing';
    this.game.input.enabled = screen === 'playing'; this.game.input.clear();
    this.game.audio.setPaused(screen !== 'playing');
    if (screen !== 'playing' && document.pointerLockElement) document.exitPointerLock();
    if (screen === 'map') this.fullMap.draw();
    if (screen === 'settings') {
      this.game.settings.cameraPreset = this.game.cameraRig.preset;
      this.root.querySelector('#setting-camera').value = this.game.cameraRig.preset;
    }
  }
  start(animate = true) {
    this.show('playing');
    this.game.audio.start();
    if (animate && !this.game.settings.reduceMotion) this.game.cameraRig.beginOpening();
  }
  action(action) {
    this.game.audio.blip();
    if (action === 'start') this.start();
    else if (action === 'continue') { this.restore(); this.start(false); }
    else if (action === 'resume') this.show('playing');
    else if (action === 'main') this.show('main');
    else if (action === 'settings' || action === 'controls') { this.backScreen = this.screen; this.show(action); }
    else if (action === 'back') this.show(this.backScreen);
    else if (action === 'map') this.show('map');
    else if (action === 'clear-waypoint') { this.hud.minimap.setWaypoint(null); this.fullMap.draw(); }
    else if (action === 'save') this.save(true);
  }
  save(notify = false) {
    const player = this.game.player;
    this.game.settings.cameraPreset = this.game.cameraRig.preset;
    const progress = this.screen === 'main' || this.backScreen === 'main' && this.screen === 'settings';
    const data = progress ? { ...this.saved, seed: this.game.seed, settings: { ...this.game.settings } } :
      { seed: this.game.seed, settings: { ...this.game.settings }, position: player.position.toArray(), heading: player.heading,
      cash: player.cash, health: player.health, armour: player.armour,
      vehicle: player.vehicle ? { type: player.vehicle.type, position: player.vehicle.position.toArray(), heading: player.vehicle.heading } : null };
    let ok = false; try { ok = storeSave(localStorage, data); } catch { /* No persistence is a supported browser mode. */ }
    if (ok) { this.saved = data; this.root.querySelector('#continue-button').hidden = !data.position; }
    if (notify) this.root.querySelector('#save-notice').textContent = ok ? 'PROGRESS SAVED' : 'STORAGE UNAVAILABLE';
    return ok;
  }
  restore() {
    const save = this.saved, player = this.game.player;
    if (!save || !Array.isArray(save.position) || save.position.length !== 3 || !save.position.every(Number.isFinite)) return;
    if (save.vehicle && Array.isArray(save.vehicle.position) && save.vehicle.position.length === 3 && save.vehicle.position.every(Number.isFinite)) {
      const car = this.game.vehicles.cars.find(candidate => candidate.type === save.vehicle.type) ||
        this.game.vehicles.spawn(save.vehicle.type, save.vehicle.position[0], save.vehicle.position[2]) || this.game.heroCar;
      car.position.fromArray(save.vehicle.position); car.previous.copy(car.position); car.velocity.set(0, 0, 0); car.speed = 0;
      car.heading = car.previousHeading = Number.isFinite(save.vehicle.heading) ? save.vehicle.heading : 0; this.game.vehicles.seatPlayer(car);
    } else {
      if (player.vehicle) player.vehicle.driver = null; player.mode = 'foot'; player.vehicle = null;
      player.teleport(...save.position, Number.isFinite(save.heading) ? save.heading : 0); this.game.cameraRig.reset(player);
    }
    player.cash = Number.isFinite(save.cash) ? Math.max(0, save.cash) : 250;
    player.health = Number.isFinite(save.health) ? Math.max(0, Math.min(100, save.health)) : 100;
    player.armour = Number.isFinite(save.armour) ? Math.max(0, Math.min(100, save.armour)) : 50;
  }
  pollControls() {
    if (this.game.input.consume('Enter') && this.screen === 'main') this.action(this.saved?.position ? 'continue' : 'start');
    if (this.game.input.consume('Escape')) this.show(this.screen === 'playing' ? 'pause' : this.screen === 'pause' || this.screen === 'map' ? 'playing' : this.backScreen === 'playing' ? 'pause' : this.backScreen);
    if (this.game.input.consume('KeyM')) this.show(this.screen === 'map' ? 'playing' : 'map');
  }
  update(dt) {
    if (this.screen === 'playing') {
      this.saveTimer += dt; if (this.saveTimer > 15) { this.save(false); this.saveTimer = 0; }
    }
  }
  present(dt) { if (this.screen === 'playing') this.hud.update(dt); }
}
