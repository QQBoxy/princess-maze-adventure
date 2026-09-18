import type Phaser from 'phaser';

// Graphics textures are not all painted around their canvas midpoint. Keep the
// visible artwork centered on the map cell and in its task icon slot.
const artCenters: Record<string, { x: number; y: number; width: number; height: number }> = {
  rabbit: { x: 36, y: 41, width: 72, height: 82 },
  key: { x: 33, y: 24, width: 64, height: 64 },
  pinkFlower: { x: 32, y: 32, width: 64, height: 64 },
  blueFlower: { x: 32, y: 32, width: 64, height: 64 },
  pinkFlowerBloom: { x: 32, y: 32, width: 64, height: 64 },
  blueFlowerBloom: { x: 32, y: 32, width: 64, height: 64 },
  magicTree: { x: 96, y: 104, width: 192, height: 208 },
  leaf: { x: 32, y: 32, width: 64, height: 64 },
  fairy: { x: 40, y: 48, width: 80, height: 96 },
  bag: { x: 32, y: 33, width: 64, height: 64 },
  castle: { x: 60, y: 58, width: 120, height: 118 },
};

export function alignArt(image: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
  const art = artCenters[image.texture.key];
  if (art) image.setOrigin(art.x / art.width, art.y / art.height);
  return image;
}
