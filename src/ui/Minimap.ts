import Phaser from 'phaser';
import { GAME } from '../config/GameConfig';
import type { GeneratedMap } from '../world/MapGenerator';

export class Minimap {
  private readonly scene: Phaser.Scene;
  private readonly map: GeneratedMap;
  private readonly visited: boolean[][];
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly mapGraphics: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly mapButton: Phaser.GameObjects.Container;
  private readonly closeButton: Phaser.GameObjects.Container;
  private open = false;
  private castleFound = false;
  private playerCell = { x: 0, y: 0 };
  private readonly onVisibilityChange: (open: boolean) => void;

  constructor(scene: Phaser.Scene, map: GeneratedMap, onVisibilityChange: (open: boolean) => void) {
    this.scene = scene;
    this.map = map;
    this.onVisibilityChange = onVisibilityChange;
    this.visited = Array.from({ length: map.height }, () => Array<boolean>(map.width).fill(false));
    this.shade = scene.add.rectangle(0, 0, 1, 1, 0x102019, 0.88).setOrigin(0).setScrollFactor(0).setDepth(100200).setVisible(false).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(100201).setVisible(false);
    this.mapGraphics = scene.add.graphics().setScrollFactor(0).setDepth(100202).setVisible(false);
    this.title = scene.add.text(0, 0, '探索地圖', { fontFamily: 'sans-serif', fontSize: '24px', color: '#fff9d8', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100203).setVisible(false);
    this.mapButton = this.makeButton('地圖', 82, 46, 0x365f45, () => this.show());
    this.closeButton = this.makeButton('關閉', 82, 44, 0x9a5b55, () => this.hide()).setVisible(false).setDepth(100204);
    this.layout();
    scene.scale.on('resize', this.layout, this);
  }

  update(worldX: number, worldY: number): void {
    const tile = GAME.map.tileSize;
    this.playerCell = { x: Math.floor(worldX / tile), y: Math.floor(worldY / tile) };
    const radius = GAME.map.revealRadius;
    for (let y = this.playerCell.y - radius; y <= this.playerCell.y + radius; y += 1) {
      for (let x = this.playerCell.x - radius; x <= this.playerCell.x + radius; x += 1) {
        if (this.visited[y]?.[x] !== undefined && Math.hypot(x - this.playerCell.x, y - this.playerCell.y) <= radius + 0.5) this.visited[y][x] = true;
      }
    }
    if (Math.hypot(this.playerCell.x - this.map.goal.x, this.playerCell.y - this.map.goal.y) <= radius + 1) this.castleFound = true;
    if (this.open) this.drawMap();
  }

  isOpen(): boolean { return this.open; }

  isMapButtonHit(x: number, y: number): boolean {
    if (this.open) return true;
    const bounds = this.mapButton.getBounds();
    return bounds.contains(x, y);
  }

  destroy(): void { this.scene.scale.off('resize', this.layout, this); }

  private show(): void {
    this.open = true;
    this.onVisibilityChange(true);
    [this.shade, this.panel, this.mapGraphics, this.title].forEach((item) => item.setVisible(true));
    this.mapButton.setVisible(false);
    this.closeButton.setVisible(true);
    this.layout();
    this.drawMap();
  }

  private hide(): void {
    this.open = false;
    this.onVisibilityChange(false);
    [this.shade, this.panel, this.mapGraphics, this.title, this.closeButton].forEach((item) => item.setVisible(false));
    this.mapButton.setVisible(true);
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.shade.setSize(width, height);
    this.mapButton.setPosition(width - 58 - this.safeRight(), 38 + this.safeTop());
    this.closeButton.setPosition(width - 58 - this.safeRight(), 38 + this.safeTop());
    this.title.setPosition(width / 2, 35 + this.safeTop());
    if (this.open) this.drawMap();
  }

  private drawMap(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const marginX = Math.max(24, width * 0.07);
    const top = 72 + this.safeTop();
    const bottom = 24 + this.safeBottom();
    const availableW = width - marginX * 2;
    const availableH = height - top - bottom;
    const cellSize = Math.min(availableW / this.map.width, availableH / this.map.height);
    const mapW = cellSize * this.map.width;
    const mapH = cellSize * this.map.height;
    const left = (width - mapW) / 2;
    const mapTop = top + (availableH - mapH) / 2;

    this.panel.clear().fillStyle(0xd8d2b4, 1).fillRoundedRect(left - 8, mapTop - 8, mapW + 16, mapH + 16, 10);
    this.mapGraphics.clear().fillStyle(0x5e665f, 1).fillRect(left, mapTop, mapW, mapH);
    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        if (!this.visited[y][x]) continue;
        const kind = this.map.cells[y][x];
        const color = kind === 'blocked' ? 0x2f633c : kind === 'clearing' ? 0xa2d56e : 0x8aca62;
        this.mapGraphics.fillStyle(color, 1).fillRect(left + x * cellSize, mapTop + y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
    if (this.castleFound) {
      this.mapGraphics.fillStyle(0xffd45d, 1).fillCircle(left + (this.map.goal.x + 0.5) * cellSize, mapTop + (this.map.goal.y + 0.5) * cellSize, Math.max(4, cellSize * 1.2));
    }
    this.mapGraphics.fillStyle(0xff72a5, 1).fillCircle(left + (this.playerCell.x + 0.5) * cellSize, mapTop + (this.playerCell.y + 0.5) * cellSize, Math.max(3, cellSize * 0.75));
  }

  private makeButton(label: string, width: number, height: number, color: number, action: () => void): Phaser.GameObjects.Container {
    const background = this.scene.add.rectangle(0, 0, width, height, color, 0.94).setStrokeStyle(2, 0xffffff, 0.5);
    const text = this.scene.add.text(0, 0, label, { fontFamily: 'sans-serif', fontSize: '19px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const container = this.scene.add.container(0, 0, [background, text]).setSize(width, height).setScrollFactor(0).setDepth(100190).setInteractive({ useHandCursor: true });
    container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      action();
    });
    return container;
  }

  private safeTop(): number { return 8; }
  private safeRight(): number { return 8; }
  private safeBottom(): number { return 8; }
}
