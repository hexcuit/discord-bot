# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

FROM oven/bun:1.3.6-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS base
WORKDIR /app

# Build stage
FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM base AS runtime
COPY --from=build /app/dist ./dist

# Run as non-root user
USER bun

CMD ["sh", "-c", "bun dist/scripts/deploy-commands.js && bun dist/src/index.js"]
