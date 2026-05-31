#!/bin/bash
# Keep-alive script for the dev server
# Restarts the server if it dies
cd /home/z/my-project

while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3000 '; then
    echo "[$(date)] Server not running, starting..." >> /home/z/my-project/dev.log
    npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    sleep 8
  fi
  sleep 10
done
