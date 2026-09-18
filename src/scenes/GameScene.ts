import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';
import { Princess } from '../entities/Princess';
import { InputController } from '../input/InputController';
import { Minimap } from '../ui/Minimap';
import { CollisionSystem } from '../world/Collision';
import { Goal } from '../world/Goal';
import { MapGenerator, type GeneratedMap } from '../world/MapGenerator';
import { QuestController } from './QuestController';

export class GameScene extends Phaser.Scene {
  private level = 1;
  private player!: Princess;
  private controls!: InputController;
  private minimap!: Minimap;
  private completed = false;
  private fpsText?: Phaser.GameObjects.Text;
  private debugMapText = '';
  private quest!: QuestController;
  private goal!: Goal;
  private hasLeaf = false;
  private forestShade?: Phaser.GameObjects.Rectangle;
  private magicButton?: Phaser.GameObjects.Container;
  private magicIcon?: Phaser.GameObjects.Image;
  private magicCooldown?: Phaser.GameObjects.Graphics;
  private magicReadyAt = 0;
  private lastCooldownBucket = -1;
  private magicUnlocked = false;
  private magicGlow?: Phaser.GameObjects.Container;
  private nightPhase: 'day' | 'dusk' | 'night' = 'day';
  private levelLabel?: Phaser.GameObjects.Text;

  constructor() { super('game'); }

  init(data: { level?: number; hasLeaf?: boolean }): void {
    const queryLevel = Number(new URLSearchParams(window.location.search).get('level'));
    const initialLevel = Number.isInteger(queryLevel) ? queryLevel : 1;
    this.level = Phaser.Math.Clamp(data.level ?? initialLevel, 1, GAME.levels.length);
    this.hasLeaf = data.hasLeaf ?? false;
  }

  create(): void {
    // `scene.restart()` 會重用 Scene 實例；新一局要重設流程與物理狀態。
    this.completed = false;
    this.magicUnlocked = false;
    this.magicReadyAt = 0;
    this.lastCooldownBucket = -1;
    this.magicButton = undefined;
    this.magicGlow = undefined;
    this.magicIcon = undefined;
    this.magicCooldown = undefined;
    this.forestShade = undefined;
    this.nightPhase = 'day';
    this.physics.resume();
    this.createTextures();
    const map = new MapGenerator().generate(this.level);
    const levelConfig = GAME.levels[this.level - 1];
    const worldWidth = map.width * GAME.map.tileSize;
    const worldHeight = map.height * GAME.map.tileSize;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight).setZoom(GAME.camera.zoom);
    this.add.rectangle(0, 0, worldWidth, worldHeight, levelConfig.theme === 'forest' ? 0x7c9d72 : 0x80c95c).setOrigin(0).setDepth(-100);
    this.addGroundDetails(map, levelConfig.theme);

    const start = this.cellCenter(map.start.x, map.start.y);
    this.player = new Princess(this, start.x, start.y);
    const collision = new CollisionSystem(this, map, levelConfig.theme);
    this.physics.add.collider(this.player, collision.obstacles);
    this.quest = new QuestController(this, map, levelConfig.quest, this.player, {
      leafFound: () => { this.hasLeaf = true; },
      fairyMet: () => this.setForestPhase('dusk'),
      fairyPartner: () => { this.setForestPhase('night'); this.unlockMagic(); },
    }, this.hasLeaf);
    this.goal = new Goal(this, map.goal, this.player, () => this.tryWin());
    this.goal.setLocked(!this.quest.isReadyForCastle(), levelConfig.quest === 'garden');
    this.cameras.main.startFollow(this.player, true, GAME.camera.lerp, GAME.camera.lerp);

