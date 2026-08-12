# 纯前端博客系统 ✍️

> 一个**零后端依赖**、开箱即用的博客系统 —— 基于 React + Vite，数据存于浏览器 IndexedDB，仅管理员可发布文章，**支持 Vercel / Netlify / Cloudflare Pages 一键部署**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Build-Vite-646cff.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/UI-React%2018-61dafb.svg)](https://react.dev/)

---

## ✨ 核心特性

- **纯前端架构**：无需任何后端服务，构建产物可直接部署到任意静态托管平台
- **本地数据库**：使用 IndexedDB（Dexie.js 封装）在浏览器中持久化文章
- **仅管理员发布**：通过环境变量配置的管理员密码登录后，才能新建 / 编辑 / 删除文章
- **Markdown 写作**：支持 GFM 语法（标题、列表、代码块、引用、表格、链接、图片…），左右分栏实时预览
- **SEO 友好**：基于 slug 的文章链接 `#/post/文章别名`，自动生成别名且去重
- **摘要系统**：支持自动摘要（从正文提取前 N 字）或自定义摘要
- **标签分类**：为每篇文章打标签，前台显示
- **Hash 路由**：避免部署时的 SPA 路由 404 麻烦（同时配置了各平台回退规则兜底）
- **响应式设计**：移动端友好的自适应布局
- **一键部署**：已预置 Vercel / Netlify / Cloudflare Pages 三大平台的完整配置与部署按钮

---

## 🚀 快速开始

### 环境要求

- Node.js **18+**
- npm（推荐）或 pnpm / yarn

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,设置 VITE_ADMIN_PASSWORD 为强密码（仅发布文章用）

# 3. 启动开发服务器 (默认 http://localhost:5173)
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可查看博客。
管理员登录入口在右上角 **「管理员登录」**，使用 `.env` 中设置的 `VITE_ADMIN_PASSWORD` 登录。

### 生产构建

```bash
npm run build      # 产物输出到 dist/ 目录
npm run preview    # 本地预览生产构建
```

---

## 🔑 环境变量

所有变量必须以 `VITE_` 开头（Vite 构建时注入前端代码的规则）。

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `VITE_ADMIN_PASSWORD` | ✅ | — | 管理员登录密码（用于发布/编辑/删除文章）|
| `VITE_SITE_TITLE` | ⚪ | `我的博客` | 站点名称，显示在导航栏和页脚 |

> ⚠️ **安全提示**：由于是纯前端应用，`VITE_*` 变量会被打包进浏览器可读取的 JS bundle。因此管理员密码仅能起到"阻挡普通用户"的作用。若你的场景需要真正的强安全认证，请改为接入后端鉴权服务（如 Supabase Auth / Auth.js）。

---

## 📁 目录结构

```
.
├── public/                 # 静态资源（构建时原样拷贝到 dist）
│   ├── _redirects          # Cloudflare Pages SPA 回退规则
│   └── favicon.svg         # 站点图标
├── src/
│   ├── components/
│   │   └── Navbar.jsx      # 顶部导航栏
│   ├── pages/
│   │   ├── Home.jsx            # 首页 - 文章列表
│   │   ├── PostDetail.jsx      # 文章详情 - Markdown 渲染
│   │   ├── AdminLogin.jsx      # 管理员登录页
│   │   ├── AdminDashboard.jsx  # 后台仪表盘
│   │   ├── PostEditor.jsx      # 写新文章 / 编辑文章编辑器
│   │   └── NotFound.jsx        # 404 页
│   ├── App.jsx             # 主组件 + hash 路由分发
│   ├── main.jsx            # React 入口
│   ├── db.js               # IndexedDB (Dexie) 数据库层
│   ├── auth.js             # 管理员认证（密码校验 + sessionStorage）
│   ├── router.js           # 极简 hash 路由
│   ├── utils.js            # 日期格式化 / 摘要提取工具
│   └── styles.css          # 全局样式
├── .env                    # 本地环境变量（不提交到 git）
├── .env.example            # 环境变量模板（提交）
├── DEPLOY.md               # 三平台一键部署文档（含部署按钮）
├── vercel.json             # Vercel 配置
├── netlify.toml            # Netlify 配置
├── wrangler.toml           # Cloudflare Pages (Wrangler CLI) 配置
├── vite.config.js          # Vite 构建配置
├── package.json
├── LICENSE                 # MIT 协议
└── README.md               # 即本文档
```

---

## 🛠 功能说明

### 文章存储（IndexedDB）

文章表 `posts` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | 自增主键 | 文章 ID |
| slug | string, 唯一索引 | URL 别名，自动生成并去重 |
| title | string | 标题 |
| content | string | Markdown 正文 |
| excerpt | string | 摘要（自动或自定义） |
| tags | string[] | 标签数组 |
| createdAt | number, 索引 | 创建时间戳 |
| updatedAt | number, 索引 | 更新时间戳 |

数据按**浏览器 + 域名**隔离，不同浏览器 / 不同域名互不可见。如需跨设备同步，可自行增加导出 / 导入功能或接入后端。

### 管理员认证

密码存储在构建产物中（环境变量注入）。登录成功后，会在 `sessionStorage` 写入一个 8 小时有效的会话标记，关闭标签页或超过有效期后自动登出。

- 受保护路由：`#/admin/*` 全部需要登录
- 密码比较：使用**常量时间 XOR 比较**，避免侧信道计时攻击

### Markdown 渲染

使用 `marked` 库，已启用：
- GFM（GitHub Flavored Markdown）支持
- 换行符自动转 `<br>`
- 代码块 + 内联代码样式
- 表格、引用、图片、链接全部支持

---

## ☁️ 一键部署

> 完整的部署说明见 [DEPLOY.md](./DEPLOY.md)（含三平台官方一键部署按钮）。

### Vercel

仓库已包含 [vercel.json](./vercel.json)，在 Vercel 平台**直接 Import 仓库**即可：

1. **Framework Preset**：自动识别为 Vite ✓
2. **Root Directory**：默认 ✓
3. **Build Command**：`npm run build`（自动识别）✓
4. **Output Directory**：`dist`（自动识别）✓
5. **Environment Variables**：添加 `VITE_ADMIN_PASSWORD`（必加）、`VITE_SITE_TITLE`（可选）
6. 点击 Deploy，完成！

### Netlify

仓库已包含 [netlify.toml](./netlify.toml)，直接 **Add new site → Import an existing project**：

- Build command：`npm run build`
- Publish directory：`dist`
- **Site settings → Environment variables**：添加 `VITE_ADMIN_PASSWORD`（必加），保存后触发一次重新部署

### Cloudflare Pages

仓库已包含 [public/_redirects](./public/_redirects) 与 [wrangler.toml](./wrangler.toml)：

- **Framework preset**：Vite
- **Build command**：`npm run build`
- **Build output directory**：`dist`
- **Environment variables**：添加 `VITE_ADMIN_PASSWORD`、`NODE_VERSION=18`

---

## ❓ FAQ

**Q: 清空浏览器数据 / 换浏览器后文章不见了？**
A: 是的，本项目是纯前端，文章存储在该浏览器的 IndexedDB 中。不同浏览器 / 设备 / 隐私模式之间不互通。

**Q: 可以多人协作吗？**
A: 架构上只支持单一管理员角色。多人协作需要后端服务来同步文章数据，本项目未提供。

**Q: 管理员密码被逆向怎么办？**
A: 这是纯前端方案的固有局限。如果博客内容敏感、需要多人维护或有合规要求，强烈建议升级为带后端的架构。

**Q: 如何修改主题 / 品牌色？**
A: 编辑 [src/styles.css](./src/styles.css) 顶部 `:root` 下的 CSS 变量（`--primary`、`--bg`、`--text` 等）。

---

## 📄 License

**MIT License** © Meng1Qinghai (Changliu7Stream)

详见 [LICENSE](./LICENSE) 文件。
