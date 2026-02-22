FROM node:20-alpine AS build

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY client/package.json client/

# Install dependencies
RUN npm ci --workspace=client

# Copy client source
COPY client/ client/
COPY tsconfig.base.json ./

# Build the Vite app
RUN npm run -w client build

# ── Production stage ──────────────────────────────────────
FROM nginx:alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
