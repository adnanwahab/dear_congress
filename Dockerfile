FROM oven/bun:1

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

ARG BUILD_COMMIT
RUN BUILD_COMMIT="$BUILD_COMMIT" bun scripts/write-build-identity.ts

ENV NODE_ENV=production
EXPOSE 8000

CMD ["bun", "server.ts"]
