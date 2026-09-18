import Phaser from 'phaser';
import './style.css';
import { GAME } from './config/GameConfig';
import { GameScene } from './scenes/GameScene';

const phaserConfig: Phaser.Types.Core.GameConfig = {
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

new Phaser.Game(phaserConfig);
