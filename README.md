# 公主迷宮探險

手機瀏覽器優先的 Phaser 3／TypeScript 六關迷宮遊戲。第 1～5 關在草原，第 6 關進入神秘森林；每關會生成新的寬路自然迷宮，完成畫面上的圖像任務並抵達城堡即可過關。

## 啟動

```bash
npm install
npm run dev
```

桌面可開啟終端顯示的網址；手機需與電腦在相同區域網路，並開啟終端顯示的 Network 網址。建議使用橫向畫面。

## 線上遊玩

https://qqboxy.github.io/princess-maze-adventure/

## 操作

- 直向時拖曳畫面下方中央的搖桿；橫向時拖曳左下角的搖桿：控制方向與速度
- 放開搖桿：停止
- 電腦滑鼠可在遊戲畫面任意非 UI 位置按住拖曳，沿用原本的浮動搖桿；也可使用 WASD 或方向鍵
- 右上角「地圖」：查看已探索區域
- 畫面上方的圖像提示：依箭頭完成任務後前往城堡；第 4 關的「粉花 + 藍花」表示兩朵花可任意順序尋找。完成的圖示會出現金色邊框

## 關卡故事

- 第 1 關：練習移動，找到城堡。
- 第 2 關：找到會跳的小兔子，陪牠前往城堡。
- 第 3 關：取得鑰匙，開啟城堡門。
- 第 4 關：以任意順序讓粉色與藍色神奇花綻放，解除城堡前的藤蔓。
- 第 5 關：找到比一般障礙樹更大的發光樹，走近樹幹後，樹上的發光葉子會落下並飄向公主；取得葉子再前往城堡。
- 第 6 關：在森林遇見小精靈，找回並交還魔法小袋子；牠會發出柔和光芒、與公主保持距離並飛著跟隨，一起抵達城堡。森林隨故事漸入黃昏與夜晚。

葉子只在本次遊玩從第 5 關帶到第 6 關；重新整理頁面會重新開始。開發時直接載入第 6 關仍可測試該關，但不會顯示前一關取得葉子的銜接動畫。

## 常用調整

所有遊戲參數集中於 `src/config/GameConfig.ts`：

- `map.tileSize`：每格像素尺寸
- `levels[].size`：各關地圖格數
- `levels[].corridorRadius`：道路寬度
- `levels[].branchCount` / `branchMin` / `branchMax`：岔路數量與長度
- `levels[].waypoints` / `detour`：主路轉折數與迂迴程度
- `levels[].loopChance`：支線形成回環的機率
- `levels[].minPathFactor`：最短解法相對直線距離的難度門檻
- `levels[].theme` / `levels[].quest`：關卡場景與任務
- `map.maxGenerationAttempts`：驗證失敗時的最大重生次數
- `player.maxSpeed`：公主最大速度
- `input.deadZone` / `maxDistance`：觸控搖桿手感
- `debug`：顯示格線、路徑、碰撞框與 FPS

## 測試指定關卡

在遊戲網址後加上 `?level=1`～`?level=6`，重新載入就能直接從指定關卡開始。例如本機網址為 `http://localhost:5173/?level=5`。目前沒有畫面內的選關按鈕，也沒有固定隨機地圖的編號。

直接載入第 6 關不會帶入第 5 關的葉子；若要檢查葉子進入森林的銜接畫面，請從第 5 關過關進入第 6 關。

## 專案結構

```text
src/
├── config/GameConfig.ts       # 可調參數與關卡資料
├── config/ArtAlignment.ts     # 任務道具與城堡圖像中心校正
├── entities/Princess.ts       # 公主外觀、物理與移動
├── input/InputController.ts   # 觸控固定搖桿、滑鼠浮動搖桿與鍵盤輸入
├── scenes/GameScene.ts        # 第 1～6 關生命週期、場景與流程
├── scenes/QuestController.ts  # 任務互動、夥伴跟隨與劇情事件
├── ui/QuestHud.ts             # 圖像任務進度
├── ui/Minimap.ts              # 探索紀錄、Fog of War 與地圖 UI
├── world/Collision.ts         # 障礙物生成與碰撞
├── world/Goal.ts              # 城堡與終點判定
├── world/MapGenerator.ts      # 寬路迷宮生成、BFS 解法驗證
├── world/QuestPlacement.ts    # 任務物件位置與可達性
├── main.ts                    # Phaser 啟動設定
└── style.css
```

## 替換正式素材

目前公主、障礙樹、發光大樹、葉子、城堡與其他裝飾都由 `GameScene.createTextures()` 使用 Phaser Graphics 繪製。若改用圖片素材，需先在場景中載入圖片，並調整 `createTextures()`，避免同名 texture key 重複建立；目前的函式只要偵測到 `tree` 已存在，就會跳過全部圖像繪製。替換後也要檢查 `ArtAlignment.ts` 的圖像中心、地圖上的顯示尺寸與碰撞範圍。公主若改為 spritesheet，可在 `Princess` 中建立動畫並維持目前的圓形物理碰撞體。
