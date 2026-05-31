#!/bin/bash
LOG="/home/z/my-project/dev.log"
while true; do
  cd /home/z/my-project
  export NODE_OPTIONS="--max-old-space-size=256"
  npx next dev -p 3000 >> "$LOG" 2>&1 &
  PID=$!
  echo "[$(date)] Started Next.js PID=$PID" >> "$LOG"
  
  # Wait for process to die
  while kill -0 $PID 2>/dev/null; do
    sleep 2
  done
  
  echo "[$(date)] Process $PID died, restarting in 3s..." >> "$LOG"
  sleep 3
done
