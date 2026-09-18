import Phaser from 'phaser';
import { alignArt } from '../config/ArtAlignment';

export class QuestHud {
  private static readonly ICON_SIZE = 34;
  private static readonly PAD_SIZE = 39;
  private static readonly STEP_SPACING = 64;
  private static readonly HORIZONTAL_PADDING = 20;
  private readonly scene: Phaser.Scene;
  private readonly icons: Phaser.GameObjects.Image[];
  private readonly iconPads: Phaser.GameObjects.Rectangle[];
  private readonly arrows: Phaser.GameObjects.Text[] = [];
  private readonly backing: Phaser.GameObjects.Rectangle;
  private readonly steps: string[];
  private readonly simultaneousCount: number;
  private done: boolean[];

  constructor(scene: Phaser.Scene, steps: string[], simultaneousCount = 0) {
    this.scene = scene;
    this.steps = steps;
    this.simultaneousCount = simultaneousCount;
    this.done = steps.map(() => false);
    const backingWidth = QuestHud.PAD_SIZE + (steps.length - 1) * QuestHud.STEP_SPACING
      + QuestHud.HORIZONTAL_PADDING;
    this.backing = scene.add.rectangle(0, 0, backingWidth, 48, 0x233c31, 0.97)
      .setStrokeStyle(2, 0xffefae, 0.55).setScrollFactor(0).setDepth(100179);
    this.iconPads = steps.map(() => scene.add.rectangle(0, 0, QuestHud.PAD_SIZE, QuestHud.PAD_SIZE, 0x45634e, 1)
      .setStrokeStyle(1, 0xe0d7a2, 0.6).setScrollFactor(0).setDepth(100180));
    this.icons = steps.map((texture) => alignArt(scene.add.image(0, 0, texture)).setDisplaySize(QuestHud.ICON_SIZE, QuestHud.ICON_SIZE)
      .setScrollFactor(0).setDepth(100181));
    for (let i = 0; i < steps.length - 1; i += 1) {
      const connector = i < simultaneousCount - 1 ? '+' : '›';
      this.arrows.push(scene.add.text(0, 0, connector, { fontFamily: 'sans-serif', fontSize: '27px', color: '#fff2c4' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(100181));
    }
    this.layout();
    this.refresh();
    scene.scale.on('resize', this.layout, this);
  }

  setDone(index: number): void {
    if (this.done[index]) return;
    this.done[index] = true;
    this.refresh();
    const icon = this.icons[index];
    const { scaleX, scaleY } = icon;
    this.scene.tweens.add({ targets: icon,
      scaleX: { from: scaleX * 1.3, to: scaleX }, scaleY: { from: scaleY * 1.3, to: scaleY },
      duration: 380, ease: 'Back.out' });
  }

  setIcon(index: number, texture: string): void {
    const icon = this.icons[index];
    this.scene.tweens.killTweensOf(icon);
    alignArt(icon.setTexture(texture));
    this.layout();
    this.refresh();
  }

  highlightNext(): void {
    const index = this.done.findIndex((done) => !done);
    if (index < 0) return;
    const targets = index < this.simultaneousCount
      ? this.icons.filter((_icon, step) => step < this.simultaneousCount && !this.done[step])
      : [this.icons[index]];
    targets.forEach((icon) => {
      const { scaleX, scaleY } = icon;
      this.scene.tweens.add({ targets: icon, alpha: { from: 0.5, to: 1 },
        scaleX: { from: scaleX, to: scaleX * 1.2 }, scaleY: { from: scaleY, to: scaleY * 1.2 },
        duration: 170, yoyo: true, repeat: 2, onComplete: () => this.refresh() });
    });
  }

  destroy(): void { this.scene.scale.off('resize', this.layout, this); }

  private refresh(): void {
    const current = this.done.findIndex((done) => !done);
    this.icons.forEach((icon, index) => {
      const available = index === current || index < this.simultaneousCount;
      const completed = this.done[index];
      icon.setTint(available || completed ? 0xffffff : 0x8a9290);
      icon.setAlpha(completed ? 1 : available ? 0.88 : 0.56);
      this.iconPads[index].setFillStyle(completed ? 0x796f49 : available ? 0x45634e : 0x365645, 1)
        .setStrokeStyle(completed ? 3 : 1, completed ? 0xffde77 : 0xe0d7a2, completed ? 1 : 0.6);
    });
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const landscape = width > this.scene.scale.height;
    const center = width / 2;
    const y = landscape ? Math.min(46, Math.max(30, this.scene.scale.height * 0.14)) : 94;
    const contentWidth = QuestHud.PAD_SIZE + (this.steps.length - 1) * QuestHud.STEP_SPACING;
    const backingWidth = contentWidth + QuestHud.HORIZONTAL_PADDING;
    // 橫向時為左側關卡標籤與右側地圖按鈕保留空間。
    const availableWidth = landscape ? width - 216 : width - 16;
    const scale = Math.min(1, Math.max(1, availableWidth) / backingWidth);
    this.backing.setPosition(center, y).setScale(scale);
    this.icons.forEach((icon, index) => {
      const x = center + (index - (this.steps.length - 1) / 2) * QuestHud.STEP_SPACING * scale;
      icon.setPosition(x, y).setDisplaySize(QuestHud.ICON_SIZE * scale, QuestHud.ICON_SIZE * scale);
      this.iconPads[index].setPosition(x, y).setDisplaySize(QuestHud.PAD_SIZE * scale, QuestHud.PAD_SIZE * scale);
    });
    this.arrows.forEach((arrow, index) => arrow
      .setPosition(center + (index - (this.steps.length - 2) / 2) * QuestHud.STEP_SPACING * scale, y)
      .setScale(scale));
  }
}
