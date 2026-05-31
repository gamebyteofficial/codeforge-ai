#!/bin/bash
while true; do
  if ! lsof -i :3000 >/dev/null 2>&1; then
    echo "[$(date)] Restarting dev server..." >> /home/z/my-project/dev-restart.log
    cd /home/z/my-project
    npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    sleep 5
  fi
  sleep 3
done
