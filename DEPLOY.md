# 一键部署指南

本项目已为 **Vercel / Netlify / Cloudflare Pages** 三大静态托管平台预置了完整配置，可一键部署上线。

> 💡 **先决条件**：将本项目推送到 GitHub / GitLab 公有仓库（三大平台均支持 Git 仓库一键导入）。
> 下面示例中出现的 `REPO_URL` 请替换为你的仓库 HTTPS 地址，例如 `https://github.com/your-username/pure-frontend-blog`。

---

## 🚀 一键部署按钮

点击下方按钮即可直接跳转对应平台的部署向导。

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=REPO_URL&env=VITE_ADMIN_PASSWORD,VITE_SITE_TITLE&envDescription=%E7%AE%A1%E7%90%86%E5%91%98%E5%AF%86%E7%A0%81%E4%B8%8E%E7%AB%99%E7%82%B9%E5%90%8D%E7%A7%B0%EF%BC%88%E7%AB%99%E7%82%B9%E5%90%8D%E7%A7%B0%E5%8F%AF%E9%80%89%EF%BC%89&envLink=https%3A%2F%2Fgithub.com%2Fyour-username%2Fpure-frontend-blog%2Fblob%2Fmain%2F.env.example&project-name=pure-frontend-blog&repository-name=pure-frontend-blog)

> 部署向导中填写环境变量：
> - `VITE_ADMIN_PASSWORD`（必填）：管理员登录密码
> - `VITE_SITE_TITLE`（可选）：站点名称

### Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=REPO_URL)

部署后，前往 **Site settings → Environment variables** 添加：
- `VITE_ADMIN_PASSWORD`（必填）
- `VITE_SITE_TITLE`（可选）

然后重新触发一次部署（**Deploys → Trigger deploy**）以应用环境变量。

### Cloudflare Pages
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=REPO_URL)

向导中填写：
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Environment variables (advanced)**:
  - `VITE_ADMIN_PASSWORD`（必填）
  - `VITE_SITE_TITLE`（可选）
  - `NODE_VERSION`: `18`（建议显式指定）

---

## ⚙️ 平台配置详解

所有平台相关配置文件已包含在仓库中，无需手动创建。

| 平台 | 配置文件 | 作用 |
|---|---|---|
| **Vercel** | [vercel.json](./vercel.json) | 指定构建命令、输出目录、SPA 路由回退规则、资源缓存 |
| **Netlify** | [netlify.toml](./netlify.toml) | 指定构建、发布目录、重定向规则、响应头（安全头、资源缓存） |
| **Cloudflare Pages** | [public/_redirects](./public/_redirects)、[wrangler.toml](./wrangler.toml) | SPA 回退规则、Wrangler CLI 配置 |

---

## 🔑 环境变量说明

所有环境变量**必须**以 `VITE_` 开头，Vite 才会在构建时将它们注入前端代码。

| 变量 | 必填 | 说明 |
|---|---|---|
| `VITE_ADMIN_PASSWORD` | ✅ | 管理员登录密码。建议至少 12 位，包含大小写+数字+符号。 |
| `VITE_SITE_TITLE` | ⚪ | 站点显示名称，默认 `我的博客`。 |

> ⚠️ **安全提示**：由于是纯前端应用，`VITE_*` 变量会被打包进 JS bundle，任何访问网站的用户理论上都能通过浏览器开发者工具逆向得到。因此此密码仅用于阻挡非技术人员随意访问后台。若需要真正强安全的管理员鉴权，建议增加后端服务（如 Supabase Auth / Cloudflare Functions 等）。

---

## 🛠 各平台手动部署流程（兜底方案）

### Vercel CLI
```bash
npm i -g vercel
vercel           # 首次部署 (preview)
vercel --prod    # 部署到生产环境
```

### Netlify CLI
```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

### Cloudflare Wrangler CLI
```bash
npm i -g wrangler
npm run build
wrangler pages deploy dist --project-name=pure-frontend-blog
```
