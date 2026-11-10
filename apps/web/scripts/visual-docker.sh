#!/bin/sh
# Runs the visual regression in the CI image, from a clean copy of the repo.
# Usage (from apps/web): sh scripts/visual-docker.sh [--update-snapshots]
set -eu

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)

exec docker run --rm --platform linux/amd64 \
  -v "$ROOT:/source" \
  -e CI=1 \
  -e HOME=/root \
  -e TRAM_EMULATED=1 \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c '
    set -e
    mkdir /work
    cd /source
    tar --exclude=node_modules --exclude=.astro --exclude=apps/web/dist --exclude=.git -cf - . | tar -xf - -C /work
    cd /work
    corepack enable
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    pnpm install --frozen-lockfile
    status=0
    pnpm --filter @tram/web exec playwright test '"$*"' || status=$?
    rm -rf /source/apps/web/tests/__screenshots__
    cp -R apps/web/tests/__screenshots__ /source/apps/web/tests/__screenshots__ 2>/dev/null || true
    rm -rf /source/apps/web/test-results
    cp -R apps/web/test-results /source/apps/web/test-results 2>/dev/null || true
    exit $status
  '
