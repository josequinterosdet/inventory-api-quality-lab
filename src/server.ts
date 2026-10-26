import path from 'node:path';
import { buildApp } from './app.js';
import { InventoryStore } from './store.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
const deleteToken = process.env.DELETE_TOKEN ?? 'inventory-lab-delete-token';

const app = buildApp({
  store: new InventoryStore(dataDir),
  deleteToken,
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

await app.listen({ port, host });
