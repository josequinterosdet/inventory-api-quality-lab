import { expect, expectErrorSchema, expectProductSchema, test, uniqueProduct, type ProductInput } from './inventory.js';

const invalidCases: Array<[string, (input: ProductInput) => unknown]> = [
  ...(['name', 'sku', 'price', 'stock', 'status'] as const).map((field): [string, (input: ProductInput) => unknown] => [
    `missing ${field}`, (input) => { const payload: Partial<ProductInput> = { ...input }; delete payload[field]; return payload; },
  ]),
  ['extra property', (input) => ({ ...input, unexpected: true })],
  ['null body', () => null],
  ['array body', () => []],
  ['blank name', (input) => ({ ...input, name: '  ' })],
  ['oversized name', (input) => ({ ...input, name: 'X'.repeat(81) })],
  ['non-string name', (input) => ({ ...input, name: 1 })],
  ['short SKU', (input) => ({ ...input, sku: 'ABC' })],
  ['long SKU', (input) => ({ ...input, sku: 'A'.repeat(21) })],
  ['lowercase SKU', (input) => ({ ...input, sku: 'abcd' })],
  ['non-string SKU', (input) => ({ ...input, sku: 1234 })],
  ['zero price', (input) => ({ ...input, price: 0 })],
  ['excessive price', (input) => ({ ...input, price: 100000 })],
  ['fractional cent', (input) => ({ ...input, price: 12.345 })],
  ['string price', (input) => ({ ...input, price: '12.50' })],
  ['negative stock', (input) => ({ ...input, stock: -1 })],
  ['excessive stock', (input) => ({ ...input, stock: 10001 })],
  ['fractional stock', (input) => ({ ...input, stock: 1.5 })],
  ['string stock', (input) => ({ ...input, stock: '10' })],
  ['invalid status', (input) => ({ ...input, status: 'hidden' })],
];

export function registerInputContract(method: 'POST' | 'PUT'): void {
  test.describe(`${method} input contract`, () => {
    for (const [label, payload] of invalidCases) {
      test(`rejects ${label} without changing stored data`, async ({ inventory }) => {
        const original = uniqueProduct();
        let id: string | undefined;
        try {
          if (method === 'PUT') id = (await inventory.createProduct(original)).id;
          const response = method === 'POST'
            ? await inventory.create(payload(original))
            : await inventory.update(id!, payload(original));
          // Track unexpected creations as well so a failed test still cleans up.
          const body = await response.json();
          if (method === 'POST' && response.status() === 201) id = body.id;
          expect(response.status(), JSON.stringify(body)).toBe(400);
          expectErrorSchema(body);
          if (id) expect(await (await inventory.getById(id)).json()).toMatchObject(original);
          else {
            const products = await (await inventory.list()).json() as ProductInput[];
            expect(products.some((product) => product.sku === original.sku)).toBe(false);
          }
        } finally { await inventory.cleanUp(id); }
      });
    }

    test('rejects an absent body', async ({ inventory, request, environmentName }) => {
      let id: string | undefined;
      try {
        if (method === 'PUT') id = (await inventory.createProduct()).id;
        const response = await request.fetch(`/api/${environmentName}/products${id ? `/${id}` : ''}`, { method });
        expect(response.status()).toBe(400);
        expectErrorSchema(await response.json());
      } finally { await inventory.cleanUp(id); }
    });

    for (const price of [0.29, 19.99, 99999.99]) {
      test(`accepts the valid decimal price ${price}`, async ({ inventory }) => {
        let id: string | undefined;
        try {
          if (method === 'PUT') id = (await inventory.createProduct()).id;
          const input = uniqueProduct({ price, name: '📦'.repeat(80) });
          const response = method === 'POST' ? await inventory.create(input) : await inventory.update(id!, input);
          const body = await response.json();
          if (method === 'POST' && response.status() === 201) id = body.id;
          expect(response.status(), JSON.stringify(body)).toBe(method === 'POST' ? 201 : 200);
          expectProductSchema(body);
          expect(body).toMatchObject(input);
        } finally { await inventory.cleanUp(id); }
      });
    }
  });
}

