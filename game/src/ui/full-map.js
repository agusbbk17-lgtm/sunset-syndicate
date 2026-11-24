export class SolmarFullMap {
  constructor(canvas, minimap) {
    this.canvas = canvas; this.minimap = minimap; this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.addEventListener('click', event => {
      const rect = canvas.getBoundingClientRect(), displayScale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
      const px = (event.clientX - rect.left - (rect.width - canvas.width * displayScale) / 2) / displayScale,
        py = (event.clientY - rect.top - (rect.height - canvas.height * displayScale) / 2) / displayScale;
      const point = { x: (px - canvas.width / 2) / this.scale - 170, z: -(py - canvas.height / 2) / this.scale };
      if (point.x >= -735 && point.x <= 235 && Math.abs(point.z) < 735) this.minimap.setWaypoint(point);
      this.draw();
    });
  }
  draw() {
    const ctx = this.ctx, width = this.canvas.width, height = this.canvas.height;
    this.scale = Math.min(width / 1550, height / 1600);
    const project = (x, z) => ({ x: width / 2 + (x + 170) * this.scale, y: height / 2 - z * this.scale });
    ctx.clearRect(0, 0, width, height); this.minimap.drawBase(ctx, project, true); this.minimap.drawRoute(ctx, project); this.minimap.drawEntities(ctx, project);
    const point = this.minimap.game.player.position, p = project(point.x, point.z);
    ctx.fillStyle = '#fff1d7'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff1d7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke();
  }
}
