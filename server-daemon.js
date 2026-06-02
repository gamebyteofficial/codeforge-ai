const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'dev.log');

function startServer() {
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  const env = {
    ...process.env,
    DATABASE_URL: 'libsql://codeforge-abdulrehman23.aws-ap-south-1.turso.io',
    TURSO_AUTH_TOKEN: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODA0MjM3MTIsImlkIjoiMDE5ZTg5ODMtNTIwMS03YWQ3LTk2ZjEtNDgyZTlkODlkOTgyIiwicmlkIjoiZmU2YmM2YTItYzYwYi00NTc3LWI3ODMtNDVhYTMxNDUxYTQ4In0.-9HY0QXKGj0jtQeCqSwfjReH7n7OcZRKyCqfqoLU5ZhtmapcTmr6sh0TgXdKotL_fnP3WZqCYO_ELkFVmLbmAg',
  };
  
  const child = spawn('bun', ['run', 'dev'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env,
  });
  
  const timestamp = () => new Date().toISOString();
  logStream.write(`\n[${timestamp()}] Server starting (PID: ${child.pid}) with Turso DB...\n`);
  
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
