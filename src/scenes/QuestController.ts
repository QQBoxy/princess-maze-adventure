import Phaser from 'phaser';
import type { Princess } from '../entities/Princess';
import { QuestHud } from '../ui/QuestHud';
import type { GeneratedMap, Cell } from '../world/MapGenerator';
import { placeQuest, type QuestKind } from '../world/QuestPlacement';
import { GAME } from '../config/GameConfig';
import { alignArt } from '../config/ArtAlignment';

interface QuestEvents {
  leafFound: () => void;
  fairyMet: () => void;
  fairyPartner: () => void;
}

export class QuestController {
  readonly kind: QuestKind;
  private readonly scene: Phaser.Scene;
  private readonly player: Princess;
  private readonly hud: QuestHud;
  private readonly events: QuestEvents;
  private readonly objects = new Map<string, Phaser.GameObjects.Image>();
  private readonly done = new Set<string>();
  private rabbitTrail: Phaser.Math.Vector2[] = [];
  private lastTrailPosition?: Phaser.Math.Vector2;
  private rabbitGround?: Phaser.Math.Vector2;
  private rabbitShadow?: Phaser.GameObjects.Ellipse;
  private fairyTrail: Phaser.Math.Vector2[] = [];
  private lastFairyTrailPosition?: Phaser.Math.Vector2;
  private fairyGround?: Phaser.Math.Vector2;
  private fairyClue?: Phaser.GameObjects.Image;
  private treeLeaf?: Phaser.GameObjects.Image;
  private treeLeafGlow?: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, map: GeneratedMap, kind: QuestKind, player: Princess, events: QuestEvents, hasLeaf: boolean) {
    this.scene = scene;
    this.player = player;
    this.kind = kind;
    this.events = events;
    const steps: Record<QuestKind, string[]> = {
      none: ['castle'], rabbit: ['rabbit', 'castle'], key: ['key', 'castle'],
      garden: ['pinkFlower', 'blueFlower', 'castle'], leaf: ['magicTree', 'castle'],
      fairy: ['fairy', 'bag', 'fairy', 'castle'],
    };
    this.hud = new QuestHud(scene, steps[kind], kind === 'garden' ? 2 : 0);
    const locations = placeQuest(map, kind);
    if (locations.rabbit) {
      const rabbit = this.addObject('rabbit', locations.rabbit, 'rabbit', 72).setDisplaySize(59, 68);
      this.rabbitGround = new Phaser.Math.Vector2(rabbit.x, rabbit.y);
      this.rabbitShadow = scene.add.ellipse(rabbit.x, rabbit.y + 29, 38, 10, 0x314b35, 0.24).setDepth(rabbit.y - 1);
    }
    if (locations.key) this.addObject('key', locations.key, 'key', 46);
    if (locations.flowerA) this.addObject('flowerA', locations.flowerA, 'pinkFlower', 62);
    if (locations.flowerB) this.addObject('flowerB', locations.flowerB, 'blueFlower', 62);
    if (locations.tree) {
      const tree = this.addObject('tree', locations.tree, 'magicTree', 190).setDisplaySize(190, 205);
      this.treeLeafGlow = scene.add.circle(tree.x + 30, tree.y - 45, 26, 0xffe78f, 0.22)
        .setDepth(tree.y + 1);
      this.treeLeaf = scene.add.image(tree.x + 30, tree.y - 45, 'leaf').setDisplaySize(43, 43)
        .setDepth(tree.y + 2);
      scene.tweens.add({ targets: this.treeLeafGlow, alpha: { from: 0.13, to: 0.4 },
        scale: { from: 0.85, to: 1.16 }, duration: 1000, yoyo: true, repeat: -1 });
      scene.tweens.add({ targets: this.treeLeaf, y: tree.y - 51, angle: { from: -7, to: 7 },
        duration: 1100, yoyo: true, repeat: -1 });
    }
    if (locations.fairy) this.addObject('fairy', locations.fairy, 'fairy', 80).setDisplaySize(68, 82);
    if (locations.bag) this.addObject('bag', locations.bag, 'bag', 52).setVisible(false);
    if (kind === 'fairy' && hasLeaf) {
      const fairy = this.objects.get('fairy');
      if (fairy) {
        const clue = scene.add.image(fairy.x, fairy.y - 68, 'leaf').setDisplaySize(29, 29).setDepth(fairy.y + 1);
        this.fairyClue = clue;
        scene.tweens.add({ targets: clue, alpha: { from: 0.55, to: 1 }, y: clue.y - 6,
          duration: 820, yoyo: true, repeat: -1 });
      }
    }
  }

  update(): void {
    if (this.kind === 'rabbit') {
      if (!this.done.has('rabbit')) this.collectIfNear('rabbit', () => {
        this.done.add('rabbit');
        this.hud.setDone(0);
        this.lastTrailPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
        this.rabbitTrail = [this.lastTrailPosition.clone()];
        const rabbit = this.objects.get('rabbit');
        if (rabbit) {
          this.scene.tweens.add({ targets: rabbit, scaleX: rabbit.scaleX * 1.22,
            scaleY: rabbit.scaleY * 1.22, duration: 190, yoyo: true });
        }
      });
      else this.followRabbit();
      this.hopRabbit();
    } else if (this.kind === 'key') {
      if (!this.done.has('key')) this.collectIfNear('key', () => {
        this.done.add('key');
        this.hud.setDone(0);
        this.objects.get('key')?.destroy();
      });
    } else if (this.kind === 'garden') {
      for (const [key, index] of [['flowerA', 0], ['flowerB', 1]] as const) {
        if (!this.done.has(key)) this.collectIfNear(key, () => {
          this.done.add(key);
          this.hud.setDone(index);
          const flower = this.objects.get(key);
          if (flower) {
            flower.setTexture(key === 'flowerA' ? 'pinkFlowerBloom' : 'blueFlowerBloom');
            this.scene.tweens.add({ targets: flower, angle: { from: -8, to: 8 }, duration: 250, yoyo: true, repeat: 2 });
          }
        });
      }
    } else if (this.kind === 'leaf') {
      if (!this.done.has('tree')) this.collectIfNear('tree', () => {
        this.done.add('tree');
        this.hud.setIcon(0, 'leaf');
        this.hud.setDone(0);
        this.events.leafFound();
        const tree = this.objects.get('tree');
        if (tree) {
          const { scaleX, scaleY } = tree;
          this.scene.tweens.add({ targets: tree, scaleX: { from: scaleX, to: scaleX * 1.04 },
            scaleY: { from: scaleY, to: scaleY * 1.04 }, duration: 260, yoyo: true });
        }
        const leaf = this.treeLeaf;
        const glow = this.treeLeafGlow;
        if (leaf && glow) {
          this.scene.tweens.killTweensOf(leaf);
          this.scene.tweens.killTweensOf(glow);
          leaf.setAngle(0).setDepth(90002);
          glow.setDepth(90001);
          this.scene.tweens.add({ targets: [leaf, glow], y: leaf.y + 60, duration: 360,
            ease: 'Sine.in', onComplete: () => {
              this.scene.tweens.add({ targets: [leaf, glow], x: this.player.x, y: this.player.y - 42,
                duration: 450, ease: 'Sine.out', onComplete: () => {
                  this.scene.tweens.add({ targets: [leaf, glow], alpha: 0, duration: 300,
                    onComplete: () => { leaf.destroy(); glow.destroy(); } });
                } });
            } });
        }
      }, 78, 64);
    } else if (this.kind === 'fairy') {
      if (!this.done.has('met')) this.collectIfNear('fairy', () => {
        this.done.add('met');
        this.hud.setDone(0);
        this.objects.get('bag')?.setVisible(true);
        this.events.fairyMet();
        this.showThoughtBubble('bag');
      });
      else if (!this.done.has('bag')) this.collectIfNear('bag', () => {
        this.done.add('bag');
        this.hud.setDone(1);
        this.objects.get('bag')?.destroy();
      });
      else if (!this.done.has('partner')) this.collectIfNear('fairy', () => {
        this.done.add('partner');
        this.hud.setDone(2);
        this.events.fairyPartner();
        const fairy = this.objects.get('fairy');
        if (fairy) {
          this.scene.tweens.killTweensOf(fairy);
          this.fairyGround = new Phaser.Math.Vector2(fairy.x, fairy.y);
          this.lastFairyTrailPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
          this.fairyTrail = [this.lastFairyTrailPosition.clone()];
        }
        if (this.fairyClue) {
          this.scene.tweens.killTweensOf(this.fairyClue);
          this.fairyClue.destroy();
          this.fairyClue = undefined;
        }
      });
      else this.followFairy();
    }
  }

  isReadyForCastle(): boolean {
    switch (this.kind) {
      case 'none': return true;
      case 'rabbit': return this.done.has('rabbit');
      case 'key': return this.done.has('key');
      case 'garden': return this.done.has('flowerA') && this.done.has('flowerB');
      case 'leaf': return this.done.has('tree');
      case 'fairy': return this.done.has('partner');
    }
  }

  isCompanionNearby(): boolean {
    if (this.kind !== 'fairy' || !this.done.has('partner')) return true;
    return Boolean(this.fairyGround && Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.fairyGround.x, this.fairyGround.y) < 135);
  }

  finishCastle(): void {
    const last = { none: 0, rabbit: 1, key: 1, garden: 2, leaf: 1, fairy: 3 }[this.kind];
    this.hud.setDone(last);
  }

  showBlocked(): void { this.hud.highlightNext(); }
  destroy(): void { this.hud.destroy(); }

  private addObject(name: string, cell: Cell, texture: string, size: number): Phaser.GameObjects.Image {
    const x = (cell.x + 0.5) * GAME.map.tileSize;
    const y = (cell.y + 0.5) * GAME.map.tileSize;
    const image = alignArt(this.scene.add.image(x, y, texture)).setDisplaySize(size, size).setDepth(y);
    this.objects.set(name, image);
    if (name !== 'tree' && name !== 'rabbit') this.scene.tweens.add({ targets: image, y: y - 4, duration: 900, yoyo: true, repeat: -1 });
    return image;
  }

  private collectIfNear(name: string, action: () => void, radius = 68, yOffset = 0): void {
    const item = this.objects.get(name);
    if (item && Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y + yOffset) < radius) action();
  }

  private followRabbit(): void {
    if (!this.rabbitGround || !this.lastTrailPosition) return;
    const current = new Phaser.Math.Vector2(this.player.x, this.player.y);
    if (current.distance(this.lastTrailPosition) >= 12) {
      this.rabbitTrail.push(current);
      this.lastTrailPosition = current;
    }
    if (this.rabbitTrail.length === 0) return;
    const target = this.rabbitTrail[0];
    const distance = Phaser.Math.Distance.Between(this.rabbitGround.x, this.rabbitGround.y, target.x, target.y);
    if (distance < 7) { this.rabbitTrail.shift(); return; }
    const step = Math.min(distance, 220 * this.scene.game.loop.delta / 1000);
    this.rabbitGround.set(this.rabbitGround.x + (target.x - this.rabbitGround.x) / distance * step,
      this.rabbitGround.y + (target.y - this.rabbitGround.y) / distance * step);
  }

  private hopRabbit(): void {
    const rabbit = this.objects.get('rabbit');
    if (!rabbit || !this.rabbitGround) return;
    const hop = Math.abs(Math.sin(this.scene.time.now / 185)) * 12;
    rabbit.setPosition(this.rabbitGround.x, this.rabbitGround.y - hop).setDepth(this.rabbitGround.y + 1);
    this.rabbitShadow?.setPosition(this.rabbitGround.x, this.rabbitGround.y + 29)
      .setScale(1 - hop / 55).setAlpha(0.26 - hop / 120).setDepth(this.rabbitGround.y);
  }

  private followFairy(): void {
    const fairy = this.objects.get('fairy');
    if (!fairy || !this.fairyGround || !this.lastFairyTrailPosition) return;
    const current = new Phaser.Math.Vector2(this.player.x, this.player.y);
    if (current.distance(this.lastFairyTrailPosition) >= 12) {
      this.fairyTrail.push(current);
      this.lastFairyTrailPosition = current;
    }
    const target = this.fairyTrail[0];
    if (target) {
      const distance = this.fairyGround.distance(target);
      if (distance < 7) this.fairyTrail.shift();
      else {
        const step = Math.min(distance, 310 * this.scene.game.loop.delta / 1000);
        this.fairyGround.set(this.fairyGround.x + (target.x - this.fairyGround.x) / distance * step,
          this.fairyGround.y + (target.y - this.fairyGround.y) / distance * step);
      }
    }
    fairy.setPosition(this.fairyGround.x, this.fairyGround.y - 8 - Math.sin(this.scene.time.now / 190) * 4)
      .setDepth(this.fairyGround.y + 1);
  }

  private showThoughtBubble(texture: string): void {
    const fairy = this.objects.get('fairy');
    if (!fairy) return;
    const bubble = this.scene.add.image(fairy.x + 42, fairy.y - 60, texture).setDisplaySize(34, 34).setDepth(90000);
    this.scene.tweens.add({ targets: bubble, alpha: 0, delay: 1900, duration: 450, onComplete: () => bubble.destroy() });
  }
}
