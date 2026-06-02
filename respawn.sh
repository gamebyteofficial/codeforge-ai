#!/bin/bash
while true; do
  cd /home/z/my-project
  echo "[$(date)] Starting server..." >> /home/z/my-project/respawn.log
  npx next dev -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2s..." >> /home/z/my-project/respawn.log
  sleep 2
done
