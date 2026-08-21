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
  suppliersRoot: ["purchasing", "suppliers"] as const,
  suppliers: (filters: object) => ["purchasing", "suppliers", filters] as const,
  supplier: (id: string) => ["purchasing", "supplier", id] as const,
  supplierAccount: (id: string, filters: object) =>
    ["commercial", "supplier-account", id, filters] as const,
  purchasesRoot: ["purchasing", "purchases"] as const,
  purchases: (filters: object) => ["purchasing", "purchases", filters] as const,
  purchase: (id: string) => ["purchasing", "purchase", id] as const,
  receiptsRoot: ["purchasing", "receipts"] as const,
  receipts: (purchaseId: string, filters: object) =>
    ["purchasing", "receipts", purchaseId, filters] as const,
  receipt: (id: string) => ["purchasing", "receipt", id] as const,
  returnsRoot: ["purchasing", "returns"] as const,
  returns: (purchaseId: string, filters: object) =>
    ["purchasing", "returns", purchaseId, filters] as const,
  purchaseReturnDetailsRoot: ["purchasing", "return"] as const,
  purchaseReturn: (id: string) => ["purchasing", "return", id] as const,
  paymentMethods: (filters: object) => ["finance", "methods", filters] as const,
  paymentMethod: (id: string) => ["finance", "method", id] as const,
  cashSessions: (filters: object) => ["finance", "sessions", filters] as const,
  cashSession: (id: string) => ["finance", "session", id] as const,
  purchasePaymentsRoot: ["finance", "purchase-payments"] as const,
  purchasePayments: (purchaseId: string, filters: object) =>
    ["finance", "purchase-payments", purchaseId, filters] as const,
  supplierRefundsRoot: ["finance", "supplier-refunds"] as const,
  supplierRefunds: (returnId: string, filters: object) =>
    ["finance", "supplier-refunds", returnId, filters] as const,
  payablesRoot: ["commercial", "payables"] as const,
  payables: (filters: object) => ["commercial", "payables", filters] as const,
  supplierAccountsRoot: ["commercial", "supplier-account"] as const,
};
