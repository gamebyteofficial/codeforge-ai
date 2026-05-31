#!/bin/bash
# Persistent dev server script with auto-restart
while true; do
  cd /home/z/my-project
  bun next dev -p 3000 2>&1
  echo "=== Server crashed/exited, restarting in 2s ==="
  sleep 2
done
