# 一桌好牌

以 Svelte 5、TypeScript 與 Vite 製作的台灣十六張單機麻將練習桌。

## 本機開發

需要 Node.js 24（或相容的 LTS 版本）。

```bash
npm install
npm run check
npm run dev
```

正式建置：

```bash
npm run build
```

## GitHub Pages

專案已包含 `.github/workflows/deploy.yml`，推送到 `main` 後會自動檢查、建置並部署 `dist`。

第一次部署前，請前往 GitHub repository：

1. 開啟 **Settings → Pages**。
2. 將 **Build and deployment → Source** 設為 **GitHub Actions**。
3. 推送到 `main`，或在 **Actions** 頁面手動執行 workflow。

Vite 的 `base` 已設定為 `/love_mahjong_23333/`，對應目前 repository 名稱。

## 專案結構

```text
src/
├─ components/        # 牌面、玩家區域與對話框
├─ lib/game.ts        # 遊戲規則、AI 與回合流程
├─ lib/tiles.ts       # 牌面與玩家顯示資料
├─ App.svelte         # 主畫面與互動協調
└─ app.css            # 響應式牌桌設計
```

