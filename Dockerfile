# ---------- 1) build the client ----------
FROM node:20-bookworm AS client_build
WORKDIR /app/client

# Install deps with caching
COPY client/package*.json ./
RUN npm ci

# Build
COPY client/ ./
RUN npm run build


# ---------- 2) install server deps ----------
FROM node:20-bookworm AS server_deps
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./


# ---------- 3) runtime image ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Server code + node_modules
COPY --from=server_deps /app/server /app/server

# Built client output (Vite usually outputs to client/dist)
COPY --from=client_build /app/client/dist /app/server/public

# Persistent data folder (SQLite, etc.)
RUN mkdir -p /app/server/data

EXPOSE 3000

CMD ["node", "server/index.js"]