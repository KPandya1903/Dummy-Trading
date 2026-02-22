FROM node:20-alpine AS build

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY server/package.json server/

# Install dependencies
RUN npm ci --workspace=server

# Copy server source
COPY server/ server/
COPY tsconfig.base.json ./

# Generate Prisma client and compile TypeScript
RUN npx -w server prisma generate
RUN npm run -w server build

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/

RUN npm ci --workspace=server --omit=dev

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
