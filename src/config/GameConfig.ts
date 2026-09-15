import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';

export const GAME = {
  debug: false,
  map: {
    tileSize: 72,
    revealRadius: 3,
    maxGenerationAttempts: 48,
  },
  levels: [
    { size: 36, corridorRadius: 3, branchCount: 4, branchMin: 5, branchMax: 8, waypoints: 3, detour: 0.12, loopChance: 0.7, minPathFactor: 1.05 },
    { size: 40, corridorRadius: 2, branchCount: 6, branchMin: 6, branchMax: 10, waypoints: 4, detour: 0.16, loopChance: 0.6, minPathFactor: 1.12 },
    { size: 44, corridorRadius: 2, branchCount: 7, branchMin: 7, branchMax: 11, waypoints: 5, detour: 0.2, loopChance: 0.52, minPathFactor: 1.2 },
    { size: 48, corridorRadius: 2, branchCount: 9, branchMin: 8, branchMax: 13, waypoints: 6, detour: 0.24, loopChance: 0.44, minPathFactor: 1.28 },
    { size: 52, corridorRadius: 2, branchCount: 11, branchMin: 9, branchMax: 15, waypoints: 7, detour: 0.28, loopChance: 0.36, minPathFactor: 1.36 },
  ],
  player: {
    maxSpeed: 250,
    radius: 18,
  },
  input: {
    deadZone: 20,
    maxDistance: 100,
  },
  camera: {
    lerp: 0.1,
    zoom: 1,
  },
} as const;

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#78bd58',
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { debug: GAME.debug, gravity: { x: 0, y: 0 } },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [GameScene],
};
