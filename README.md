需要 Node.js 24（或相容的 LTS 版本）。

```bash
npm install
npm run check
npm run dev
```

Build：

```bash
npm run build
```

## GitHub Pages

專案已包含 `.github/workflows/deploy.yml`，推送到 `main` 後會自動檢查、建置並部署 `dist`。

## Project Structure

```text
src/
├─ components/        # 牌面、玩家區域與對話框
├─ lib/game.ts        # 遊戲規則、AI 與回合流程
├─ lib/tiles.ts       # 牌面與玩家顯示資料
├─ App.svelte         # 主畫面與互動協調
└─ app.css            # 響應式牌桌設計
```
