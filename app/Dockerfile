# syntax=docker/dockerfile:1.19.0
# Dockerfile for a Node.js Fastify application
#
# Uses multi-stage build with official Node.js and distroless images.
# See: https://docs.docker.com/language/nodejs/build-images/

# Builder image: includes Node.js toolchain for compilation
ARG NODE_IMAGE=node:24.18.0-trixie-slim@sha256:ae91dcc111a68c9d2d81ff2a17bda61be126426176fde6fe7d08ab13b7f50573
# Runtime image: minimal distroless Node.js image (no shell, no package manager)
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:af85d11ce7ef10172855a6e3649e3e8125b1b9e3ca41849ec2918036f05cb212
# Build arguments for version injection
ARG VERSION=dev

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Install dependencies first for layer caching.
RUN corepack enable && corepack install --global pnpm@11.17.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# Build TypeScript to JavaScript
RUN pnpm build

# Production dependencies stage: install only production deps
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

# Install production dependencies only
RUN corepack enable && corepack install --global pnpm@11.17.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile

# Runtime stage: uses minimal distroless image
FROM ${RUNTIME_IMAGE} AS runtime

# OCI labels for image metadata
ARG RUNTIME_IMAGE
ARG VERSION
LABEL org.opencontainers.image.base.name="${RUNTIME_IMAGE}" \
      org.opencontainers.image.version="${VERSION}"

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled JavaScript
COPY --from=builder /app/dist ./dist

# Copy package.json for module resolution
COPY --from=builder /app/package.json ./package.json

# Run as non-root user (UID 65532 = nonroot in distroless)
# Numeric UID for Kubernetes runAsNonRoot policy compatibility
USER 65532:65532

# Cloud Run expects the server to listen on $PORT (default 8080)
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 8080

# Run the application (exec form for proper signal handling)
# Distroless nodejs images have Node.js as the entrypoint
CMD ["dist/server.js"]
