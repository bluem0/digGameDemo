# 🦕 挖掘租约 (Dig Game Demo)

一个基于 Vite + React + TypeScript 的网页 MVP Demo，用于验证《挖掘租约》核心循环。

## 🎮 试玩链接

**GitHub Pages（合并 PR 并启用 Pages 后可访问）：**
👉 https://bluem0.github.io/digGameDemo/

> **注意**：GitHub Pages 需要仓库设置为公开，或使用 GitHub Pro/Team/Enterprise 计划。若仓库为私有且无法使用 GitHub Pages，请参阅下方 [Vercel 部署](#vercel-部署可选) 章节。

---

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:5173 即可游玩。

构建生产版本：

```bash
npm run build
npm run preview
```

---

## 🚀 部署说明

### GitHub Pages（推荐）

本项目已配置 GitHub Actions 自动部署，推送到 `main` 分支后自动构建并发布到 GitHub Pages。

**首次启用步骤：**

1. 在仓库 **Settings → Pages** 中，将 **Source** 设置为 **GitHub Actions**
2. 将 PR 合并到 `main` 分支
3. GitHub Actions 会自动执行：`npm ci` → `npm run build` → 部署 `dist/` 到 GitHub Pages
4. 部署完成后，访问 https://bluem0.github.io/digGameDemo/ 即可试玩

**更新方式：**
直接向 `main` 分支推送代码，GitHub Actions 会自动重新构建并部署，无需手动操作。

**查看部署状态：**
在仓库的 **Actions** 标签页查看工作流运行状态和部署 URL。

---

### Vercel 部署（可选）

若 GitHub Pages 不可用（私有仓库免费计划限制），可使用 Vercel 免费部署：

1. 访问 [vercel.com](https://vercel.com) 并登录
2. 点击 **Add New → Project**，导入此仓库
3. Vercel 会自动识别 Vite 项目，**无需修改任何配置**
4. 点击 **Deploy**，部署完成后获得形如 `https://dig-game-demo.vercel.app` 的链接
5. 后续推送到 `main` 分支时，Vercel 会自动重新部署

---

## 玩法说明

### 核心目标
通过 6 轮共缴纳租金（50 / 100 / 180 / 300 / 450 / 700 金币），坚持到最后即为胜利。

### 游戏流程
1. **挖掘阶段**：每轮有倒计时（默认 90 秒，测试模式 30 秒）
   - 2 名工人自动挖掘地图，每 3 秒挖一次
   - 挖出的物品自动放入**存储区（4×4）**
2. **整理物品**：点击物品选中，再点击目标格放置；点"整理"可自动排序
3. **发车赚钱**：将存储区物品移入**车厢（4×3）**，点击"发车出售"获得金币
4. **交租**：倒计时结束自动交租；也可点"提前缴租"手动触发
   - 金币不足时，自动从存储区按 50% 价值出售物品补差
   - 补差后仍不足则游戏失败
5. **商店**：每轮缴租后可购买道具（每轮限 2 件）

### 物品与加成
| 物品 | Emoji | 标签 | 基础价值 |
|------|-------|------|---------|
| 骨头碎片 | 🦴 | bone | 10 |
| 矿石 | 🪨 | ore | 15 |
| 古钱币 | 🪙 | coin | 20 |
| 恐龙头骨 | 💀 | dino | 40 |
| 恐龙身体 | 🦕 | dino | 35 |
| 恐龙尾巴 | 🐉 | dino | 30 |

**加成规则（发车时计算）**：
- 相同标签 ≥ 2 件：所有同标签物品 +30%
- 完整恐龙套装（头骨+身体+尾巴）：恐龙物品 ×2
- 拥有"套装强化"道具：套装加成额外 +50%

### 道具列表
| 道具 | 效果 | 费用 |
|------|------|------|
| ⚡ 挖掘加速 | 工人挖掘速度 +20% | 30 |
| 💰 挖掘金币 | 每次挖掘额外 +1 金币 | 25 |
| 📦 存储增值 | 存储物品每轮价值 +10% | 40 |
| ✨ 套装强化 | 套装额外 +50% 价值加成 | 50 |
| 🚗 扩大车厢 | 车厢 +2 格 | 35 |
| 🏚️ 扩大存储 | 存储 +2 格 | 35 |
