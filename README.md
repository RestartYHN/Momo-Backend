<div align="center">
<h1>Momo Backend</h1>
<span>
<img src="https://img.shields.io/badge/Node->=22-green" alt="Node">
<img src="https://img.shields.io/badge/Cloudflare-Worker-orange?logo=cloudflare" alt="Cloudflare Worker">
<img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white" alt="Go">
</span>
</div>

<div align="center">
<span>
<img src="https://img.shields.io/badge/SQLite-3E8E41?logo=sqlite&logoColor=white" alt="SQLite">
<img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TS">
<img src="https://img.shields.io/badge/Hono-FF6B35?logo=hono&logoColor=white" alt="Hono">
<img src="https://img.shields.io/badge/Koa-33333D?logo=koa&logoColor=white" alt="Koa">
<img src="https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white" alt="Svelte">
<img src="https://img.shields.io/badge/Vue-3.5+-4FC08D?logo=vue.js&logoColor=white" alt="Vue">
</span>
</div>

<div align="center">
轻量，便捷，易部署的博客评论系统
</div>

> 本项目基于 [Motues/Momo-Backend](https://github.com/Motues/Momo-Backend) 进行了大量功能增强。

## 功能

### 基础评论
- 多级嵌套评论，Markdown 渲染
- XSS 防护，IP 频率限制
- SMTP 邮件通知（新评论 / 回复提醒，自定义模板）
- 管理员面板（Vue 3 + ECharts 统计）

### 互动增强
- **点赞** — 指纹去重，每人每评论一次
- **表情反应** — 10 种 emoji（❤️😂😅👀🎉😮😆😉😭🍀），独立于点赞
- **评论置顶** — 多条置顶，按置顶时间排序
- **图片上传** — 评论/回复支持粘贴和文件上传，存储到 R2
- **Q&A 管理** — `about-qa` 专区，问题待审队列，管理端独立页面
- **Memo 反应** — 碎碎念独立反应系统，管理端可编辑计数

### 安全与运维
- 邮箱黑名单
- 管理员编辑/删除评论（含硬删除）
- 用户指纹追踪（SHA-256: IP + UA + Accept-Language）
- QQ Bot 新评论通知（NapCat）
- 数据导出/导入（JSON）

## 部署

提供三种后端实现：

| 版本 | 技术栈 | 环境要求 | 适用场景 |
|------|--------|----------|----------|
| **Cloudflare Worker** | Hono + D1 + KV + R2 | Wrangler CLI | 无需服务器，功能最全 |
| **Go** | Gin + SQLite | Go >= 1.25 | 单二进制部署，高性能 |
| **Node.js** | Koa + Prisma + SQLite | Node.js >= 22, pnpm | 有 Node 环境的服务器 |

### Worker 部署（推荐）

```bash
cd worker
pnpm install
npx wrangler deploy
```

前置条件：Cloudflare 账号，创建 D1 数据库 `MOMO_DB`、KV 命名空间 `MOMO_AUTH_KV`、R2 桶 `gallery`，配置 `wrangler.jsonc`。

详见 [Worker 部署文档](./worker/README.md)

### Go 部署

从 [Release](https://github.com/RestartYHN/Momo-Backend/releases) 下载对应平台的二进制文件，或自行编译：

```bash
cd go
go build -o momo-backend main.go
./momo-backend
```

默认监听 `:17171`。通过 `PORT` 环境变量或 `./config/config.yaml` 修改端口。

详见 [Go 部署文档](./go/README.md)

### Node.js 部署

```bash
cd nodejs
pnpm install
cp .env.example .env   # 编辑配置
pnpm dev               # 开发模式
pnpm build && pnpm start  # 生产模式
```

详见 [Node.js 部署文档](./nodejs/README.md)

### 管理面板

Vue 3 构建的可视化管理面板，部署后访问 `/admin`。默认账号密码均为 `momo`，首次登录需修改。

```bash
cd dashboard
pnpm install
pnpm build            # 输出到 dist/
# 将 dist/ 内容放到对应后端的 public/ 目录
```

## 文档

- [API 文档](./doc/api.md)
- [数据库表结构](./doc/data_table.md)
- [原项目](https://github.com/Motues/Momo-Backend)

> Made with ❤️ by [Motues](https://wwww.motues.top) · Enhanced by [RestartYHN](https://github.com/RestartYHN)
