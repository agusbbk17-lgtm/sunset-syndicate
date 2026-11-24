import { SolmarMinimap } from './minimap.js';
export class SunsetHUD {
  constructor(game, parent) {
    this.game = game; this.root = document.createElement('section'); this.root.id = 'hud';
    this.root.innerHTML = `
      <header class="hud-brand"><b>SUNSET <span>SYNDICATE</span></b><small>SOLMAR BAY · <span id="district">PEARL BOULEVARD</span></small></header>
      <aside class="hud-status"><div id="wanted-stars" aria-label="Wanted level">☆ ☆ ☆ ☆ ☆</div><strong id="cash">$250</strong><small id="weapon">UNARMED</small></aside>
      <aside class="hud-objective"><small id="objective-tag">FREE ROAM</small><strong id="objective-title">The bay is yours.</strong><span id="objective-distance"></span></aside>
      <div class="hud-vitals"><span>HEALTH <b id="health-label">100</b></span><div class="bar"><i id="health-bar"></i></div><span>ARMOUR <b id="armour-label">50</b></span><div class="bar armour"><i id="armour-bar"></i></div></div>
      <div class="minimap-shell"><canvas id="minimap" width="224" height="224"></canvas><span class="map-north">N</span><small>SOLMAR BAY</small></div>
      <aside class="speedometer"><strong id="speed">0</strong><span>KM/H</span><b id="gear">N</b><small id="vehicle-name"></small><div class="rpm-track"><i id="rpm-bar"></i></div></aside>
      <div id="context-prompt"></div><div id="subtitles"></div><div id="crosshair">+</div>
      <footer class="control-strip"><span>WASD <b>MOVE / DRIVE</b></span><span>E <b>ENTER / EXIT</b></span><span>V <b>CAMERA</b></span><span>M <b>MAP</b></span><span>ESC <b>PAUSE</b></span></footer>
      <div id="letterbox-top"></div><div id="letterbox-bottom"></div>`;
    parent.append(this.root);
    this.elements = new Map([...this.root.querySelectorAll('[id]')].map(element => [element.id, element]));
    this.minimap = new SolmarMinimap(this.elements.get('minimap'), game);
    this.refreshTime = 0; this.speedometer = this.root.querySelector('.speedometer');
  }
  text(id, value) { const element = this.elements.get(id); if (element.textContent !== String(value)) element.textContent = String(value); }
  update(dt) {
    const game = this.game, player = game.player, car = player.vehicle;
    this.text('cash', `$${Math.round(player.cash).toLocaleString('en-US')}`);
    const level = game.wanted?.stars ?? game.wanted?.level ?? 0;
    this.text('wanted-stars', Array.from({ length: 5 }, (_, index) => index < level ? '★' : '☆').join(' '));
    this.elements.get('wanted-stars').classList.toggle('wanted', level > 0);
    this.text('health-label', Math.round(player.health)); this.text('armour-label', Math.round(player.armour));
    this.elements.get('health-bar').style.width = `${Math.max(0, player.health)}%`;
    this.elements.get('armour-bar').style.width = `${Math.max(0, player.armour)}%`;
    const weapon = game.weapons?.current;
    this.text('weapon', weapon ? `${weapon.name} · ${weapon.ammo ?? ''}` : 'UNARMED');
    this.elements.get('crosshair').style.display = player.aiming ? 'block' : 'none';
    this.speedometer.classList.toggle('visible', !!car);
    if (car) {
      this.text('speed', Math.round(Math.abs(car.speed) * 3.6)); this.text('gear', car.gear < 0 ? 'R' : car.gear);
      this.text('vehicle-name', car.name.toUpperCase()); this.elements.get('rpm-bar').style.width = `${Math.min(100, car.rpm / 6500 * 100)}%`;
    }
    const objective = game.missionDirector?.hudObjective || game.objective;
    if (objective) {
      this.text('objective-tag', objective.tag || 'OBJECTIVE'); this.text('objective-title', objective.title || objective.text || '');
      const point = objective.position || objective.target;
      const distance = point ? Math.hypot(point.x - player.position.x, point.z - player.position.z) : objective.distance;
      this.text('objective-distance', Number.isFinite(distance) ? `${Math.round(distance)} M` : '');
    } else if (game.waypoint) {
      this.text('objective-tag', 'WAYPOINT'); this.text('objective-title', game.waypoint.label);
      this.text('objective-distance', `${Math.round(Math.hypot(game.waypoint.x - player.position.x, game.waypoint.z - player.position.z))} M`);
    } else { this.text('objective-tag', 'FREE ROAM'); this.text('objective-title', 'The bay is yours.'); this.text('objective-distance', ''); }
    this.text('district', player.position.z < -400 ? 'CINDER DOCKS' : player.position.x > 190 ? 'CORAL BOARDWALK' : player.position.x > 100 ? 'PEARL BOULEVARD' : player.position.x < -250 ? 'WEST SOLMAR' : 'DOWNTOWN');
    const nearest = !car ? game.vehicles.nearest(player.position) : null;
    this.text('context-prompt', game.vehicles.transition ? player.mode === 'entering' ? 'Getting in…' : 'Stepping out…' : nearest ? `E · DRIVE ${nearest.name.toUpperCase()}` : car ? 'SPACE · HANDBRAKE   B · LOOK BEHIND   HOLD V · CINEMATIC' : 'SHIFT · SPRINT   SPACE · JUMP   RMB · AIM');
    this.text('subtitles', game.missionDirector?.subtitle || game.subtitle || '');
    this.root.classList.toggle('letterboxed', game.cameraRig.cinematic || !!game.cameraDirector?.letterbox);
    this.refreshTime += dt;
    if (this.refreshTime > .07 || game.loop.manual) { this.minimap.update(); this.refreshTime = 0; }
  }
}
