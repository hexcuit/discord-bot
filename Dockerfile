# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS base
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
