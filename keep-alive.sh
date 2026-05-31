#!/bin/bash
cd /home/z/my-project
while true; do
  bun run dev > dev.log 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Starting dev server (PID: $SERVER_PID)" >> keep-alive.log
  sleep 5
  # Check if it's still running
  if kill -0 $SERVER_PID 2>/dev/null; then
    echo "[$(date)] Server running (PID: $SERVER_PID)" >> keep-alive.log
    # Wait for it to die
    wait $SERVER_PID 2>/dev/null
    echo "[$(date)] Server died (PID: $SERVER_PID), restarting..." >> keep-alive.log
  else
    echo "[$(date)] Server failed to start, retrying..." >> keep-alive.log
  fi
  sleep 2
done
