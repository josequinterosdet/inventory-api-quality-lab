export const ENVIRONMENTS = ['dev', 'prod'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: ProductStatus;
};

export type ErrorBody = {
  error: string;
  details?: string[];
};
