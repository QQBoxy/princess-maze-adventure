import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';

export class InputController {
  private readonly scene: Phaser.Scene;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private activePointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private fixedOrigin = new Phaser.Math.Vector2();
  private analog = new Phaser.Math.Vector2();
  private enabled = true;
  private touchMode = window.matchMedia('(pointer: coarse)').matches;
  private readonly canStart: (x: number, y: number) => boolean;
  private readonly cancelListener: () => void;
  private readonly touchRadius = GAME.input.maxDistance + 28;

  constructor(scene: Phaser.Scene, canStart: (x: number, y: number) => boolean) {
    this.scene = scene;
    this.canStart = canStart;
    this.ring = scene.add.circle(0, 0, GAME.input.maxDistance, 0xffffff, 0.12)
      .setStrokeStyle(3, 0xffffff, 0.5).setScrollFactor(0).setDepth(100100).setVisible(this.touchMode);
    this.knob = scene.add.circle(0, 0, 28, 0xffffff, 0.48)
      .setStrokeStyle(2, 0xffffff, 0.75).setScrollFactor(0).setDepth(100101).setVisible(this.touchMode);
    this.layout();

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('gameout', this.cancel, this);
    scene.scale.on('resize', this.layout, this);
    this.cancelListener = () => this.cancel();
    scene.game.canvas.addEventListener('pointercancel', this.cancelListener);
  }

  getVelocity(): Phaser.Math.Vector2 {
    if (!this.enabled) return new Phaser.Math.Vector2();
    const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
    if (x || y) return new Phaser.Math.Vector2(x, y).normalize().scale(GAME.player.maxSpeed);
    return this.analog.clone().scale(GAME.player.maxSpeed);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('gameout', this.cancel, this);
    this.scene.scale.off('resize', this.layout, this);
    this.scene.game.canvas.removeEventListener('pointercancel', this.cancelListener);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const event = pointer.event;
    const mouseInput = event instanceof MouseEvent && (!('pointerType' in event) || event.pointerType === 'mouse');
    if (!this.enabled || this.activePointerId !== null || !this.canStart(pointer.x, pointer.y)
      || (!mouseInput && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.fixedOrigin.x, this.fixedOrigin.y) > this.touchRadius)) return;
    this.activePointerId = pointer.id;
    this.touchMode = !mouseInput;
    this.origin.copy(mouseInput ? new Phaser.Math.Vector2(pointer.x, pointer.y) : this.fixedOrigin);
    this.ring.setPosition(this.origin.x, this.origin.y).setVisible(true);
    this.knob.setPosition(this.origin.x, this.origin.y).setVisible(true);
    this.updateAnalog(pointer.x, pointer.y);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.activePointerId && pointer.isDown) this.updateAnalog(pointer.x, pointer.y);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.activePointerId) this.cancel();
  }

  private updateAnalog(x: number, y: number): void {
    const offset = new Phaser.Math.Vector2(x - this.origin.x, y - this.origin.y);
    const distance = offset.length();
    const factor = Phaser.Math.Clamp(
      (distance - GAME.input.deadZone) / (GAME.input.maxDistance - GAME.input.deadZone), 0, 1,
    );
    this.analog.copy(offset).normalize().scale(factor);
    const visualDistance = Math.min(distance, GAME.input.maxDistance);
    const visual = offset.lengthSq() > 0 ? offset.normalize().scale(visualDistance) : offset;
    this.knob.setPosition(this.origin.x + visual.x, this.origin.y + visual.y);
  }

  private cancel(): void {
    this.activePointerId = null;
    this.analog.set(0, 0);
    this.origin.copy(this.fixedOrigin);
    this.ring.setPosition(this.fixedOrigin.x, this.fixedOrigin.y).setVisible(this.touchMode);
    this.knob.setPosition(this.fixedOrigin.x, this.fixedOrigin.y).setVisible(this.touchMode);
  }

  private layout(): void {
    this.cancel();
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const portrait = height > width;
    this.fixedOrigin.set(portrait ? width / 2 : Math.min(118, width * 0.18), height - 118);
    this.origin.copy(this.fixedOrigin);
    this.ring.setPosition(this.fixedOrigin.x, this.fixedOrigin.y);
    this.knob.setPosition(this.fixedOrigin.x, this.fixedOrigin.y);
  }
}
