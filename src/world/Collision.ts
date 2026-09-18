import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';
import type { GeneratedMap } from './MapGenerator';

export class CollisionSystem {
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, map: GeneratedMap, theme: 'meadow' | 'forest') {
    this.obstacles = scene.physics.add.staticGroup();
    const tile = GAME.map.tileSize;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.cells[y][x] !== 'blocked') continue;
        const isRock = this.hash(x, y) % 5 === 0;
        const jitterX = (this.hash(x + 11, y) % 17) - 8;
        const jitterY = (this.hash(x, y + 17) % 13) - 6;
        const object = this.obstacles.create(
          (x + 0.5) * tile + jitterX,
          (y + 0.5) * tile + jitterY,
          theme === 'forest' ? (isRock ? 'mossRock' : 'forestTree') : (isRock ? 'rock' : 'tree'),
        ) as Phaser.Physics.Arcade.Sprite;
        object.setDepth(object.y);
        const body = object.body as Phaser.Physics.Arcade.StaticBody;
        if (isRock) body.setCircle(24, object.width / 2 - 24, object.height / 2 - 18);
        else body.setCircle(25, object.width / 2 - 25, object.height - 55);
        body.updateFromGameObject();
      }
    }
  }

  private hash(x: number, y: number): number {
    return Math.abs((x * 73856093) ^ (y * 19349663));
  }
}