    this.minimap = new Minimap(this, map, levelConfig.theme, (open) => {
      this.controls?.setEnabled(!open && !this.completed);
      if (open) this.player?.setVelocity(0, 0);
    });
    this.controls = new InputController(this, (x, y) => !this.completed && y > 128 &&
      !this.minimap.isMapButtonHit(x, y) && !this.isMagicButtonHit(x, y));
    this.minimap.update(this.player.x, this.player.y);
    this.addLevelLabel();
    if (this.level === 1) this.addTutorial();
    if (levelConfig.theme === 'forest') this.createForestAtmosphere();
    if (GAME.debug) this.createDebug(map);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.minimap.destroy();
      this.quest.destroy();
      this.scale.off('resize', this.layoutForestUi, this);
      this.scale.off('resize', this.layoutLevelLabel, this);
    });
  }

  update(): void {
    if (!this.completed && !this.minimap.isOpen()) this.player.move(this.controls.getVelocity());
    else this.player.setVelocity(0, 0);
    this.minimap.update(this.player.x, this.player.y);
    if (!this.completed && !this.minimap.isOpen()) this.quest.update();
    this.goal.setLocked(!this.quest.isReadyForCastle(), this.level === 4);
    this.updateMagicUi();
    if (this.fpsText) this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}\n${this.debugMapText}`);
  }

  private tryWin(): void {
    if (this.completed) return;
    if (!this.quest.isReadyForCastle()) {
      if (this.goal.showBlocked()) this.quest.showBlocked();
      return;
    }
    if (!this.quest.isCompanionNearby()) return;
    this.quest.finishCastle();
    this.win();
  }

  private win(): void {
    if (this.completed) return;
    this.completed = true;
    this.controls.setEnabled(false);
    this.player.setVelocity(0, 0);
    this.physics.pause();
    const width = this.scale.width;
    const height = this.scale.height;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x17291e, 0.74).setScrollFactor(0).setDepth(200000);
    const panel = this.add.rectangle(width / 2, height / 2, Math.min(width - 40, 390), 210, 0xfff4cf, 1).setStrokeStyle(5, 0xf4bf62).setScrollFactor(0).setDepth(200001);
    const finalLevel = this.level === GAME.levels.length;
    const titleLabel = finalLevel ? '全部過關！' : `第 ${this.level} 關過關！`;
    const buttonLabel = finalLevel ? '重新挑戰' : `前往第 ${this.level + 1} 關`;
    const title = this.add.text(width / 2, height / 2 - 55, titleLabel, { fontFamily: 'sans-serif', fontSize: '42px', color: '#9f4775', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(200002);
    const buttonBg = this.add.rectangle(0, 0, 210, 56, 0x5b9b58, 1).setStrokeStyle(3, 0xffffff, 0.6);
    const buttonText = this.add.text(0, 0, buttonLabel, { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const button = this.add.container(width / 2, height / 2 + 52, [buttonBg, buttonText]).setSize(210, 56).setScrollFactor(0).setDepth(200002).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.scene.restart({ level: finalLevel ? 1 : this.level + 1, hasLeaf: !finalLevel && this.hasLeaf }));
    this.tweens.add({ targets: [panel, title, button], scale: { from: 0.8, to: 1 }, duration: 330, ease: 'Back.out' });
    shade.setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 0.74, duration: 250 });
  }

  private addGroundDetails(map: GeneratedMap, theme: 'meadow' | 'forest'): void {
    const tile = GAME.map.tileSize;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.cells[y][x] === 'blocked' || Math.random() > 0.16) continue;
        const texture = theme === 'forest' ? (Math.random() < 0.4 ? 'forestFlower' : 'forestTuft') : (Math.random() < 0.35 ? 'flower' : 'grassTuft');
        this.add.image((x + Math.random()) * tile, (y + Math.random()) * tile, texture)
          .setRotation(Phaser.Math.FloatBetween(-0.3, 0.3)).setAlpha(Phaser.Math.FloatBetween(0.65, 0.95)).setDepth(0);
      }
    }
  }

  private addTutorial(): void {
    const isPortrait = this.scale.height > this.scale.width;
    const text = this.add.text(18, 144, isPortrait ? '按住拖曳來移動\n橫向玩會更舒服喔' : '按住拖曳來移動・拖越遠走越快', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', backgroundColor: '#284b36cc', padding: { x: 12, y: 9 },
    }).setScrollFactor(0).setDepth(100180);
    this.tweens.add({ targets: text, alpha: 0, delay: 6500, duration: 800, onComplete: () => text.destroy() });
  }

  private addLevelLabel(): void {
    this.levelLabel = this.add.text(16, 18, `第 ${this.level} 關`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#66507dcc', padding: { x: 12, y: 7 },
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(100180);
    this.scale.on('resize', this.layoutLevelLabel, this);
  }

  private layoutLevelLabel(): void {
    this.levelLabel?.setPosition(16, 18);
  }

  private createForestAtmosphere(): void {
    this.forestShade = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x263556, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(90000).setAlpha(0);
    const background = this.add.circle(0, 0, 34, 0xffdf84, 0.96).setStrokeStyle(3, 0xffffff, 0.7);
    this.magicIcon = this.add.image(0, 0, 'magicIcon').setDisplaySize(42, 42);
    this.magicCooldown = this.add.graphics();
    this.magicButton = this.add.container(0, 0, [background, this.magicIcon, this.magicCooldown])
      .setSize(72, 72).setScrollFactor(0).setDepth(100190).setInteractive({ useHandCursor: true }).setVisible(false);
    this.magicButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.useMagic();
    });
    this.layoutForestUi();
    this.scale.on('resize', this.layoutForestUi, this);
    if (this.hasLeaf) {
      const leaf = this.add.image(this.player.x, this.player.y - 55, 'leaf').setDepth(90001).setScale(0.7);
      this.tweens.add({ targets: leaf, y: leaf.y - 24, alpha: 0, delay: 1100, duration: 900, onComplete: () => leaf.destroy() });
    }
  }

  private setForestPhase(phase: 'dusk' | 'night'): void {
    if (!this.forestShade || this.nightPhase === phase) return;
    this.nightPhase = phase;
    this.tweens.add({ targets: this.forestShade, alpha: phase === 'dusk' ? 0.13 : 0.27,
      duration: 5000, ease: 'Sine.inOut' });
  }

  private unlockMagic(): void {
    this.magicUnlocked = true;
    this.magicButton?.setVisible(true);
    this.tweens.add({ targets: this.magicButton, scale: { from: 0.7, to: 1 }, duration: 380, ease: 'Back.out' });
  }

  private useMagic(): void {
    if (!this.magicUnlocked || this.completed || this.minimap.isOpen() || this.time.now < this.magicReadyAt) return;
    this.magicReadyAt = this.time.now + 10000;
    this.lastCooldownBucket = -1;
    this.magicGlow?.destroy();
    const rings = [
      this.add.circle(0, 0, 135, 0xfff1bd, 0.11),
      this.add.circle(0, 0, 94, 0xfff0b2, 0.12),
      this.add.circle(0, 0, 55, 0xffefaa, 0.16),
    ];
    this.magicGlow = this.add.container(this.player.x, this.player.y, rings).setDepth(90001);
    const glow = this.magicGlow;
    this.tweens.add({ targets: glow, alpha: 0, delay: 2600, duration: 650, onComplete: () => {
      glow.destroy();
      if (this.magicGlow === glow) this.magicGlow = undefined;
    } });
  }

  private updateMagicUi(): void {
    if (!this.magicUnlocked || !this.magicCooldown || !this.magicIcon) return;
    const remaining = Math.max(0, this.magicReadyAt - this.time.now);
    const bucket = Math.ceil(remaining / 100);
    this.magicGlow?.setPosition(this.player.x, this.player.y);
    if (bucket === this.lastCooldownBucket) return;
    this.lastCooldownBucket = bucket;
    this.magicIcon.setAlpha(remaining > 0 ? 0.45 : 1);
    this.magicCooldown.clear();
    if (remaining > 0) {
      const fraction = 1 - remaining / 10000;
      this.magicCooldown.lineStyle(5, 0xffffff, 0.92).beginPath()
        .arc(0, 0, 29, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2).strokePath();
    }
  }

  private isMagicButtonHit(x: number, y: number): boolean {
    return Boolean(this.magicButton?.visible && this.magicButton.getBounds().contains(x, y));
  }

  private layoutForestUi(): void {
    this.forestShade?.setSize(this.scale.width, this.scale.height);
    this.magicButton?.setPosition(this.scale.width - 58, this.scale.height - 68);
  }

  private createDebug(map: GeneratedMap): void {
    const graphics = this.add.graphics().setDepth(90000);
    const tile = GAME.map.tileSize;
    graphics.lineStyle(1, 0xffffff, 0.18);
    for (let x = 0; x <= map.width; x += 1) graphics.lineBetween(x * tile, 0, x * tile, map.height * tile);
    for (let y = 0; y <= map.height; y += 1) graphics.lineBetween(0, y * tile, map.width * tile, y * tile);
    graphics.lineStyle(5, 0x38a5ff, 0.75).beginPath();
    map.mainPath.forEach((cell, index) => {
      const point = this.cellCenter(cell.x, cell.y);
      if (index === 0) graphics.moveTo(point.x, point.y); else graphics.lineTo(point.x, point.y);
    });
    graphics.strokePath();
    graphics.lineStyle(3, 0xffd34e, 0.65);
    map.branches.forEach((branch) => {
      graphics.beginPath();
      branch.forEach((cell, index) => {
        const point = this.cellCenter(cell.x, cell.y);
        if (index === 0) graphics.moveTo(point.x, point.y); else graphics.lineTo(point.x, point.y);
      });
      graphics.strokePath();
    });
    const start = this.cellCenter(map.start.x, map.start.y);
    const goal = this.cellCenter(map.goal.x, map.goal.y);
    graphics.fillStyle(0x42ff7b, 1).fillCircle(start.x, start.y, 12);
    graphics.fillStyle(0xff544e, 1).fillCircle(goal.x, goal.y, 12);
    const validation = map.validation;
    this.debugMapText = `路徑 ${validation.shortestPath}/${validation.requiredPath}・生成 ${validation.attempts} 次`;
    this.fpsText = this.add.text(12, this.scale.height - 48, `FPS\n${this.debugMapText}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#000000aa',
    }).setScrollFactor(0).setDepth(100300);
  }

  private createTextures(): void {
    if (this.textures.exists('tree')) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    // 柔和粉彩色系：珊瑚粉、薰衣草紫、湖水綠與暖金色。
    g.fillStyle(0xb39ac7).fillRect(43, 98, 10, 8).fillRect(57, 98, 10, 8);
    g.fillStyle(0x67c7c3).fillPoints([
      { x: 34, y: 62 }, { x: 62, y: 62 }, { x: 78, y: 101 }, { x: 18, y: 101 },
    ], true);
    g.fillStyle(0x4fb1b3).fillPoints([
      { x: 48, y: 64 }, { x: 62, y: 62 }, { x: 78, y: 101 }, { x: 60, y: 96 },
    ], true);
    g.fillStyle(0xee8296).fillTriangle(48, 61, 62, 101, 34, 101);
    g.fillStyle(0xb69bc9).fillTriangle(34, 62, 18, 82, 42, 70).fillTriangle(62, 62, 78, 82, 54, 70);
    g.fillStyle(0xa98dc0).fillPoints([
      { x: 25, y: 45 }, { x: 39, y: 43 }, { x: 48, y: 57 }, { x: 57, y: 43 },
      { x: 71, y: 45 }, { x: 61, y: 68 }, { x: 35, y: 68 },
    ], true);
    g.fillStyle(0xf3b6a4).fillTriangle(39, 43, 57, 43, 48, 57);
    g.fillStyle(0xf3b6a4).fillTriangle(29, 49, 19, 68, 30, 71).fillTriangle(67, 49, 77, 68, 66, 71);
    g.fillStyle(0xad94c5).fillPoints([
      { x: 18, y: 64 }, { x: 31, y: 69 }, { x: 27, y: 77 }, { x: 14, y: 71 },
    ], true).fillPoints([
      { x: 65, y: 69 }, { x: 78, y: 64 }, { x: 82, y: 71 }, { x: 69, y: 77 },
    ], true);
    g.fillStyle(0xf3b6a4).fillCircle(15, 73, 4).fillCircle(82, 73, 4).fillRect(43, 38, 10, 8);
    g.fillStyle(0xe77b92).fillPoints([
      { x: 31, y: 18 }, { x: 48, y: 10 }, { x: 65, y: 18 }, { x: 70, y: 31 },
      { x: 61, y: 43 }, { x: 35, y: 43 }, { x: 26, y: 31 },
    ], true);
    g.fillStyle(0xf3b6a4).fillPoints([
      { x: 34, y: 20 }, { x: 62, y: 20 }, { x: 61, y: 34 }, { x: 53, y: 41 },
      { x: 43, y: 41 }, { x: 35, y: 34 },
    ], true);
    g.fillStyle(0xf197a8).fillTriangle(27, 30, 36, 18, 35, 38).fillTriangle(69, 30, 60, 18, 61, 38);
    g.fillStyle(0xe8758d).fillTriangle(31, 17, 35, 6, 41, 17).fillTriangle(40, 17, 48, 2, 55, 17).fillTriangle(54, 17, 62, 6, 65, 17);
    g.fillStyle(0xf0c54b).fillRect(31, 16, 34, 4);
    g.fillStyle(0x344663).fillCircle(42, 27, 1.6).fillCircle(55, 27, 1.6);
    g.fillStyle(0xd96e82).fillTriangle(46, 34, 51, 34, 48.5, 36);
    g.lineStyle(3, 0xd3ac54, 1).lineBetween(84, 75, 84, 26);
    g.fillStyle(0xe7b538).fillPoints([
      { x: 84, y: 17 }, { x: 87, y: 22 }, { x: 93, y: 23 }, { x: 89, y: 27 },
      { x: 90, y: 33 }, { x: 84, y: 30 }, { x: 78, y: 33 }, { x: 79, y: 27 },
      { x: 75, y: 23 }, { x: 81, y: 22 },
    ], true);
    g.generateTexture('princess', 96, 106).clear();
    g.fillStyle(0x6a432b).fillRect(29, 43, 12, 31);
    g.fillStyle(0x286f3d).fillCircle(35, 30, 28).fillCircle(18, 39, 22).fillCircle(52, 39, 23).fillCircle(35, 15, 20);
    g.fillStyle(0x4d9950).fillCircle(29, 23, 13);
    g.generateTexture('tree', 72, 78).clear();
    g.fillStyle(0x777f83).fillEllipse(34, 34, 58, 42);
    g.fillStyle(0xaab0ae).fillEllipse(27, 26, 30, 17);
    g.generateTexture('rock', 68, 58).clear();
    // Three little towers, warm windows and a real arched gate make the goal
    // recognizable even when the same texture is reduced to a task icon.
    g.fillStyle(0x5e7657, 0.28).fillEllipse(60, 109, 110, 14);
    g.fillStyle(0xb9a3c9).fillRoundedRect(12, 45, 28, 60, 4).fillRoundedRect(80, 45, 28, 60, 4);
    g.fillStyle(0xe6c5d9).fillRect(17, 53, 5, 48).fillRect(85, 53, 5, 48);
    g.fillStyle(0x9d80b0).fillRect(11, 43, 30, 7).fillRect(79, 43, 30, 7);
    g.fillStyle(0xba83a4).fillTriangle(7, 43, 26, 11, 45, 43).fillTriangle(75, 43, 94, 11, 113, 43);
    g.fillStyle(0xf6bb8c).fillTriangle(13, 39, 26, 17, 39, 39).fillTriangle(81, 39, 94, 17, 107, 39);
    g.fillStyle(0xe5c9df).fillRoundedRect(35, 39, 50, 68, 5);
    g.fillStyle(0xf5dfeb).fillRect(42, 48, 7, 52).fillRect(70, 48, 7, 52);
    g.fillStyle(0xa989bd).fillRect(33, 39, 54, 8);
    g.fillStyle(0xb477a3).fillTriangle(30, 39, 60, 4, 90, 39);
    g.fillStyle(0xf2b78c).fillTriangle(39, 35, 60, 11, 81, 35);
    g.fillStyle(0xf7df99).fillCircle(60, 31, 6);
    g.fillStyle(0x7f6c9d).fillRoundedRect(20, 57, 11, 20, 5).fillRoundedRect(89, 57, 11, 20, 5);
    g.fillStyle(0xffe5a2).fillRoundedRect(23, 60, 5, 12, 3).fillRoundedRect(92, 60, 5, 12, 3);
    g.fillStyle(0x826a9a).fillRoundedRect(53, 50, 14, 21, 6);
    g.fillStyle(0xffe5a2).fillRoundedRect(57, 53, 6, 14, 3);
    g.fillStyle(0x795c83).fillCircle(60, 86, 15).fillRect(45, 86, 30, 20);
    g.fillStyle(0x9c75a3).fillRect(48, 87, 11, 19).fillRect(61, 87, 11, 19);
    g.fillStyle(0xf6d66f).fillCircle(65, 93, 2);
    g.lineStyle(2, 0xf4d087).lineBetween(26, 11, 26, 2).lineBetween(94, 11, 94, 2);
    g.fillStyle(0xf3a1a9).fillTriangle(26, 2, 38, 6, 26, 10).fillTriangle(94, 2, 106, 6, 94, 10);
    g.fillStyle(0x70a77b).fillCircle(15, 103, 9).fillCircle(105, 103, 9);
    g.fillStyle(0xa8ce8d).fillCircle(12, 100, 4).fillCircle(102, 100, 4);
    g.generateTexture('castle', 120, 118).clear();
    g.lineStyle(3, 0x3f8c47).lineBetween(8, 18, 10, 3).lineBetween(10, 18, 18, 7).lineBetween(10, 18, 1, 9);
    g.generateTexture('grassTuft', 20, 20).clear();
    g.fillStyle(0xfff1f7).fillCircle(10, 5, 4).fillCircle(15, 10, 4).fillCircle(10, 15, 4).fillCircle(5, 10, 4);
    g.fillStyle(0xf0b33d).fillCircle(10, 10, 3);
    g.generateTexture('flower', 20, 20).clear();
    g.fillStyle(0x493d3d).fillRect(29, 42, 12, 31);
    g.fillStyle(0x286459).fillCircle(35, 29, 28).fillCircle(17, 39, 21).fillCircle(53, 39, 22).fillCircle(35, 13, 19);
    g.fillStyle(0x51a080).fillCircle(24, 24, 10).fillCircle(48, 34, 9);
    g.generateTexture('forestTree', 72, 78).clear();
    g.fillStyle(0x6b7672).fillEllipse(34, 35, 58, 42);
    g.fillStyle(0x82b58d).fillEllipse(27, 26, 31, 15);
    g.generateTexture('mossRock', 68, 58).clear();
    g.lineStyle(3, 0x4b8c73).lineBetween(8, 19, 11, 3).lineBetween(11, 19, 18, 9);
    g.generateTexture('forestTuft', 20, 20).clear();
    g.fillStyle(0xffe8bd).fillCircle(10, 6, 4).fillCircle(15, 11, 4).fillCircle(10, 16, 4).fillCircle(5, 11, 4);
    g.fillStyle(0xe2a66c).fillCircle(10, 11, 3);
    g.generateTexture('forestFlower', 20, 20).clear();
    g.fillStyle(0xfff0f4).fillEllipse(27, 20, 15, 37).fillEllipse(46, 20, 15, 37);
    g.fillStyle(0xf4b6cc).fillEllipse(27, 20, 7, 27).fillEllipse(46, 20, 7, 27);
    g.fillStyle(0xfff3f5).fillEllipse(36, 63, 43, 32).fillCircle(14, 62, 9);
    g.fillStyle(0xfff7f8).fillEllipse(36, 43, 42, 34);
    g.fillStyle(0x665a69).fillCircle(28, 41, 2.5).fillCircle(44, 41, 2.5);
    g.fillStyle(0xf39bb4).fillTriangle(33, 47, 39, 47, 36, 51);
    g.generateTexture('rabbit', 72, 82).clear();
    g.lineStyle(7, 0xe4ae3c).strokeCircle(21, 23, 10).lineBetween(29, 23, 50, 23).lineBetween(47, 23, 47, 31).lineBetween(54, 23, 54, 31);
    g.generateTexture('key', 64, 64).clear();
    const drawQuestFlower = (name: string, petals: number, bloomed: boolean): void => {
      g.lineStyle(4, 0x4b9b4d).lineBetween(32, 59, 32, 34);
      g.fillStyle(0x6fb56d).fillEllipse(25, 49, 12, 6).fillEllipse(39, 49, 12, 6);
      g.fillStyle(petals);
      if (bloomed) {
        g.fillCircle(32, 14, 11).fillCircle(18, 28, 11).fillCircle(46, 28, 11)
          .fillCircle(21, 43, 11).fillCircle(43, 43, 11);
      } else {
        g.fillCircle(32, 20, 10).fillCircle(22, 31, 10).fillCircle(42, 31, 10)
          .fillCircle(26, 41, 9).fillCircle(38, 41, 9);
      }
      g.fillStyle(0xffe6a4).fillCircle(32, 30, bloomed ? 9 : 7);
      g.generateTexture(name, 64, 64).clear();
    };
    drawQuestFlower('pinkFlower', 0xf19ac7, false);
    drawQuestFlower('blueFlower', 0x74c5f1, false);
    drawQuestFlower('pinkFlowerBloom', 0xffb7dd, true);
    drawQuestFlower('blueFlowerBloom', 0xa5e1fa, true);
    // 第五關的任務樹：寬闊樹冠、盤根與金色葉光，輪廓明顯不同於一般障礙樹。
    g.fillStyle(0x3b6245, 0.28).fillEllipse(96, 198, 152, 17);
    g.fillStyle(0x6d4c48).fillPoints([
      { x: 84, y: 104 }, { x: 107, y: 104 }, { x: 113, y: 172 }, { x: 123, y: 189 },
      { x: 148, y: 196 }, { x: 114, y: 196 }, { x: 99, y: 186 }, { x: 91, y: 193 },
      { x: 51, y: 196 }, { x: 77, y: 185 }, { x: 83, y: 167 },
    ], true);
    g.fillStyle(0xa2745d).fillPoints([
      { x: 89, y: 105 }, { x: 100, y: 105 }, { x: 99, y: 174 }, { x: 91, y: 186 },
      { x: 77, y: 190 }, { x: 87, y: 176 },
    ], true);
    g.lineStyle(5, 0x78534b).lineBetween(90, 132, 56, 101).lineBetween(105, 130, 137, 100);
    g.lineStyle(3, 0xc49b70).lineBetween(104, 124, 107, 172).lineBetween(105, 155, 117, 178);
    g.fillStyle(0x285e50).fillCircle(49, 103, 34).fillCircle(143, 103, 35)
      .fillCircle(68, 69, 39).fillCircle(124, 67, 42).fillCircle(96, 48, 44);
    g.fillStyle(0x3a8861).fillCircle(42, 93, 28).fillCircle(150, 94, 29)
      .fillCircle(69, 58, 34).fillCircle(124, 57, 36).fillCircle(96, 34, 34)
      .fillEllipse(96, 100, 122, 66);
    g.fillStyle(0x5caf74).fillCircle(34, 83, 18).fillCircle(60, 48, 20)
      .fillCircle(92, 22, 22).fillCircle(128, 46, 21).fillCircle(157, 81, 17);
    g.fillStyle(0x83cb89, 0.9).fillEllipse(48, 75, 22, 12).fillEllipse(82, 34, 24, 12)
      .fillEllipse(116, 29, 20, 10).fillEllipse(147, 71, 20, 11);
    g.fillStyle(0xd5eb9d, 0.75).fillCircle(55, 92, 4).fillCircle(138, 89, 4)
      .fillCircle(73, 73, 3).fillCircle(122, 81, 3);
    g.fillStyle(0xffdf83, 0.8).fillCircle(55, 60, 5).fillCircle(132, 69, 5)
      .fillCircle(79, 91, 4).fillCircle(110, 56, 4);
    g.fillStyle(0xfff2bf).fillCircle(54, 59, 2).fillCircle(131, 68, 2)
      .fillCircle(79, 90, 2).fillCircle(110, 55, 2);
    g.generateTexture('magicTree', 192, 208).clear();
    // 獨立的發光葉子會掛在樹冠上，取得後才飄向公主。
    g.fillStyle(0xffe38b, 0.2).fillCircle(32, 30, 29);
    g.fillStyle(0xffefaa, 0.34).fillCircle(32, 30, 22);
    g.fillStyle(0xe9aa4e).fillPoints([
      { x: 28, y: 9 }, { x: 42, y: 13 }, { x: 51, y: 26 }, { x: 46, y: 42 },
      { x: 29, y: 50 }, { x: 16, y: 41 }, { x: 14, y: 25 },
    ], true);
    g.fillStyle(0xffe680).fillPoints([
      { x: 28, y: 11 }, { x: 40, y: 15 }, { x: 47, y: 27 }, { x: 42, y: 39 },
      { x: 29, y: 46 }, { x: 19, y: 39 }, { x: 18, y: 26 },
    ], true);
    g.fillStyle(0xfff6bb).fillPoints([
      { x: 29, y: 13 }, { x: 37, y: 17 }, { x: 35, y: 29 }, { x: 25, y: 36 },
      { x: 20, y: 35 }, { x: 20, y: 26 },
    ], true);
    g.lineStyle(2, 0xc78943).lineBetween(30, 45, 33, 17).lineBetween(32, 31, 43, 25)
      .lineBetween(31, 36, 23, 28).lineBetween(30, 44, 35, 55);
    g.fillStyle(0xfff7d0).fillPoints([
      { x: 53, y: 8 }, { x: 55, y: 13 }, { x: 60, y: 15 }, { x: 55, y: 17 }, { x: 53, y: 22 },
      { x: 51, y: 17 }, { x: 46, y: 15 }, { x: 51, y: 13 },
    ], true).fillCircle(11, 17, 2).fillCircle(54, 48, 2);
    g.generateTexture('leaf', 64, 64).clear();
    g.fillStyle(0xffedbb, 0.16).fillCircle(40, 48, 38);
    g.fillStyle(0x9fdded, 0.82).fillEllipse(22, 45, 29, 42).fillEllipse(58, 45, 29, 42);
    g.fillStyle(0xcaf7f2, 0.82).fillEllipse(23, 47, 17, 28).fillEllipse(57, 47, 17, 28);
    g.fillStyle(0xa3cfdf, 0.85).fillEllipse(23, 65, 23, 25).fillEllipse(57, 65, 23, 25);
    g.lineStyle(4, 0xeac0aa).lineBetween(35, 76, 34, 88).lineBetween(45, 76, 46, 88);
    g.fillStyle(0x7869a8).fillEllipse(33, 89, 12, 6).fillEllipse(47, 89, 12, 6);
    g.fillStyle(0x8d7bc1).fillTriangle(40, 50, 21, 80, 59, 80);
    g.fillStyle(0xb4a2db).fillEllipse(40, 52, 22, 22);
    g.fillStyle(0xe8bda9).fillCircle(24, 59, 5).fillCircle(56, 59, 5);
    g.lineStyle(4, 0xe8bda9).lineBetween(31, 55, 24, 59).lineBetween(49, 55, 56, 59);
    g.fillStyle(0x637986).fillEllipse(40, 28, 35, 29);
    g.fillStyle(0xf1cbb8).fillTriangle(26, 31, 16, 34, 28, 39).fillTriangle(54, 31, 64, 34, 52, 39);
    g.fillStyle(0xffddc8).fillCircle(40, 34, 15);
    g.fillStyle(0x637986).fillEllipse(40, 22, 33, 14).fillEllipse(29, 28, 12, 17);
    g.fillStyle(0x4b546e).fillCircle(34, 36, 2).fillCircle(46, 36, 2);
    g.fillStyle(0xf0a7ad, 0.7).fillCircle(30, 42, 3).fillCircle(50, 42, 3);
    g.lineStyle(2, 0x9b667b).lineBetween(38, 44, 42, 44);
    g.lineStyle(2, 0xf5df93).lineBetween(59, 56, 67, 30);
    g.fillStyle(0xffed9e).fillPoints([{ x: 67, y: 20 }, { x: 70, y: 27 }, { x: 77, y: 30 }, { x: 70, y: 33 }, { x: 67, y: 40 }, { x: 64, y: 33 }, { x: 57, y: 30 }, { x: 64, y: 27 }], true);
    g.generateTexture('fairy', 80, 96).clear();
    g.fillStyle(0xbb7781).fillRoundedRect(14, 19, 36, 34, 8);
    g.lineStyle(4, 0xf0c57c).lineBetween(14, 22, 50, 22);
    g.fillStyle(0xf2d5a1).fillCircle(32, 28, 5);
    g.generateTexture('bag', 64, 64).clear();
    g.fillStyle(0xf7d878).fillRoundedRect(17, 25, 30, 30, 5);
    g.fillStyle(0x886f3d).fillRoundedRect(22, 12, 20, 19, 9);
    g.fillStyle(0x71582f).fillRect(20, 25, 24, 6);
    g.generateTexture('goalLock', 64, 64).clear();
    g.lineStyle(6, 0x4c8753).lineBetween(4, 56, 45, 13).lineBetween(12, 58, 58, 10).lineBetween(4, 26, 52, 60);
    g.fillStyle(0x74b35c).fillCircle(37, 22, 6).fillCircle(21, 43, 6);
    g.generateTexture('vines', 64, 64).clear();
    g.fillStyle(0xffefaa).fillCircle(32, 32, 20);
    g.fillStyle(0xf4b65b).fillPoints([{ x: 32, y: 9 }, { x: 39, y: 25 }, { x: 55, y: 32 }, { x: 39, y: 39 }, { x: 32, y: 55 }, { x: 25, y: 39 }, { x: 9, y: 32 }, { x: 25, y: 25 }], true);
    g.generateTexture('magicIcon', 64, 64).destroy();
  }

  private cellCenter(x: number, y: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2((x + 0.5) * GAME.map.tileSize, (y + 0.5) * GAME.map.tileSize);
  }
}
