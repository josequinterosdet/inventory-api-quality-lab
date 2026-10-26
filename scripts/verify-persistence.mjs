import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../dist/app.js';
import { InventoryStore } from '../dist/store.js';

const root = path.resolve('data');
await mkdir(root, { recursive: true });
const dataDir = await mkdtemp(path.join(root, 'persistence-'));
let app;
try {
  const start = async () => {
    app = buildApp({ store: new InventoryStore(dataDir), deleteToken: 'persistence-test-token' });
    return app.listen({ host: '127.0.0.1', port: 0 });
  };
  let address = await start();
  const input = { name: 'Persistent widget', sku: `P-${randomUUID().slice(0, 8).toUpperCase()}`, price: 19.99, stock: 3, status: 'active' };
  const created = [];
  for (const environment of ['dev', 'prod']) {
    const response = await fetch(`${address}/api/${environment}/products`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    created.push([environment, await response.json()]);
  }
  await app.close();
  address = await start();
  for (const [environment, product] of created) {
    const response = await fetch(`${address}/api/${environment}/products/${product.id}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), product);
    const other = environment === 'dev' ? 'prod' : 'dev';
    assert.equal((await fetch(`${address}/api/${other}/products/${product.id}`)).status, 404);
  }
  console.log('Persistence verified: both environments survive app restart and remain isolated.');
} finally {
  await app?.close();
  if (!dataDir.startsWith(root + path.sep)) throw new Error('Unexpected cleanup path');
  await rm(dataDir, { recursive: true, force: true });
}
