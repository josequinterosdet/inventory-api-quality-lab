import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';

import path from 'node:path';
import { buildApp } from '../dist/app.js';
import { InventoryStore } from '../dist/store.js';

// Keep an isolated server alive for the entire API test run; never reuse user data.
const dataRoot = path.resolve('data');
await mkdir(dataRoot, { recursive: true });
const dataDir = await mkdtemp(path.join(dataRoot, 'verification-'));
const app = buildApp({ store: new InventoryStore(dataDir), deleteToken: process.env.DELETE_TOKEN ?? 'inventory-lab-delete-token' });
try {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, API_BASE_URL: address },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await app.close();
  if (!dataDir.startsWith(dataRoot + path.sep)) throw new Error('Unexpected cleanup path');
  await rm(dataDir, { recursive: true, force: true });
}

