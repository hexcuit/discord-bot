# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

FROM oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373 AS base
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
