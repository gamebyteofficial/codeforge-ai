const { spawn } = require('child_process');
const http = require('http');

function startServer() {
  console.log('[keep-alive] Starting dev server...');
  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    stdio: 'inherit',
    detached: true
  });
  child.unref();
  return child.pid;
}

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000/', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

let serverPid = startServer();

setInterval(async () => {
  const alive = await healthCheck();
  if (!alive) {
    console.log('[keep-alive] Server not responding, restarting...');
    serverPid = startServer();
  }
}, 15000);

console.log('[keep-alive] Monitor running');
