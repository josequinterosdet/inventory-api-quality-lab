import { expect, test as base, type APIRequestContext, type APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export type EnvironmentName = 'dev' | 'prod';

export type ApiTestOptions = {
  environmentName: EnvironmentName;
};

export type ProductStatus = 'draft' | 'active' | 'archived';

export type ProductInput = {
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: ProductStatus;
};

export type Product = ProductInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export const DELETE_TOKEN = process.env.DELETE_TOKEN ?? 'inventory-lab-delete-token';
export const INVALID_TOKEN = 'not-the-delete-token';
export const NAME_MAX_LENGTH = 80;
export const PRICE_MIN = 0.01;
export const PRICE_MAX = 99_999.99;
export const STOCK_MIN = 0;
export const STOCK_MAX = 10_000;

export class InventoryClient {
  constructor(
    private readonly request: APIRequestContext,
    readonly environmentName: EnvironmentName,
  ) {}

  private collection(): string {
    return `/api/${this.environmentName}/products`;
  }

  private item(id: string): string {
    return `${this.collection()}/${encodeURIComponent(id)}`;
  }

  list(status?: ProductStatus): Promise<APIResponse> {
    const query = status ? `?status=${status}` : '';
    return this.request.get(`${this.collection()}${query}`);
  }

  create(payload: unknown): Promise<APIResponse> {
    return this.request.post(this.collection(), { data: payload });
  }

  getById(id: string): Promise<APIResponse> {
    return this.request.get(this.item(id));
  }

  update(id: string, payload: unknown): Promise<APIResponse> {
    return this.request.put(this.item(id), { data: payload });
  }

  delete(id: string, options: { token?: string } = {}): Promise<APIResponse> {
    const headers = options.token === undefined ? undefined : { Authorization: `Bearer ${options.token}` };
    return this.request.delete(this.item(id), { headers });
  }

  async createProduct(input: ProductInput = uniqueProduct()): Promise<Product> {
    const response = await this.create(input);
    if (response.status() !== 201) {
      throw new Error(`create failed: ${await diagnostic(response)}`);
    }
    return (await response.json()) as Product;
  }

  async cleanUp(...ids: Array<string | undefined>): Promise<void> {
    for (const id of ids) {
      if (!id) {
        continue;
      }
      const response = await this.delete(id, { token: DELETE_TOKEN });
      expect([204, 404], await diagnostic(response)).toContain(response.status());
    }
  }
}

export function uniqueSku(): string {
  return `SKU-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function uniqueProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'Lab Widget',
    sku: uniqueSku(),
    price: 12.5,
    stock: 10,
    status: 'active',
    ...overrides,
  };
}

export function unknownId(): string {
  return randomUUID();
}

export function expectProductSchema(body: unknown): asserts body is Product {
  expect(body, 'response must match the Product schema').toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    name: expect.any(String),
    sku: expect.stringMatching(/^[A-Z0-9-]{4,20}$/),
    price: expect.any(Number),
    stock: expect.any(Number),
    status: expect.stringMatching(/^(draft|active|archived)$/),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });
  const product = body as Product;
  expect(product.name.trim().length).toBeGreaterThan(0);
  expect([...product.name].length).toBeLessThanOrEqual(80);
  expect(product.price).toBeGreaterThanOrEqual(0.01);
  expect(product.price).toBeLessThanOrEqual(99999.99);
  expect(product.price * 100).toBeCloseTo(Math.round(product.price * 100), 6);
  expect(Number.isInteger(product.stock)).toBe(true);
  expect(product.stock).toBeGreaterThanOrEqual(0);
  expect(product.stock).toBeLessThanOrEqual(10000);
  for (const timestamp of [product.createdAt, product.updatedAt]) {
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  }
}

export function expectErrorSchema(body: unknown): void {
  expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
}

export async function diagnostic(response: APIResponse): Promise<string> {
  const text = await response.text();
  return `status ${response.status()} body ${text}`;
}

type ApiFixtures = {
  inventory: InventoryClient;
  otherEnvironment: InventoryClient;
};

export const test = base.extend<ApiTestOptions & ApiFixtures>({
  environmentName: ['dev', { option: true }],

  inventory: async ({ request, environmentName }, use) => {
    await use(new InventoryClient(request, environmentName));
  },

  otherEnvironment: async ({ request, environmentName }, use) => {
    await use(new InventoryClient(request, environmentName === 'dev' ? 'prod' : 'dev'));
  },
});

export { expect };


