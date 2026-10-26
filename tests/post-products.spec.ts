import { registerInputContract } from './support/input-contract.js';
import {
  PRICE_MAX,
  PRICE_MIN,
  STOCK_MAX,
  STOCK_MIN,
  diagnostic,
  expect,
  expectErrorSchema,
  expectProductSchema,
  test,
  uniqueProduct,
} from './support/inventory.js';

test.describe('POST /api/{environment}/products', () => {
  test('creates a product and returns 201 with the stored resource', async ({ inventory }) => {
    const input = uniqueProduct();
    let id: string | undefined;

    try {
      const response = await inventory.create(input);
      const body = await response.json();
      expect(response.status(), `body ${JSON.stringify(body)}`).toBe(201);
      expectProductSchema(body);
      expect(body).toMatchObject(input);
      id = body.id;

      const read = await inventory.getById(body.id);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject(input);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 201 at the documented price and stock boundaries', async ({ inventory }) => {
    const min = uniqueProduct({ price: PRICE_MIN, stock: STOCK_MIN, status: 'draft' });
    const max = uniqueProduct({ price: PRICE_MAX, stock: STOCK_MAX, status: 'archived' });
    let minId: string | undefined;
    let maxId: string | undefined;

    try {
      const minResponse = await inventory.create(min);
      expect(minResponse.status(), await diagnostic(minResponse)).toBe(201);
      minId = ((await minResponse.json()) as { id: string }).id;

      const maxResponse = await inventory.create(max);
      expect(maxResponse.status(), await diagnostic(maxResponse)).toBe(201);
      maxId = ((await maxResponse.json()) as { id: string }).id;
    } finally {
      await inventory.cleanUp(minId, maxId);
    }
  });

  test('returns 409 when the SKU already exists', async ({ inventory }) => {
    const first = uniqueProduct();
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(first);
      id = created.id;

      const duplicate = await inventory.create({ ...uniqueProduct(), sku: first.sku, name: 'Other Name' });
      expect(duplicate.status()).toBe(409);
      expectErrorSchema(await duplicate.json());
    } finally {
      await inventory.cleanUp(id);
    }
  });
});


registerInputContract('POST');

