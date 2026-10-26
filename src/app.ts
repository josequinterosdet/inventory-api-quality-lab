import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { InventoryStore, DuplicateSkuError } from './store.js';
import { ENVIRONMENTS, type EnvironmentName, type Product } from './types.js';
import { ValidationError, parseProductInput } from './validation.js';

export type AppOptions = {
  store: InventoryStore;
  deleteToken: string;
};

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.addHook('preHandler', async (request, reply) => {
    const match = new URL(request.url, 'http://localhost').pathname.match(/^\/api\/([^/]+)/);
    if (!match) {
      return;
    }
    if (!ENVIRONMENTS.includes(match[1] as EnvironmentName)) {
      return reply.status(404).send({ error: 'Unknown environment' });
    }
  });

  app.get<{ Params: { environment: EnvironmentName }; Querystring: { status?: string } }>(
    '/api/:environment/products',
    async (request, reply) => {
      const products = await options.store.list(request.params.environment);
      const status = request.query.status;
      if (status === undefined) {
        return products;
      }
      if (!['draft', 'active', 'archived'].includes(status)) {
        return reply.status(400).send({ error: 'Invalid status filter' });
      }
      return products.filter((product) => product.status === status);
    },
  );

  app.get<{ Params: { environment: EnvironmentName; id: string } }>(
    '/api/:environment/products/:id',
    async (request, reply) => {
      const product = await options.store.get(request.params.environment, request.params.id);
      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }
      return product;
    },
  );

  app.post<{ Params: { environment: EnvironmentName } }>('/api/:environment/products', async (request, reply) => {
    try {
      const input = parseProductInput(request.body);

      const now = new Date().toISOString();
      const product: Product = {
        id: randomUUID(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      await options.store.create(request.params.environment, product);
      return reply.status(201).send(product);
    } catch (error) {
      return sendValidationError(reply, error);
    }
  });

  app.put<{ Params: { environment: EnvironmentName; id: string } }>(
    '/api/:environment/products/:id',
    async (request, reply) => {
      try {
        const existing = await options.store.get(request.params.environment, request.params.id);
        if (!existing) {
          return reply.status(404).send({ error: 'Product not found' });
        }

        const input = parseProductInput(request.body);
        const product = await options.store.replace(request.params.environment, existing.id, input);
        if (!product) return reply.status(404).send({ error: 'Product not found' });
        return product;
      } catch (error) {
        return sendValidationError(reply, error);
      }
    },
  );

  app.delete<{ Params: { environment: EnvironmentName; id: string } }>(
    '/api/:environment/products/:id',
    async (request, reply) => {
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (authorization !== `Bearer ${options.deleteToken}`) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      const removed = await options.store.delete(request.params.environment, request.params.id);
      if (!removed) {
        return reply.status(404).send({ error: 'Product not found' });
      }
      return reply.status(204).send();
    },
  );

  return app;
}

function sendValidationError(reply: { status: (code: number) => { send: (payload: unknown) => unknown } }, error: unknown) {
  if (error instanceof DuplicateSkuError) {
    return reply.status(409).send({ error: 'Duplicate SKU' });
  }
  if (error instanceof ValidationError) {
    return reply.status(400).send({ error: 'Validation failed', details: error.details });
  }
  throw error;
}


