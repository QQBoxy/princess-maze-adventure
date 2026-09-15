import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages 與 production preview 使用 repository 子路徑；本機 dev 維持根路徑。
  base: command === 'build' || isPreview ? '/princess-maze-adventure/' : '/',
}));
