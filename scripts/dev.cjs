const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mode = process.argv[2] === 'mobile' ? 'mobile' : 'web';
const serverEntrypoint = path.join(root, 'server', 'index.mjs');
const expoEntrypoint = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
if (!fs.existsSync(path.join(root, 'server', 'node_modules', 'tesseract.js'))) {
  console.error('Install the local receipt reader first: npm --prefix server ci');
  process.exit(1);
}
if (!fs.existsSync(expoEntrypoint)) {
  console.error('Install the app first: npm ci');
  process.exit(1);
}
function lanAddress() {
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|docker|loopback|vmware|hyper-v/i.test(name)) continue;
    const ipv4 = (addresses || []).find((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'));
    if (ipv4) return ipv4.address;
  }
  throw new Error('No LAN address was found. Connect the phone and computer to the same network, or use npm run dev:web.');
}
const address = mode === 'mobile' ? lanAddress() : 'localhost';
const ocrUrl = process.env.EXPO_PUBLIC_OCR_URL || `http://${address}:8787`;
const server = spawn(process.execPath, [serverEntrypoint], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, OCR_HOST: process.env.OCR_HOST || (mode === 'mobile' ? '0.0.0.0' : '127.0.0.1') },
  stdio: 'inherit',
});
const expo = spawn(process.execPath, [expoEntrypoint, 'start', mode === 'web' ? '--web' : '--lan', '--port', '8081'], {
  cwd: root,
  env: { ...process.env, EXPO_PUBLIC_OCR_URL: ocrUrl, EXPO_NO_TELEMETRY: '1' },
  stdio: 'inherit',
});
console.log(`SpendWise receipt reader: ${ocrUrl}`);
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  server.kill();
  expo.kill();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close());
server.on('exit', (code) => { if (!closing) { console.error('Receipt reader stopped.'); close(code || 1); } });
expo.on('exit', (code) => { if (!closing) close(code || 0); });
server.on('error', (error) => { console.error(`Receipt reader could not start: ${error.message}`); close(1); });
expo.on('error', (error) => { console.error(`Expo could not start: ${error.message}`); close(1); });
