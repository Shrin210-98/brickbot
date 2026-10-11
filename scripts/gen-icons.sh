#!/usr/bin/env bash
# Renders the PWA icons in frontend/public/icons/ from the SVG sources.
# Runs rsvg-convert in a throwaway alpine container (no host toolchain).
# Georgia isn't packaged for alpine, so the B falls back to DejaVu Serif Bold.
# The PNGs are committed; rerun this only when favicon.svg or maskable.svg change.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$root/frontend/public/icons"

docker run --rm \
  -v "$root/frontend/public:/public" \
  -v "$root/scripts/icons:/src:ro" \
  alpine:3.22 sh -euc '
    apk add --no-cache --quiet rsvg-convert font-dejavu
    out=/public/icons
    rsvg-convert -w 192 -h 192 /public/favicon.svg -o $out/icon-192.png
    rsvg-convert -w 512 -h 512 /public/favicon.svg -o $out/icon-512.png
    rsvg-convert -w 512 -h 512 /src/maskable.svg -o $out/icon-maskable-512.png
    # iOS rounds the corners itself and shows transparency as black: use the full-bleed art.
    rsvg-convert -w 180 -h 180 /src/maskable.svg -o $out/apple-touch-icon.png
    chown '"$(id -u):$(id -g)"' $out/*.png
  '

ls -l "$root/frontend/public/icons"
