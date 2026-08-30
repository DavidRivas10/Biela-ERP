import { apiBlob, apiRequest, apiUpload } from "./api-client";
import type {
  Paginated,
  Product,
  ProductAttributeDefinition,
  ProductAttributeValueType,
  ProductBrand,
  ProductCategory,
  ProductPhoto,
  QueryValue,
} from "../types/erp";

export interface CatalogInput {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface AttributeDefinitionInput {
  categoryId: string;
  code: string;
  name: string;
  valueType: ProductAttributeValueType;
  unit?: string;
  required?: boolean;
  active?: boolean;
}

export interface ProductInput {
  code: string;
  name: string;
  description?: string;
  defaultSalePrice?: string;
  referenceCost?: string;
  categoryId: string;
  brandId: string;
  active?: boolean;
  attributes?: Array<{ definitionId: string; value: string }>;
}

export const catalogApi = {
  categories: () => apiRequest<ProductCategory[]>("/api/product-categories"),
  createCategory: (body: CatalogInput) =>
    apiRequest<ProductCategory>("/api/product-categories", {
      method: "POST",
      body,
    }),
  updateCategory: (id: string, body: Partial<CatalogInput>) =>
    apiRequest<ProductCategory>(`/api/product-categories/${id}`, {
      method: "PATCH",
      body,
    }),
  brands: () => apiRequest<ProductBrand[]>("/api/product-brands"),
  createBrand: (body: Omit<CatalogInput, "description">) =>
    apiRequest<ProductBrand>("/api/product-brands", { method: "POST", body }),
  updateBrand: (id: string, body: Partial<Omit<CatalogInput, "description">>) =>
    apiRequest<ProductBrand>(`/api/product-brands/${id}`, {
      method: "PATCH",
      body,
    }),
  attributes: (categoryId?: string) =>
    apiRequest<ProductAttributeDefinition[]>(
      "/api/product-attribute-definitions",
      {
        query: { categoryId },
      },
    ),
  createAttribute: (body: AttributeDefinitionInput) =>
    apiRequest<ProductAttributeDefinition>(
      "/api/product-attribute-definitions",
      { method: "POST", body },
    ),
  updateAttribute: (id: string, body: Partial<AttributeDefinitionInput>) =>
    apiRequest<ProductAttributeDefinition>(
      `/api/product-attribute-definitions/${id}`,
      { method: "PATCH", body },
    ),
  products: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Product>>("/api/products", { query }),
  product: (id: string) => apiRequest<Product>(`/api/products/${id}`),
  /**
   * Resolve a scanned barcode to a single active product by exact code.
   * Uses the server product search and then matches the code case-insensitively,
   * so a partial-text hit never returns the wrong product.
   */
  findProductByCode: async (code: string): Promise<Product | null> => {
    const term = code.trim();
    if (!term) return null;
    const result = await apiRequest<Paginated<Product>>("/api/products", {
      query: { search: term, limit: 10, active: true },
    });
    const normalized = term.toLowerCase();
    return (
      result.data.find((product) => product.code.toLowerCase() === normalized) ??
      null
    );
  },
  createProduct: (body: ProductInput) =>
    apiRequest<Product>("/api/products", { method: "POST", body }),
  updateProduct: (id: string, body: Partial<ProductInput>) =>
    apiRequest<Product>(`/api/products/${id}`, { method: "PATCH", body }),
  setProductActive: (id: string, active: boolean) =>
    apiRequest<Product>(
      `/api/products/${id}/${active ? "activate" : "deactivate"}`,
      { method: "PATCH" },
    ),
  productPhotos: (id: string) =>
    apiRequest<ProductPhoto[]>(`/api/products/${id}/photos`),
  uploadProductPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiUpload<ProductPhoto[]>(`/api/products/${id}/photos`, form);
  },
  deleteProductPhoto: (id: string, photoId: string) =>
    apiRequest<ProductPhoto[]>(`/api/products/${id}/photos/${photoId}`, {
      method: "DELETE",
    }),
  productPhotoBlob: (id: string, photoId: string) =>
    apiBlob(`/api/products/${id}/photos/${photoId}`),
};
