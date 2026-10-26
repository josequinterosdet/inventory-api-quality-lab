import { expect, test, uniqueProduct } from './support/inventory.js';

test('concurrent creates reserve one SKU exactly once', async ({ inventory }) => {
  const input = uniqueProduct();
  const ids: string[] = [];
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, () => inventory.create(input)));
    for (const response of responses) if (response.status() === 201) ids.push((await response.json()).id);
    expect(responses.map((response) => response.status()).sort()).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
    const products = await (await inventory.list()).json() as Array<{ sku: string }>;
    expect(products.filter((product) => product.sku === input.sku)).toHaveLength(1);
  } finally { await inventory.cleanUp(...ids); }
});

test('concurrent updates cannot claim the same SKU', async ({ inventory }) => {
  const ids: string[] = [];
  try {
    for (let i = 0; i < 4; i++) ids.push((await inventory.createProduct()).id);
    const input = uniqueProduct();
    const responses = await Promise.all(ids.map((id) => inventory.update(id, input)));
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409, 409, 409]);
  } finally { await inventory.cleanUp(...ids); }
});
