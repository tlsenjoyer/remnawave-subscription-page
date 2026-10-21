ARG BUILDPLATFORM
FROM --platform=${BUILDPLATFORM:-linux/amd64} node:24-bookworm-slim AS frontend-build
WORKDIR /opt/frontend
COPY frontend/package*.json ./
COPY frontend/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run start:build

FROM node:24-bookworm-slim AS backend-build
WORKDIR /opt/app
COPY backend/package*.json ./
COPY backend/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN NODE_ENV=production npm run build && npm run trace

FROM node:24-bookworm-slim
WORKDIR /opt/app
ARG RELEASE_VERSION=2.2.0
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Товарищ VPN Subscription Page" \
      org.opencontainers.image.description="Theme-aware subscription frontend with upstream Remnawave API compatibility" \
      org.opencontainers.image.url="https://github.com/tlsenjoyer/remnawave-subscription-page" \
      org.opencontainers.image.source="https://github.com/tlsenjoyer/remnawave-subscription-page" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /opt/app/dist ./dist
COPY --from=frontend-build /opt/frontend/dist ./frontend
COPY backend/ecosystem.config.js backend/docker-entrypoint.sh ./
ENV PM2_DISABLE_VERSION_CHECK=true
ENV NODE_OPTIONS="--max-old-space-size=16384"
RUN npm install pm2@6.0.14 -g --no-audit --no-fund \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/include/node
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --start-interval=2s --retries=3 \
    CMD curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${APP_PORT:-3010}/internal/health" || exit 1
ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
