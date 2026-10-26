import {
  DELETE_TOKEN,
  INVALID_TOKEN,
  expect,
  expectErrorSchema,
  test,
  uniqueProduct,
  unknownId,
} from './support/inventory.js';

test.describe('DELETE /api/{environment}/products/{id}', () => {
  test('returns 204 with an empty body for an authenticated request', async ({ inventory }) => {
    let id: string | undefined;

    try {
      const created = await inventory.createProduct();
      id = created.id;

      const response = await inventory.delete(created.id, { token: DELETE_TOKEN });
      expect(response.status()).toBe(204);
      expect(await response.text()).toBe('');
      id = undefined;
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('removes the product from later reads and from the collection', async ({ inventory }) => {
    const input = uniqueProduct();
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(input);
      id = created.id;

      const response = await inventory.delete(created.id, { token: DELETE_TOKEN });
      expect(response.status()).toBe(204);
      id = undefined;

      expect((await inventory.getById(created.id)).status()).toBe(404);

      const list = await inventory.list();
      const body = (await list.json()) as Array<{ id: string }>;
      expect(body.some((product) => product.id === created.id)).toBe(false);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 401 when the Authorization header is missing', async ({ inventory }) => {
    let id: string | undefined;

    try {
      const created = await inventory.createProduct();
      id = created.id;

      const response = await inventory.delete(created.id);
      expect(response.status()).toBe(401);
      expectErrorSchema(await response.json());
      expect((await inventory.getById(created.id)).status()).toBe(200);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 401 when the Bearer token is invalid', async ({ inventory }) => {
    let id: string | undefined;

    try {
      const created = await inventory.createProduct();
      id = created.id;

      const response = await inventory.delete(created.id, { token: INVALID_TOKEN });
      expect(response.status()).toBe(401);
      expectErrorSchema(await response.json());
      expect((await inventory.getById(created.id)).status()).toBe(200);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 404 for an unknown id', async ({ inventory }) => {
    const response = await inventory.delete(unknownId(), { token: DELETE_TOKEN });

    expect(response.status()).toBe(404);
    expectErrorSchema(await response.json());
  });
});

