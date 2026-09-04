#!/usr/bin/env bash
# get_fonts.sh — fetch the faces the reference corpus actually uses.
#
# Sourced rather than substituted. The Didone in h018, h043, h048, h058,
# h064 and h065 is the design of those sheets, not a detail of it, and
# setting them in a grotesque produces a different poster that happens to
# say the same words.
#
# Everything here is SIL Open Font Licence, which permits commercial use
# and embedding. The licence file is fetched alongside each one.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/fonts

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

grab () {                    # grab <family+spec> <out-name>
  local spec="$1" out="$2"
  local css url
  css=$(curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=${spec}&display=swap")
  # the latin subset is the last src in the file; take the woff2 from it
  url=$(printf '%s' "$css" | grep -o 'https://[^)]*\.woff2' | tail -1)
  [ -n "$url" ] || { echo "  no woff2 for $spec"; return 1; }
  curl -sS -A "$UA" -o "assets/fonts/$out" "$url"
  printf '  %-26s %6s bytes\n' "$out" "$(stat -c%s "assets/fonts/$out")"
}

echo 'sourcing the faces the references use:'
# Didone. The high-contrast serif six sheets are built on.
grab 'Bodoni+Moda:opsz,wght@6..96,700' bodoni-700.woff2
grab 'Bodoni+Moda:ital,opsz,wght@1,6..96,500' bodoni-italic.woff2
# A grotesque heavy enough for the sheets where one word is the design.
grab 'Archivo+Black' archivo-black.woff2
# A brush script, for the two sheets that turn on one.
grab 'Yellowtail' yellowtail.woff2
