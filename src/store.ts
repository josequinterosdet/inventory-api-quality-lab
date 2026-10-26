import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { EnvironmentName, Product, ProductInput } from './types.js';

export class DuplicateSkuError extends Error {}

/** Single-process store: each environment serializes complete mutations. */
export class InventoryStore {
  private readonly catalogs = new Map<EnvironmentName, Promise<Map<string, Product>>>();
  private readonly queues = new Map<EnvironmentName, Promise<unknown>>();

  constructor(private readonly dataDir: string) {}

  async list(environment: EnvironmentName): Promise<Product[]> {
    return [...(await this.load(environment)).values()].sort((a, b) => a.sku.localeCompare(b.sku));
  }

  async get(environment: EnvironmentName, id: string): Promise<Product | undefined> {
    return (await this.load(environment)).get(id);
  }

  async create(environment: EnvironmentName, product: Product): Promise<Product> {
    return this.mutate(environment, (catalog) => {
      this.assertUnique(catalog, product.sku);
      catalog.set(product.id, product);
      return product;
    });
  }

  async replace(environment: EnvironmentName, id: string, input: ProductInput): Promise<Product | undefined> {
    return this.mutate(environment, (catalog) => {
      const existing = catalog.get(id);
      if (!existing) return undefined;
      this.assertUnique(catalog, input.sku, id);
      const product = { ...existing, ...input, updatedAt: new Date().toISOString() };
      catalog.set(id, product);
      return product;
    });
  }

  async delete(environment: EnvironmentName, id: string): Promise<boolean> {
    return this.mutate(environment, (catalog) => catalog.delete(id));
  }

  private assertUnique(catalog: Map<string, Product>, sku: string, exceptId?: string): void {
    if ([...catalog.values()].some((product) => product.sku === sku && product.id !== exceptId)) {
      throw new DuplicateSkuError('Duplicate SKU');
    }
  }

  private load(environment: EnvironmentName): Promise<Map<string, Product>> {
    let pending = this.catalogs.get(environment);
    if (!pending) {
      pending = this.readCatalog(environment);
      this.catalogs.set(environment, pending);
      void pending.catch(() => this.catalogs.delete(environment));
    }
    return pending;
  }

  private async readCatalog(environment: EnvironmentName): Promise<Map<string, Product>> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      const products = JSON.parse(await readFile(this.fileFor(environment), 'utf8')) as Product[];
      return new Map(products.map((product) => [product.id, product]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return new Map();
    }
  }

  private async mutate<T>(environment: EnvironmentName, update: (catalog: Map<string, Product>) => T): Promise<T> {
    const previous = this.queues.get(environment) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const catalog = new Map(await this.load(environment));
      const result = update(catalog);
      const file = this.fileFor(environment);
      await writeFile(`${file}.tmp`, `${JSON.stringify([...catalog.values()], null, 2)}\n`);
      await rename(`${file}.tmp`, file);
      this.catalogs.set(environment, Promise.resolve(catalog));
      return result;
    });
    this.queues.set(environment, operation);
    return operation;
  }

  private fileFor(environment: EnvironmentName): string {
    return path.join(this.dataDir, `${environment}.json`);
  }
}
