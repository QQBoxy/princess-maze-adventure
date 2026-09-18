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

const game = new Phaser.Game(phaserConfig);
const gameHost = document.getElementById('game');

if (gameHost) {
  // 手機旋轉時瀏覽器可能先更新容器、稍後才更新 Phaser 畫布。
  let resizeFrame = 0;
  const syncCanvasSize = (): void => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const bounds = gameHost.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1 || !game.scale?.parent) return;
      const parentChanged = game.scale.getParentBounds();
      const canvasOutOfSync = Math.abs(game.canvas.width - bounds.width) > 1
        || Math.abs(game.canvas.height - bounds.height) > 1;
      if (parentChanged || canvasOutOfSync) game.scale.refresh();
    });
  };

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncCanvasSize).observe(gameHost);
  window.addEventListener('resize', syncCanvasSize);
  window.addEventListener('orientationchange', syncCanvasSize);
  window.visualViewport?.addEventListener('resize', syncCanvasSize);
}
