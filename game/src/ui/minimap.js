import { findRoadRoute } from '../world/roads.js';
export class SolmarMinimap {
  constructor(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.game = game; this.route = []; this.waypoint = null;
  }
  setWaypoint(point, label = 'Custom waypoint') {
    this.waypoint = point ? { x: point.x, z: point.z, label } : null;
    this.route = point ? findRoadRoute(this.game.world.roads, this.game.player.position, point) : [];
    this.game.waypoint = this.waypoint;
  }
  drawBase(ctx, project, detailed = false) {
    ctx.fillStyle = '#183d49'; ctx.fillRect(-3000, -3000, 6000, 6000);
    const northwest = project(-750, 750), southeast = project(250, -750);
    ctx.fillStyle = '#333f41'; ctx.fillRect(northwest.x, northwest.y, southeast.x - northwest.x, southeast.y - northwest.y);
    const coastA = project(190, 750), coastB = project(250, -750);
    ctx.fillStyle = '#927d59'; ctx.fillRect(coastA.x, coastA.y, coastB.x - coastA.x, coastB.y - coastA.y);
    const parkA = project(-370, 655), parkB = project(-270, 335);
    ctx.fillStyle = '#375b48'; ctx.fillRect(parkA.x, parkA.y, parkB.x - parkA.x, parkB.y - parkA.y);
    const scale = Math.abs(project(1, 0).x - project(0, 0).x);
    ctx.strokeStyle = '#697c7c'; ctx.lineWidth = Math.max(2, 17 * scale); ctx.lineCap = 'square';
    ctx.beginPath();
    for (const edge of this.game.world.roads.edges) {
      const a = this.game.world.roads.nodes[edge.from], b = this.game.world.roads.nodes[edge.to];
      const pa = project(a.x, a.z), pb = project(b.x, b.z); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#9a9690'; ctx.lineWidth = Math.max(2, 12 * scale);
    const a = project(-690, 360), b = project(210, 360); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#c1c9c5'; ctx.font = 'bold 11px Arial';
    for (const [name, point] of Object.entries(this.game.world.landmarks)) {
      const p = project(point.x, point.z); ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      if (detailed) ctx.fillText(name.toUpperCase(), p.x + 8, p.y - 5);
    }
  }
  drawRoute(ctx, project) {
    if (!this.waypoint) return;
    ctx.strokeStyle = '#f6b368'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const edge of this.route) {
      const a = this.game.world.roads.nodes[edge.from], b = this.game.world.roads.nodes[edge.to];
      const pa = project(a.x, a.z), pb = project(b.x, b.z); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
    const p = project(this.waypoint.x, this.waypoint.z); ctx.fillStyle = '#ffbb75';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  drawEntities(ctx, project) {
    for (const car of this.game.vehicles?.cars || []) {
      const p = project(car.position.x, car.position.z); ctx.fillStyle = car.type === 'police' ? '#77a5ff' : '#bbc6bd';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    for (const entity of this.game.entities.query('pedestrian', 'transform')) {
      const point = this.game.entities.get(entity, 'transform'), p = project(point.x, point.z); ctx.fillStyle = '#d3ccb8'; ctx.fillRect(p.x, p.y, 2, 2);
    }
  }
  update() {
    const ctx = this.ctx, player = this.game.player, size = this.canvas.width, radius = size / 2;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(radius, radius);
    ctx.beginPath(); ctx.arc(0, 0, radius - 4, 0, Math.PI * 2); ctx.clip(); ctx.rotate(-player.heading);
    const scale = player.vehicle ? .54 : .78;
    const project = (x, z) => ({ x: (x - player.position.x) * scale, y: -(z - player.position.z) * scale });
    this.drawBase(ctx, project); this.drawRoute(ctx, project); this.drawEntities(ctx, project);
    const wanted = this.game.wanted;
    if (wanted?.searching && Math.floor(this.game.loop.time * 3) % 2 === 0) {
      ctx.fillStyle = '#75a7ff35'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 100, -2.1, -1.04); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); ctx.save(); ctx.translate(radius, radius); ctx.fillStyle = '#fbefe0'; ctx.strokeStyle = '#182a30'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const north = this.canvas.parentElement.querySelector('.map-north'), displayRadius = this.canvas.clientWidth / 2;
    if (north) {
      north.style.left = `${displayRadius - 3 - Math.sin(player.heading) * (displayRadius - 14)}px`;
      north.style.top = `${displayRadius - 5 - Math.cos(player.heading) * (displayRadius - 14)}px`;
    }
  }
}
