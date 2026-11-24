import { WorldCollision } from './collision.js';
import { buildCoastalTerrain } from './terrain.js';
import { buildSolmarRoads } from './roads.js';
import { CityBuildingChunks } from './buildings.js';
import { buildCoastalStreetProps } from './props.js';
import { SolmarSky } from './sky.js';
import { CoastalWater } from './water.js';
import { ProceduralTextures } from '../render/textures.js';
export class SolmarBayWorld {
  constructor(view, rng) {
    this.scene = view.scene;
    this.collision = new WorldCollision();
    this.textures = new ProceduralTextures(rng.fork('textures'));
    this.terrain = buildCoastalTerrain(this.scene);
    this.roads = buildSolmarRoads(this.scene, this.textures, this.collision, rng.fork('roads'));
    this.buildings = new CityBuildingChunks(this.scene, rng.fork('buildings'), this.textures, this.collision);
    this.props = buildCoastalStreetProps(this.scene, rng.fork('palms'), this.collision);
    this.sky = new SolmarSky(this.scene, view.settings);
    this.water = new CoastalWater(this.scene);
    this.landmarks = this.roads.landmarks;
  }
  update(dt, game) {
    this.buildings.update(game.player.position, game.view.quality);
    this.sky.update(dt, game.player.position, !!game.params.get('shot'));
    this.water.update(dt);
    this.props.lampMaterial.emissiveIntensity = this.sky.material.uniforms.night.value ? 2 : .5;
  }
  heightAt(x, z) { return Math.max(.15, this.terrain.heightAt(x, z)); }
}
