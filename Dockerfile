# ── Stage 1: Build the React client ──────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install build tools needed by better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy server dependencies manifest and install production deps only
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy server source
COPY server/ ./server/

# Copy the built React app into the server's public directory
COPY --from=client-builder /app/client/dist ./server/public

# Cloud Run sets PORT; default to 8080 if not provided
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Seed the database, then start the server
# The entrypoint seeds on every cold start so state is always fresh
CMD ["sh", "-c", "node server/seed.js && node server/server.js"]
