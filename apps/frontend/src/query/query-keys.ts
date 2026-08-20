export const queryKeys = {
  productCategories: ["catalog", "product-categories"] as const,
  productBrands: ["catalog", "product-brands"] as const,
  productAttributes: (categoryId = "all") =>
    ["catalog", "product-attributes", categoryId] as const,
  productsRoot: ["catalog", "products"] as const,
  products: (filters: object) => ["catalog", "products", filters] as const,
  product: (id: string) => ["catalog", "product", id] as const,
  vehicleBrands: ["vehicles", "brands"] as const,
  vehicleModelsRoot: ["vehicles", "models"] as const,
  vehicleModels: (brandId = "all") => ["vehicles", "models", brandId] as const,
  vehiclesRoot: ["vehicles", "list"] as const,
  vehicles: (filters: object) => ["vehicles", "list", filters] as const,
  vehicle: (id: string) => ["vehicles", "detail", id] as const,
  compatibilitiesRoot: ["compatibilities"] as const,
  compatibilities: (filters: object) => ["compatibilities", filters] as const,
  productVehicles: (id: string, filters: object) =>
    ["compatibilities", "product", id, filters] as const,
  vehicleProducts: (id: string, filters: object) =>
    ["compatibilities", "vehicle", id, filters] as const,
  locationsRoot: ["inventory", "locations"] as const,
  locations: (filters: object) => ["inventory", "locations", filters] as const,
  inventoryRoot: ["inventory", "balances"] as const,
  inventory: (filters: object) => ["inventory", "balances", filters] as const,
  productInventory: (id: string, filters: object) =>
    ["inventory", "product", id, filters] as const,
  locationInventory: (id: string, filters: object) =>
    ["inventory", "location", id, filters] as const,
  movementsRoot: ["inventory", "movements"] as const,
  movements: (filters: object) => ["inventory", "movements", filters] as const,
  searchRoot: ["search", "products"] as const,
  search: (filters: object) => ["search", "products", filters] as const,
};
