import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';

export class Princess extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'princess');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(GAME.player.radius, this.width / 2 - GAME.player.radius, this.height - GAME.player.radius * 2 - 4);
    this.setCollideWorldBounds(true).setDepth(30);
  }

  move(velocity: Phaser.Math.Vector2): void {
    this.setVelocity(velocity.x, velocity.y);
    this.setDepth(this.y);
    if (Math.abs(velocity.x) > 8) this.setFlipX(velocity.x < 0);
    const moving = velocity.lengthSq() > 25;
    this.setAngle(moving ? Math.sin(this.scene.time.now / 110) * 2.5 : 0);
  }
}
