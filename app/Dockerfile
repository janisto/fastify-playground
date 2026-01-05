# syntax=docker/dockerfile:1.19.0
# Dockerfile for a Node.js Fastify application
#
# Uses multi-stage build with official Node.js and distroless images.
# See: https://docs.docker.com/language/nodejs/build-images/
#
# Cloud Run automatic base image updates:
# Deploy with automatic base image updates so Google can patch the base without a rebuild:
#   gcloud run deploy fastify-playground \
#     --image REGION-docker.pkg.dev/PROJECT_ID/REPO/fastify-playground:latest \
#     --platform managed \
#     --region REGION \
#     --base-image nodejs24 \
#     --automatic-updates

# Builder image: includes Node.js toolchain for compilation
ARG NODE_IMAGE=node:24-trixie-slim
# Runtime image: minimal distroless Node.js image (no shell, no package manager)
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot
# Build arguments for version injection
ARG VERSION=dev

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
# Uses bind mounts for package files and cache mount for npm cache
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --ignore-scripts

# Copy source and build
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Production dependencies stage: install only production deps
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

# Install production dependencies only
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --omit=dev --ignore-scripts

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
CMD ["dist/app.js"]
