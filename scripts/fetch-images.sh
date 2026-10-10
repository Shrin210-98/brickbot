#!/usr/bin/env bash
# Download licensed images to local paths. Existing files are skipped.
# Run from the repo root: make fetch-images
set -euo pipefail

# One "<url> <outpath>" pair per line; outpath is relative to the repo root
# (e.g. frontend/public/images/hero-home.jpg).
IMAGES=$(cat <<'EOF'
# Fill with Pexels URLs when swapping placeholders
EOF
)

fetched=0
skipped=0

while read -r url out; do
  [[ -z "${url:-}" || "$url" == \#* ]] && continue
  if [[ -e "$out" ]]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "fetch $url -> $out"
  curl -fsSL --create-dirs -o "$out" "$url"
  fetched=$((fetched + 1))
done <<< "$IMAGES"

echo "fetch-images: $fetched fetched, $skipped skipped"
