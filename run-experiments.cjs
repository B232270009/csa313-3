const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const k6 = path.resolve(__dirname, '../.tools/k6/k6-v2.4.0-windows-amd64/k6.exe');
let server;
let activeTest;
process.chdir(__dirname);
fs.mkdirSync('results', { recursive: true });

async function startServer() {
  server = spawn(process.execPath, ['server.js'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('API failed to start; check port 3000');
    try {
      const response = await fetch('http://127.0.0.1:3000/cart/add', { method: 'POST' });
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('API readiness timeout');
}

async function stopServer() {
  if (server && server.exitCode === null) {
    const closed = once(server, 'close');
    server.kill();
    await closed;
  }
}

async function run(name, script, chaos = false) {
  const args = ['run', '--quiet', '--no-color', '--no-usage-report', '--summary-mode', 'full',
    '--summary-time-unit', 'ms', '--log-output', 'stdout',
    '--summary-export', `results/${name}.json`, ...(chaos ? ['-e', 'CHAOS=1'] : []), script];
  const output = fs.createWriteStream(`results/${name}.txt`);
  output.write(`command: k6 ${args.join(' ')}\nstarted: ${new Date().toISOString()}\n`);
  activeTest = spawn(k6, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  activeTest.stdout.on('data', (chunk) => output.write(chunk));
  activeTest.stderr.on('data', (chunk) => output.write(chunk));
  const finished = once(activeTest, 'close');
  console.log(`${name}: running`);
  if (chaos) {
    await delay(30000);
    const stoppedAt = Date.now();
    output.write(`\nCHAOS stop requested: ${new Date(stoppedAt).toISOString()}\n`);
    await stopServer();
    await delay(10000);
    await startServer();
    output.write(`CHAOS API ready: ${new Date().toISOString()}\nCHAOS controller recovery_ms=${Date.now() - stoppedAt}\n`);
    console.log('chaos: API restarted after 10-second stop');
  }
  const [code] = await finished;
  await new Promise((resolve) => output.end(`\nexit=${code}\n`, resolve));
  console.log(`${name}: exit=${code}`);
  if (code !== (name === 'pass' ? 0 : 99)) throw new Error(`Unexpected ${name} exit=${code}`);
}

async function main() {
  // Refuse to stop or reuse a server owned by somebody else.
  try {
    await fetch('http://127.0.0.1:3000/cart/add', { method: 'POST', signal: AbortSignal.timeout(1000) });
    throw new Error('Port 3000 already in use; stop that API before running experiments');
  } catch (error) {
    if (error.message.startsWith('Port 3000')) throw error;
  }
  fs.writeFileSync('results/version.txt', spawnSync(k6, ['version'], { encoding: 'utf8', windowsHide: true }).stdout);
  try {
    await startServer();
    await run('pass', 'slo-test.js');
    await run('chaos', 'slo-test.js', true);
    await run('fail', 'slo-test-fail.js');
  } finally {
    if (activeTest && activeTest.exitCode === null) activeTest.kill();
    await stopServer();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
