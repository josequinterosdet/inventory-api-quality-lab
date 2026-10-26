import { DELETE_TOKEN, expect, test, uniqueProduct } from './support/inventory.js';

test.describe('Environment isolation', () => {
  test('a product created in the current environment is not listed in the other one', async ({
    inventory,
    otherEnvironment,
  }) => {
    const input = uniqueProduct();
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(input);
      id = created.id;

      const here = await inventory.list();
      const there = await otherEnvironment.list();
      const hereBody = (await here.json()) as Array<{ id: string }>;
      const thereBody = (await there.json()) as Array<{ sku: string }>;

      expect(hereBody.some((product) => product.id === created.id)).toBe(true);
      expect(thereBody.some((product) => product.sku === input.sku)).toBe(false);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('the same SKU can hold different data in each environment', async ({ inventory, otherEnvironment }) => {
    const sku = uniqueProduct().sku;
    const here = uniqueProduct({ sku, name: 'Dev Shelf', stock: 3 });
    const there = uniqueProduct({ sku, name: 'Prod Shelf', stock: 9 });
    let hereId: string | undefined;
    let thereId: string | undefined;

    try {
      hereId = (await inventory.createProduct(here)).id;
      thereId = (await otherEnvironment.createProduct(there)).id;

      expect(await (await inventory.getById(hereId)).json()).toMatchObject(here);
      expect(await (await otherEnvironment.getById(thereId)).json()).toMatchObject(there);
    } finally {
      await inventory.cleanUp(hereId);
      await otherEnvironment.cleanUp(thereId);
    }
  });

  test('deleting a product in the current environment keeps it in the other one', async ({
    inventory,
    otherEnvironment,
  }) => {
    const input = uniqueProduct();
    let hereId: string | undefined;
    let thereId: string | undefined;

    try {
      hereId = (await inventory.createProduct(input)).id;
      thereId = (await otherEnvironment.createProduct(input)).id;

      const deletedId = hereId;
      const deleted = await inventory.delete(deletedId, { token: DELETE_TOKEN });
      expect(deleted.status()).toBe(204);
      hereId = undefined;

      expect((await inventory.getById(deletedId)).status()).toBe(404);
      expect((await otherEnvironment.getById(thereId)).status()).toBe(200);
    } finally {
      await inventory.cleanUp(hereId);
      await otherEnvironment.cleanUp(thereId);
    }
  });
});


test('rejects unknown environments', async ({ request }) => {
  const response = await request.get('/api/staging/products');
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: 'Unknown environment' });
});

test('updates and reads remain isolated by environment', async ({ inventory, otherEnvironment }) => {
  let id: string | undefined;
  try {
    id = (await inventory.createProduct()).id;
    expect((await otherEnvironment.getById(id)).status()).toBe(404);
    expect((await otherEnvironment.update(id, uniqueProduct())).status()).toBe(404);
    expect((await otherEnvironment.delete(id, { token: DELETE_TOKEN })).status()).toBe(404);
    expect((await inventory.getById(id)).status()).toBe(200);
  } finally { await inventory.cleanUp(id); }
});
