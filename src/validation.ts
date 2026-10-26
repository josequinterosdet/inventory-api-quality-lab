import { PRODUCT_STATUSES, type ProductInput, type ProductStatus } from './types.js';

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 80;
export const SKU_PATTERN = /^[A-Z0-9-]{4,20}$/;
export const PRICE_MIN = 0.01;
export const PRICE_MAX = 99_999.99;
export const STOCK_MIN = 0;
export const STOCK_MAX = 10_000;

export class ValidationError extends Error {
  constructor(readonly details: string[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export function parseProductInput(body: unknown): ProductInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(['body must be a JSON object']);
  }

  const payload = body as Record<string, unknown>;
  const details: string[] = [];
  for (const key of Object.keys(payload)) {
    if (!['name', 'sku', 'price', 'stock', 'status'].includes(key)) details.push(`${key} is not allowed`);
  }

  const name = requireString(payload, 'name', details);
  if (name !== undefined) {
    if (name.trim().length < NAME_MIN_LENGTH) {
      details.push('name must not be empty');
    } else if ([...name].length > NAME_MAX_LENGTH) {
      details.push(`name must be at most ${NAME_MAX_LENGTH} characters`);
    }
  }

  const sku = requireString(payload, 'sku', details);
  if (sku !== undefined && !SKU_PATTERN.test(sku)) {
    details.push('sku must match ^[A-Z0-9-]{4,20}$');
  }

  const price = requireNumber(payload, 'price', details);
  if (price !== undefined) {
    if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
      details.push(`price must be between ${PRICE_MIN} and ${PRICE_MAX}`);
    } else if (!hasAtMostTwoDecimals(price)) {
      details.push('price must have at most two decimal places');
    }
  }

  const stock = requireInteger(payload, 'stock', details);
  if (stock !== undefined && (stock < STOCK_MIN || stock > STOCK_MAX)) {
    details.push(`stock must be an integer between ${STOCK_MIN} and ${STOCK_MAX}`);
  }

  const status = requireStatus(payload, details);

  if (details.length > 0) {
    throw new ValidationError(details);
  }

  return {
    name: name as string,
    sku: sku as string,
    price: price as number,
    stock: stock as number,
    status: status as ProductStatus,
  };
}

function requireString(payload: Record<string, unknown>, field: string, details: string[]): string | undefined {
  if (!(field in payload)) {
    details.push(`${field} is required`);
    return undefined;
  }
  if (typeof payload[field] !== 'string') {
    details.push(`${field} must be a string`);
    return undefined;
  }
  return payload[field] as string;
}

function requireNumber(payload: Record<string, unknown>, field: string, details: string[]): number | undefined {
  if (!(field in payload)) {
    details.push(`${field} is required`);
    return undefined;
  }
  if (typeof payload[field] !== 'number' || Number.isNaN(payload[field])) {
    details.push(`${field} must be a number`);
    return undefined;
  }
  return payload[field] as number;
}

function requireInteger(payload: Record<string, unknown>, field: string, details: string[]): number | undefined {
  const value = requireNumber(payload, field, details);
  if (value !== undefined && !Number.isInteger(value)) {
    details.push(`${field} must be an integer`);
    return undefined;
  }
  return value;
}

function requireStatus(payload: Record<string, unknown>, details: string[]): ProductStatus | undefined {
  if (!('status' in payload)) {
    details.push('status is required');
    return undefined;
  }
  if (typeof payload.status !== 'string' || !PRODUCT_STATUSES.includes(payload.status as ProductStatus)) {
    details.push(`status must be one of ${PRODUCT_STATUSES.join(', ')}`);
    return undefined;
  }
  return payload.status as ProductStatus;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) <= Number.EPSILON * Math.max(1, Math.abs(value * 100)) * 2;
}


