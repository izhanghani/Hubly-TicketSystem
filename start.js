#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function color(text, code) {
  if (process.stdout.isTTY) return `\x1b[${code}m${text}\x1b[0m`;
  return text;
}
const cyan = (t) => color(t, 36);
const green = (t) => color(t, 32);
const yellow = (t) => color(t, 33);
const red = (t) => color(t, 31);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', ...opts });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function readPort() {
  try {
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      const line = lines.find((l) => l.startsWith('PORT='));
      if (line) return line.split('=')[1].trim();
    }
  } catch {}
  return '3000';
}

function waitForServer(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Server did not start'));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else if (platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' });
    else execSync(`xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || true`, { stdio: 'ignore' });
  } catch {}
}

async function setup() {
  console.log(cyan('\n  ╔══════════════════════════════════════════╗'));
  console.log(cyan('  ║           Hubly — Ticket System          ║'));
  console.log(cyan('  ║        One-Click Launcher v2.0           ║'));
  console.log(cyan('  ╚══════════════════════════════════════════╝\n'));

  // .env
  const envPath = path.join(ROOT, '.env');
  const envExample = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envPath);
    console.log(green('  [✓] Created .env from .env.example'));
  }

  // node_modules
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.log(yellow('  [i] Installing dependencies...'));
    await run(npmCmd, ['install'], { cwd: ROOT });
    console.log(green('  [✓] Dependencies installed'));
  }

  // data directories
  ['data/uploads', 'data/logs'].forEach((d) => {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

async function dev() {
  await setup();
  const port = readPort();
  console.log(cyan('\n  ─── Starting in Development Mode ───'));
  console.log(green(`  Frontend : http://localhost:5173`));
  console.log(green(`  Backend  : http://localhost:${port}\n`));
  setTimeout(() => openBrowser('http://localhost:5173'), 2000);
  await run(npmCmd, ['run', 'dev'], { cwd: ROOT });
}

async function prod() {
  await setup();
  const port = readPort();
  console.log(cyan('\n  ─── Starting in Production Mode ───'));
  console.log(yellow('  Building...\n'));
  await run(npmCmd, ['run', 'build'], { cwd: ROOT });
  const url = `http://localhost:${port}`;
  console.log(green(`\n  App running at: ${url}\n`));
  process.env.NODE_ENV = 'production';
  openBrowser(url);
  await run('node', ['src/backend/server.js'], { cwd: ROOT });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--dev') || args.includes('-d')) return dev();
  if (args.includes('--prod') || args.includes('-p')) return prod();
  if (args.includes('--setup') || args.includes('-s')) return setup().then(() => process.exit(0));

  console.log(cyan(`
  ┌─────────────────────────────────────────┐
  │   Hubly — Select Mode:                  │
  │                                         │
  │   ${green('[1]')} Start (Development)               │
  │       - Hot reload frontend + backend   │
  │       - Opens at localhost:5173         │
  │                                         │
  │   ${green('[2]')} Start (Production)                │
  │       - Builds + serves static files    │
  │       - Opens at localhost:PORT         │
  │                                         │
  │   ${green('[3]')} Quick Setup Only                  │
  │       - Install deps + create dirs      │
  │                                         │
  │   ${yellow('[4]')} Exit                              │
  └─────────────────────────────────────────┘
  `));

  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => readline.question(q, r));
  const choice = await ask('  Select (1-4): ');
  readline.close();

  switch (choice.trim()) {
    case '1': await dev(); break;
    case '2': await prod(); break;
    case '3': await setup(); console.log(green('\n  [✓] Setup complete!')); break;
    case '4': process.exit(0); break;
    default: console.log(red('  Invalid choice!')); process.exit(1);
  }
}

main().catch((err) => {
  console.error(red(`\n  [✗] ${err.message}`));
  process.exit(1);
});
