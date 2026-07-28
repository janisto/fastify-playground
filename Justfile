# Justfile for Fastify Playground
# https://github.com/casey/just

set dotenv-load
set positional-arguments

PORT := env("PORT", "3000")
CONTAINER_PORT := env("CONTAINER_PORT", "8080")
FUZZ_RUNS := env("FUZZ_RUNS", "1000")

# Container runtime: prefer podman, fallback to docker
CONTAINER_RUNTIME := if `command -v podman 2>/dev/null || true` != "" { "podman" } else { "docker" }

@_:
    just --list

# Run all tests
[group('test')]
[working-directory('app')]
test *args:
    corepack pnpm test {{ args }}

# Run unit tests only
[group('test')]
[working-directory('app')]
test-unit *args:
    corepack pnpm exec vitest run tests/unit {{ args }}

# Run integration tests only
[group('test')]
[working-directory('app')]
test-integration *args:
    corepack pnpm exec vitest run tests/integration {{ args }}

# Run property tests with a longer configurable campaign
[group('test')]
[working-directory('app')]
fuzz *args:
    FUZZ_RUNS={{ FUZZ_RUNS }} corepack pnpm exec vitest run tests/property {{ args }}

# Run tests and measure coverage
[group('test')]
[working-directory('app')]
@cov:
    corepack pnpm test:coverage

# Run linters and auto-fix issues
[group('qa')]
[working-directory('app')]
fix:
    corepack pnpm check:fix

# Run linters and formatting checks
[group('qa')]
[working-directory('app')]
lint:
    corepack pnpm check

# Check types
[group('qa')]
[working-directory('app')]
typing:
    corepack pnpm typecheck

# Quality assurance: fix, type check, and test
[group('qa')]
qa: fix typing test

# Perform all non-mutating checks, including the production dependency audit
[group('qa')]
check: workflow-check lint typing test cov audit

# Check GitHub Actions syntax and security
[group('qa')]
workflow-check:
    actionlint
    zizmor --offline .

# Audit production dependencies against registry advisories
[group('qa')]
[working-directory('app')]
audit:
    corepack pnpm audit --prod --audit-level high

# Run development server
[group('run')]
[working-directory('app')]
serve:
    corepack pnpm dev

# Send HTTP request to development server
[group('run')]
req path="" *args:
    #!/usr/bin/env sh
    path="$1"
    shift
    curl --fail-with-body --silent --show-error "$@" "http://127.0.0.1:{{ PORT }}/$path"

# Open development server in web browser
[group('run')]
browser:
    #!/usr/bin/env sh
    set -eu
    url="http://127.0.0.1:{{ PORT }}/"
    if command -v open >/dev/null 2>&1; then
        open "$url"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url"
    else
        echo "No supported browser opener found" >&2
        exit 1
    fi

# Container tasks
[group('container')]
container-build image="fastify-playground:latest" version="dev" runtime_img="":
    {{ CONTAINER_RUNTIME }} build \
        --build-arg VERSION={{ version }} \
        {{ if runtime_img != "" { "--build-arg RUNTIME_IMAGE=" + runtime_img } else { "" } }} \
        -t {{ image }} ./app

[group('container')]
container-up image="fastify-playground:latest" name="fastify-playground" port=CONTAINER_PORT:
    {{ CONTAINER_RUNTIME }} run -d --rm --name {{ name }} \
        {{ if path_exists(".env") == "true" { "--env-file .env" } else { "" } }} \
        -p {{ port }}:8080 {{ image }}

[group('container')]
container-logs name="fastify-playground":
    {{ CONTAINER_RUNTIME }} logs -f {{ name }}

[group('container')]
container-down name="fastify-playground":
    -{{ CONTAINER_RUNTIME }} stop {{ name }}

# Update dependencies within the versions allowed by package.json
[group('lifecycle')]
[working-directory('app')]
update:
    corepack pnpm update

# Install dependencies exactly as locked
[group('lifecycle')]
[working-directory('app')]
install:
    corepack pnpm install --frozen-lockfile

# Remove generated files and installed dependencies
[group('lifecycle')]
clean:
    rm -rf app/node_modules app/coverage app/dist
    rm -f app/firebase-debug.log firebase-debug.log

# Recreate installed dependencies from nothing
[group('lifecycle')]
fresh: clean install
