const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'dev.log');

function startServer() {
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  const child = spawn('bun', ['run', 'dev'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  const timestamp = () => new Date().toISOString();
  logStream.write(`\n[${timestamp()}] Server starting (PID: ${child.pid})...\n`);
  
  child.stdout.on('data', (data) => {
    logStream.write(data);
  });
  
  child.stderr.on('data', (data) => {
    logStream.write(data);
  });
  
  child.on('exit', (code, signal) => {
    logStream.write(`[${timestamp()}] Server exited (code: ${code}, signal: ${signal}). Restarting in 3s...\n`);
    setTimeout(startServer, 3000);
  });
  
  child.on('error', (err) => {
    logStream.write(`[${timestamp()}] Server error: ${err.message}. Restarting in 3s...\n`);
    setTimeout(startServer, 3000);
  });
}

startServer();
