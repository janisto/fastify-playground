# Justfile for Fastify Playground
# https://github.com/casey/just

set dotenv-load := true

PORT := env("PORT", "8080")

# Container runtime: prefer podman, fallback to docker
CONTAINER_RUNTIME := if `command -v podman 2>/dev/null || true` != "" { "podman" } else { "docker" }


# Default recipe - show available commands
default:
    @just --list

# Container tasks
[group('container')]
container-build image="fastify-playground:latest" version="dev" runtime_img="":
    {{ CONTAINER_RUNTIME }} build \
        --build-arg VERSION={{ version }} \
        {{ if runtime_img != "" { "--build-arg RUNTIME_IMAGE=" + runtime_img } else { "" } }} \
        -t {{ image }} ./app

[group('container')]
container-up image="fastify-playground:latest" name="fastify-playground" port=PORT:
    {{ CONTAINER_RUNTIME }} run -d --rm --name {{ name }} \
        {{ if path_exists(".env") == "true" { "--env-file .env" } else { "" } }} \
        -p {{ port }}:8080 {{ image }}

[group('container')]
container-logs name="fastify-playground":
    {{ CONTAINER_RUNTIME }} logs -f {{ name }}

[group('container')]
container-down name="fastify-playground":
    -{{ CONTAINER_RUNTIME }} stop {{ name }}
