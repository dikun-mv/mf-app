#!/bin/sh
# Remote container start-up hook (ADR 031). Runs from /docker-entrypoint.d/ in the
# nginx image, before nginx starts.
#
# The build writes <base href="/remotes/<name>/"> into index.html, so the image
# is already right behind the gateway. When BASE_PATH is set, this rewrites that
# tag, which lets the same image serve its standalone page from another path.
# It is the only place a path is configured: the remote derives its router
# basename from document.baseURI (ADR 029).
#
#   BASE_PATH   optional, e.g. /other/people/   (a trailing slash is added)
#   HTML_FILE   default /usr/share/nginx/html/index.html (for tests)
#
# Note that the gateway only routes /remotes/<name>/, so a different BASE_PATH
# also needs a route for it. Only the standalone index.html is touched;
# remoteEntry.js and chunks already resolve relative to their own URL
# (assetPrefix: 'auto').

set -eu

HTML_FILE="${HTML_FILE:-/usr/share/nginx/html/index.html}"

if [ -z "${BASE_PATH:-}" ]; then
  exit 0
fi

case "$BASE_PATH" in
  /*) ;;
  *)
    echo "remote entrypoint: BASE_PATH '$BASE_PATH' must start with /" >&2
    exit 1
    ;;
esac

# The value goes into an HTML attribute.
case "$BASE_PATH" in
  *[\"\'\<\>\ ]*)
    echo "remote entrypoint: BASE_PATH '$BASE_PATH' may not contain quotes, <, > or spaces" >&2
    exit 1
    ;;
esac

# <base href> resolves relative URLs against a directory, so it must end in /.
case "$BASE_PATH" in
  */) base="$BASE_PATH" ;;
  *) base="$BASE_PATH/" ;;
esac

# The build's HTML minifier may drop the quotes around the value, so accept
# double-quoted, single-quoted and bare attribute values.
if ! grep -Eq '<base href=' "$HTML_FILE"; then
  echo "remote entrypoint: no <base href> in $HTML_FILE to rewrite" >&2
  exit 1
fi

# Escape the characters that are special in a sed replacement (# is the delimiter).
escaped=$(printf '%s' "$base" | sed -e 's/[\\#&]/\\&/g')
sed -E -i "s#<base href=(\"[^\"]*\"|'[^']*'|[^ >]+)#<base href=\"$escaped\"#" "$HTML_FILE"

echo "remote entrypoint: <base href> set to $base"
