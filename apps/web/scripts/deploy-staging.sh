#!/bin/sh
# Publishes the test environment to Cloudflare, with the /ds/ catalogue included.
# wrangler is pinned here instead of being a dependency of the project.
set -eu

cd "$(dirname "$0")/.."

# «Palamós a peu» is not in the repository: it is copied in from where it is built, when it is there.
sh scripts/sync-palamos-world.sh

TRAM_DS=1 pnpm exec astro build

# The site now has a home: the root leads to it. The catalogue stays at /ds/.
printf '/ /ca/ 302\n' > dist/_redirects
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > dist/_headers

pnpm dlx wrangler@4.159.0 deploy
