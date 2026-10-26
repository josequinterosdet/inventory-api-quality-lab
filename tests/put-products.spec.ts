import { registerInputContract } from './support/input-contract.js';
import {
  expect,
  expectErrorSchema,
  expectProductSchema,
  test,
  uniqueProduct,
  unknownId,
} from './support/inventory.js';

test.describe('PUT /api/{environment}/products/{id}', () => {
  test('replaces the product and returns 200 with the new values', async ({ inventory }) => {
    const original = uniqueProduct({ name: 'Before Update', stock: 4 });
    const updated = uniqueProduct({ name: 'After Update', price: 44.4, stock: 8, status: 'archived' });
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(original);
      id = created.id;

      const response = await inventory.update(created.id, updated);
      const body = await response.json();
      expect(response.status(), `body ${JSON.stringify(body)}`).toBe(200);
      expectProductSchema(body);
      expect(body).toMatchObject(updated);
      expect(body.id).toBe(created.id);
      expect(body.createdAt).toBe(created.createdAt);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('persists the update so a later read returns the new values', async ({ inventory }) => {
    const original = uniqueProduct({ name: 'Stored Before' });
    const updated = uniqueProduct({ name: 'Stored After', stock: 21, status: 'draft' });
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(original);
      id = created.id;

      const update = await inventory.update(created.id, updated);
      expect(update.status()).toBe(200);

      const read = await inventory.getById(created.id);
      expect(read.status()).toBe(200);
      expect(await read.json()).toMatchObject(updated);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 404 for an unknown id', async ({ inventory }) => {
    const response = await inventory.update(unknownId(), uniqueProduct());

    expect(response.status()).toBe(404);
    expectErrorSchema(await response.json());
  });

  test('returns 409 when the new SKU already belongs to another product', async ({ inventory }) => {
    const existing = uniqueProduct();
    const target = uniqueProduct();
    let existingId: string | undefined;
    let targetId: string | undefined;

    try {
      existingId = (await inventory.createProduct(existing)).id;
      targetId = (await inventory.createProduct(target)).id;

      const response = await inventory.update(targetId, { ...target, sku: existing.sku });
      expect(response.status()).toBe(409);
      expectErrorSchema(await response.json());
    } finally {
      await inventory.cleanUp(existingId, targetId);
    }
  });
});



registerInputContract('PUT');

