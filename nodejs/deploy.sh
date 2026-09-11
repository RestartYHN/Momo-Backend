#!/bin/bash
# 部署准备脚本：安装依赖并构建，产物在 dist/
set -e

echo "开始部署准备..."

echo "1. 安装依赖..."
pnpm install

# 2. 数据库（可选）
# 评论线上由 Cloudflare Worker（D1）承载，Node 版的 Prisma/SQLite 库默认不使用。
# 仅当你要用 Node 版的评论/管理端时才需要初始化数据库：
#   pnpm db:dev      本地开发：创建/更新本地 SQLite（并生成迁移文件）
#   pnpm db:deploy   生产：应用已提交的 prisma/migrations（需先把迁移纳入版本控制）
echo "2. 跳过数据库迁移（Node 版生产不使用评论库）"

echo "3. 构建项目..."
pnpm build

echo "构建完成：dist/"
