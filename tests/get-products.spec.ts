import { expect, expectErrorSchema, expectProductSchema, test, uniqueProduct, unknownId } from './support/inventory.js';

test.describe('GET /api/{environment}/products', () => {
  test('returns 200 and a JSON array of products', async ({ inventory }) => {
    const response = await inventory.list();
    const body = (await response.json()) as unknown[];

    expect(response.status()).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    for (const item of body) {
      expectProductSchema(item);
    }
  });

  test('lists a product that was just created', async ({ inventory }) => {
    const input = uniqueProduct();
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(input);
      id = created.id;

      const response = await inventory.list();
      expect(response.status()).toBe(200);
      const body = (await response.json()) as Array<{ id: string }>;
      expect(body.some((product) => product.id === created.id)).toBe(true);
      expect(body.find((product) => product.id === created.id)).toMatchObject(input);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('filters the collection by status', async ({ inventory }) => {
    const draft = uniqueProduct({ status: 'draft' });
    const active = uniqueProduct({ status: 'active' });
    let draftId: string | undefined;
    let activeId: string | undefined;

    try {
      draftId = (await inventory.createProduct(draft)).id;
      activeId = (await inventory.createProduct(active)).id;

      const response = await inventory.list('draft');
      expect(response.status()).toBe(200);
      const body = (await response.json()) as Array<{ id: string; status: string }>;
      expect(body.every((product) => product.status === 'draft')).toBe(true);
      expect(body.some((product) => product.id === draftId)).toBe(true);
      expect(body.some((product) => product.id === activeId)).toBe(false);
    } finally {
      await inventory.cleanUp(draftId, activeId);
    }
  });
});

test.describe('GET /api/{environment}/products/{id}', () => {
  test('returns 200 with the created product', async ({ inventory }) => {
    const input = uniqueProduct({ name: 'Exact Match Widget' });
    let id: string | undefined;

    try {
      const created = await inventory.createProduct(input);
      id = created.id;

      const response = await inventory.getById(created.id);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expectProductSchema(body);
      expect(body).toMatchObject(input);
      expect(body.id).toBe(created.id);
    } finally {
      await inventory.cleanUp(id);
    }
  });

  test('returns 404 for an unknown id', async ({ inventory }) => {
    const response = await inventory.getById(unknownId());

    expect(response.status()).toBe(404);
    expectErrorSchema(await response.json());
  });
});



for (const status of ['hidden', '']) {
  test(`rejects unsupported status filter '${status}'`, async ({ request, environmentName }) => {
    const response = await request.get(`/api/${environmentName}/products`, { params: { status } });
    expect(response.status()).toBe(400);
    expectErrorSchema(await response.json());
  });
}
