# 公主迷宮探險

手機瀏覽器優先的 Phaser 3／TypeScript 五關草原迷宮遊戲。每關會生成新的寬路自然迷宮，探索並找到城堡即可前往下一關。

## 啟動

```bash
npm install
npm run dev
```

桌面可開啟終端顯示的網址；手機需與電腦在相同區域網路，並開啟終端顯示的 Network 網址。建議使用橫向畫面。

## GitHub Pages 部署

專案已設定由 GitHub Actions 自動建置與發布，預期網址為：

```text
https://qqboxy.github.io/princess-maze-adventure/
```

首次部署前，請到 GitHub repository：

1. 開啟 `Settings` → `Pages`。
2. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
3. 將程式推送至 `main`，或在 `Actions` 頁面手動執行 `Deploy game to GitHub Pages`。

Workflow 位於 `.github/workflows/deploy-pages.yml`，會執行 `npm ci`、`npm run build`，並發布 `dist/`。GitHub Pages 子路徑設定在 `vite.config.ts`；若日後改成自訂網域，請將 production `base` 改為 `/`。

## 操作

- 在遊戲畫面任一非 UI 區域按住並拖曳：控制方向與速度
- 放開：停止
- 桌面也可使用 WASD 或方向鍵
- 右上角「地圖」：查看已探索區域

## 常用調整

所有遊戲參數集中於 `src/config/GameConfig.ts`：

- `map.tileSize`：每格像素尺寸
- `levels[].size`：各關地圖格數
- `levels[].corridorRadius`：道路寬度
- `levels[].branchCount` / `branchMin` / `branchMax`：岔路數量與長度
- `levels[].waypoints` / `detour`：主路轉折數與迂迴程度
- `levels[].loopChance`：支線形成回環的機率
- `levels[].minPathFactor`：最短解法相對直線距離的難度門檻
- `map.maxGenerationAttempts`：驗證失敗時的最大重生次數
- `player.maxSpeed`：公主最大速度
- `input.deadZone` / `maxDistance`：觸控搖桿手感
- `debug`：顯示格線、路徑、碰撞框與 FPS

開發時可用 `?level=5` 直接載入指定關卡，方便測試第 1～5 關。

## 專案結構

```text
src/
├── config/GameConfig.ts       # 可調參數與 Phaser 設定
├── entities/Princess.ts       # 公主外觀、物理與移動
├── input/InputController.ts   # 動態搖桿與鍵盤輸入
├── scenes/GameScene.ts        # 第 1～5 關生命週期與流程
├── ui/Minimap.ts              # 探索紀錄、Fog of War 與地圖 UI
├── world/Collision.ts         # 障礙物生成與碰撞
├── world/Goal.ts              # 城堡與終點判定
├── world/MapGenerator.ts      # 寬路迷宮生成、BFS 解法驗證
├── main.ts
└── style.css
```

## 替換正式素材

目前公主、樹、石頭、城堡與裝飾都由 Phaser Graphics 產生。可在 `GameScene.preload()` 載入同名 texture key（`princess`、`tree`、`rock`、`castle` 等）來換成正式圖片，其餘遊戲邏輯不必修改。公主若改為 spritesheet，可在 `Princess` 中建立動畫並維持目前的圓形物理碰撞體。
