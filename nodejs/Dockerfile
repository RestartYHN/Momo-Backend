FROM node:18-alpine

WORKDIR /app

# Use Corepack to activate the pnpm version declared in packageManager
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Copy package manifests and tsconfig early for better caching
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY prisma ./prisma

# Copy rest of the project
COPY . .

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Remove dev dependencies to keep image lean
RUN pnpm prune --prod || true

ENV PORT=17171
EXPOSE 17171

CMD ["pnpm", "start"]
