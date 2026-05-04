# 桌面端打包准备

当前游戏是纯静态前端入口：

- `index.html`
- `styles.css`
- `game.js`
- `src/**/*.js`

后续可以用 Electron 或 Tauri 打包。推荐优先 Tauri，因为包体更小。

## Tauri 方向

1. 安装 Tauri CLI。
2. 将本目录作为前端静态资源目录。
3. 配置窗口标题为 `迷雾森林逃生`。
4. 禁用外部导航，只加载本地 `index.html`。

## Electron 方向

1. 新增 `package.json`。
2. 新增 `electron/main.js` 创建 BrowserWindow。
3. `loadFile("index.html")`。
4. 打包时复制 `src/`、`styles.css`、`game.js`。

## 注意

游戏使用 `localStorage` 存档，桌面端可继续沿用；如后续要做云存档，再替换 `src/systems/save.js`。
