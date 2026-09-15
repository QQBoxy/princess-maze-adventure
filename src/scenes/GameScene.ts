import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';
import { Princess } from '../entities/Princess';
import { InputController } from '../input/InputController';
import { Minimap } from '../ui/Minimap';
import { CollisionSystem } from '../world/Collision';
import { Goal } from '../world/Goal';
import { MapGenerator, type GeneratedMap } from '../world/MapGenerator';

export class GameScene extends Phaser.Scene {
  private level = 1;
  private player!: Princess;
  private controls!: InputController;
  private minimap!: Minimap;
  private completed = false;
  private fpsText?: Phaser.GameObjects.Text;
  private debugMapText = '';

  constructor() { super('game'); }

  init(data: { level?: number }): void {
    const queryLevel = Number(new URLSearchParams(window.location.search).get('level'));
    const initialLevel = Number.isInteger(queryLevel) ? queryLevel : 1;
    this.level = Phaser.Math.Clamp(data.level ?? initialLevel, 1, GAME.levels.length);
  }

  create(): void {
    // `scene.restart()` 會重用 Scene 實例；新一局要重設流程與物理狀態。
    this.completed = false;
    this.physics.resume();
    this.createTextures();
    const map = new MapGenerator().generate(this.level);
    const worldWidth = map.width * GAME.map.tileSize;
    const worldHeight = map.height * GAME.map.tileSize;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight).setZoom(GAME.camera.zoom);
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x80c95c).setOrigin(0).setDepth(-100);
    this.addGroundDetails(map);

    const start = this.cellCenter(map.start.x, map.start.y);
    this.player = new Princess(this, start.x, start.y);
    const collision = new CollisionSystem(this, map);
    this.physics.add.collider(this.player, collision.obstacles);
    new Goal(this, map.goal, this.player, () => this.win());
    this.cameras.main.startFollow(this.player, true, GAME.camera.lerp, GAME.camera.lerp);

    this.minimap = new Minimap(this, map, (open) => {
      this.controls?.setEnabled(!open && !this.completed);
      if (open) this.player?.setVelocity(0, 0);
    });
    this.controls = new InputController(this, (x, y) => !this.completed && !this.minimap.isMapButtonHit(x, y));
    this.minimap.update(this.player.x, this.player.y);
    this.addLevelLabel();
    if (this.level === 1) this.addTutorial();
    if (GAME.debug) this.createDebug(map);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.minimap.destroy();
    });
  }

  update(): void {
    if (!this.completed && !this.minimap.isOpen()) this.player.move(this.controls.getVelocity());
    else this.player.setVelocity(0, 0);
    this.minimap.update(this.player.x, this.player.y);
    if (this.fpsText) this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}\n${this.debugMapText}`);
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
    button.on('pointerdown', () => this.scene.restart({ level: finalLevel ? 1 : this.level + 1 }));
    this.tweens.add({ targets: [panel, title, button], scale: { from: 0.8, to: 1 }, duration: 330, ease: 'Back.out' });
    shade.setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 0.74, duration: 250 });
  }

  private addGroundDetails(map: GeneratedMap): void {
    const tile = GAME.map.tileSize;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.cells[y][x] === 'blocked' || Math.random() > 0.16) continue;
        const texture = Math.random() < 0.35 ? 'flower' : 'grassTuft';
        this.add.image((x + Math.random()) * tile, (y + Math.random()) * tile, texture)
          .setRotation(Phaser.Math.FloatBetween(-0.3, 0.3)).setAlpha(Phaser.Math.FloatBetween(0.65, 0.95)).setDepth(0);
      }
    }
  }

  private addTutorial(): void {
    const isPortrait = this.scale.height > this.scale.width;
    const text = this.add.text(18, 18, isPortrait ? '按住拖曳來移動\n橫向玩會更舒服喔' : '按住拖曳來移動・拖越遠走越快', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', backgroundColor: '#284b36cc', padding: { x: 12, y: 9 },
    }).setScrollFactor(0).setDepth(100180);
    this.tweens.add({ targets: text, alpha: 0, delay: 6500, duration: 800, onComplete: () => text.destroy() });
  }

  private addLevelLabel(): void {
    this.add.text(this.scale.width / 2, 18, `第 ${this.level} 關 / ${GAME.levels.length}`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#66507dcc', padding: { x: 12, y: 7 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100180);
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
    g.fillStyle(0xf8e1ef).fillRect(10, 22, 60, 46);
    g.fillStyle(0xc17a9f).fillTriangle(5, 25, 40, 2, 75, 25).fillRect(14, 20, 52, 10);
    g.fillStyle(0x7a4b85).fillRect(34, 42, 14, 26);
    g.fillStyle(0xf4c84b).fillRect(58, 0, 4, 25).fillTriangle(62, 2, 77, 8, 62, 14);
    g.generateTexture('castle', 82, 72).clear();
    g.lineStyle(3, 0x3f8c47).lineBetween(8, 18, 10, 3).lineBetween(10, 18, 18, 7).lineBetween(10, 18, 1, 9);
    g.generateTexture('grassTuft', 20, 20).clear();
    g.fillStyle(0xfff1f7).fillCircle(10, 5, 4).fillCircle(15, 10, 4).fillCircle(10, 15, 4).fillCircle(5, 10, 4);
    g.fillStyle(0xf0b33d).fillCircle(10, 10, 3);
    g.generateTexture('flower', 20, 20).destroy();
  }

  private cellCenter(x: number, y: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2((x + 0.5) * GAME.map.tileSize, (y + 0.5) * GAME.map.tileSize);
  }
}
