#!/bin/sh
# Publishes the test environment to Cloudflare, with the /ds/ catalogue included.
# wrangler is pinned here instead of being a dependency of the project.
set -eu

cd "$(dirname "$0")/.."

TRAM_DS=1 pnpm exec astro build

printf '/ /ds/ 302\n' > dist/_redirects
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > dist/_headers

pnpm dlx wrangler@4.159.0 deploy
