import { apiRequest } from "./api-client";
import type { Paginated, QueryValue, SearchProduct } from "../types/erp";

export const searchApi = {
  products: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<SearchProduct>>("/api/search/products", { query }),
};
