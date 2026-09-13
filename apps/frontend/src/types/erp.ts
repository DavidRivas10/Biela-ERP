export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CatalogRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory extends CatalogRecord {
  /** Present on the list endpoint: how many records point at this category. */
  _count?: { products: number; attributeDefinitions: number };
}
export interface ProductBrand extends Omit<CatalogRecord, "description"> {
  /** Present on the list endpoint: how many products carry this brand. */
  _count?: { products: number };
}
export interface VehicleBrand extends Omit<CatalogRecord, "description"> {
  /** Present on the list endpoint: how many models this brand has. */
  _count?: { models: number };
}

export type ProductAttributeValueType = "STRING" | "NUMBER" | "BOOLEAN";

export interface ProductAttributeDefinition extends CatalogRecord {
  categoryId: string;
  category: ProductCategory;
  valueType: ProductAttributeValueType;
  unit?: string | null;
  required: boolean;
  /** Present on the list endpoint: how many products set a value for this. */
  _count?: { values: number };
}

export interface ProductAttributeValue {
  id: string;
  definitionId: string;
  value: string;
  definition: ProductAttributeDefinition;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  defaultSalePrice?: string | null;
  referenceCost?: string | null;
  marginPercent?: string | null;
  categoryId: string;
  brandId: string;
  category: ProductCategory;
  brand: ProductBrand;
  attributes: ProductAttributeValue[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPhoto {
  id: string;
  productId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
}

export interface VehicleModel extends CatalogRecord {
  brandId: string;
  brand: VehicleBrand;
  /** Present on the list endpoint: how many vehicles use this model. */
  _count?: { vehicles: number };
}

export interface Vehicle {
  id: string;
  modelId: string;
  model: VehicleModel;
  year: number;
  engine: string;
  generation?: string | null;
  trim?: string | null;
  vin?: string | null;
  engineNumber?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on list/detail: how many product-compatibility links point here. */
  _count?: { compatibilities: number };
}

export interface Compatibility {
  id: string;
  productId: string;
  product: Product;
  vehicleId: string;
  vehicle: Vehicle;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NestedCompatibility {
  id: string;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location extends CatalogRecord {
  zone?: string | null;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
  /** Present on the list endpoint: how many product balances sit here. */
  _count?: { inventories: number };
}

export interface InventoryBalance {
  id: string;
  productId: string;
  product: Product;
  locationId: string;
  location: Location;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInventory extends Paginated<InventoryBalance> {
  totalQuantity: number;
}

export interface InventoryCategorySummary {
  categories: Array<{
    categoryId: string;
    categoryName: string;
    productCount: number;
    inStockProductCount: number;
    totalQuantity: number;
  }>;
  totalQuantity: number;
}

export type InventoryMovementType =
  "INITIAL" | "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";

export interface InventoryMovement {
  id: string;
  type: InventoryMovementType;
  productId: string;
  product: Pick<Product, "id" | "code" | "name" | "active">;
  sourceLocationId?: string | null;
  sourceLocation?: Location | null;
  destinationLocationId?: string | null;
  destinationLocation?: Location | null;
  quantity: number;
  reason?: string | null;
  actorId: string;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceItemId?: string | null;
  sourceQuantityBefore?: number | null;
  sourceQuantityAfter?: number | null;
  destinationQuantityBefore?: number | null;
  destinationQuantityAfter?: number | null;
  createdAt: string;
}

export interface SearchProduct extends Omit<
  Product,
  "brandId" | "categoryId" | "defaultSalePrice" | "referenceCost" | "marginPercent"
> {
  inventories: Array<{ quantity: number; location: Location }>;
  totalStock: number;
  matchingVehicles: Array<
    Vehicle & { compatibilityId: string; notes?: string | null }
  >;
}

export type QueryValue = string | number | boolean | undefined;
