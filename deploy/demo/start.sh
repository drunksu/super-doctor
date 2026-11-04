#!/bin/sh
set -eu

# A demo deployment has no secrets. Generate a per-boot signing key so the demo account works
# without shipping a fixed JWT secret; sessions simply do not survive a restart, which is fine for
# a demo and honest about what it is.
if [ -z "${JWT_SECRET:-}" ]; then
    JWT_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n=')"
    export JWT_SECRET
fi

PORT="${PORT:-7860}"
export PORT

cd /app/api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info &
API_PID=$!

cd /app/web
node node_modules/next/dist/bin/next start -p 3000 &
WEB_PID=$!

cleanup() {
    kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup TERM INT

# Wait for the API before taking traffic, but never block the host from starting: if it is slow,
# nginx comes up anyway and the visitor sees a real error instead of a blank page.
tries=0
while [ "$tries" -lt 90 ]; do
    if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null 2>&1; then
        echo "api ready after ${tries}s"
        break
    fi
    tries=$((tries + 1))
    sleep 1
done

# nginx creates its temp leaf directories on start but not their parents, and the compiled-in
# prefix is not writable here. Make the tree first.
mkdir -p /tmp/nginx/client /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi

sed "s/__PORT__/${PORT}/" /app/nginx.conf > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf
