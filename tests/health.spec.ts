import { expect, test } from './support/inventory.js';

test.describe('GET /health', () => {
  test('returns 200 and an ok status for every project', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

