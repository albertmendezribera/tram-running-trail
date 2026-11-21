#!/bin/sh
# Brings «Palamós a peu» into the site: a separate program (a Godot web export of some 52 MB) that is
# built in another repository and is not kept in this one. Its files are copied to public/mon/palamos/,
# which git ignores, and the build serves them at /mon/palamos/.
# Usage (from anywhere): sh apps/web/scripts/sync-palamos-world.sh
#   TRAM_PALAMOS_DIST=/path/to/web-dist  to take the bundle from somewhere else.
# Without a bundle it says so and ends well: CI has none, and the page says the game is not there.
set -eu

cd "$(dirname "$0")/.."

SOURCE="${TRAM_PALAMOS_DIST:-$HOME/ProjectesClaude/TRAM/palamos-open-world/build/web-dist}"

if [ ! -f "$SOURCE/manifest.json" ] || [ ! -f "$SOURCE/index.html" ]; then
  echo "Palamós a peu: no bundle at $SOURCE (no manifest.json or no index.html). Nothing copied: this build will not carry the game."
  exit 0
fi

# Cloudflare takes no file over 25 MiB: said here, before a deploy fails on it.
LIMIT=26214400
for file in "$SOURCE"/*; do
  [ -f "$file" ] || continue
  size=$(wc -c < "$file" | tr -d ' ')
  if [ "$size" -gt "$LIMIT" ]; then
    echo "Palamós a peu: $(basename "$file") is $size bytes, over Cloudflare's 25 MiB a file. Nothing copied." >&2
    exit 1
  fi
done

# The files of an older build must not outlive it (the world comes in a number of parts that changes).
# Only this fixed path is ever removed.
rm -rf public/mon/palamos
mkdir -p public/mon/palamos

total=0
count=0
for file in "$SOURCE"/*; do
  [ -f "$file" ] || continue
  cp "$file" public/mon/palamos/
  size=$(wc -c < "$file" | tr -d ' ')
  total=$((total + size))
  count=$((count + 1))
  printf '  %10s  %s\n' "$size" "$(basename "$file")"
done

echo "Palamós a peu: $count files, $((total / 1000000)) MB, from $SOURCE to apps/web/public/mon/palamos/"
