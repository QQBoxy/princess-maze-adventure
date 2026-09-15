import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';
import type { Cell } from './MapGenerator';
import type { Princess } from '../entities/Princess';

export class Goal {
  readonly sprite: Phaser.GameObjects.Image;
  readonly zone: Phaser.GameObjects.Zone;
  private glow: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, cell: Cell, player: Princess, onReached: () => void) {
    const tile = GAME.map.tileSize;
    const x = (cell.x + 0.5) * tile;
    const y = (cell.y + 0.5) * tile;
    this.glow = scene.add.circle(x, y + 12, 76, 0xfff1a8, 0.18).setDepth(y - 2);
    this.sprite = scene.add.image(x, y - 18, 'castle').setDepth(y);
    this.zone = scene.add.zone(x, y + 32, 86, 54);
    scene.physics.add.existing(this.zone, true);
    scene.physics.add.overlap(player, this.zone, onReached);
    scene.tweens.add({ targets: [this.glow], alpha: { from: 0.12, to: 0.35 }, scale: { from: 0.9, to: 1.08 }, duration: 1100, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 5, duration: 900, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
  }
}
