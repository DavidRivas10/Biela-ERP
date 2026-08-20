import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { HealthController } from "../src/health/health.controller";
import { ProductsController } from "../src/catalog/products.controller";
import { VehiclesController } from "../src/catalog/vehicles.controller";
import { CompatibilitiesController } from "../src/catalog/compatibilities.controller";
import { LocationsController } from "../src/operations/locations.controller";
import { InventoryController } from "../src/operations/inventory.controller";
import { SearchController } from "../src/operations/search.controller";
import { PurchasesController } from "../src/purchasing/purchases.controller";
import { SuppliersController } from "../src/purchasing/suppliers.controller";
import { UpstreamService } from "../src/upstream/upstream.service";
import { CustomersController } from "../src/sales/customers.controller";
import { SalesController } from "../src/sales/sales.controller";
import { FinanceController } from "../src/finance/finance.controller";
import { CommercialController } from "../src/commercial/commercial.controller";

describe("API Gateway HTTP", () => {
  let app: INestApplication;
  const upstream = { request: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        HealthController,
        ProductsController,
        VehiclesController,
        CompatibilitiesController,
        LocationsController,
        InventoryController,
        SearchController,
        SuppliersController,
        PurchasesController,
        CustomersController,
        SalesController,
        FinanceController,
        CommercialController,
      ],
      providers: [{ provide: UpstreamService, useValue: upstream }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => upstream.request.mockReset());

  it("GET /health returns gateway health", () =>
    request(app.getHttpServer()).get("/health").expect(200, {
      status: "ok",
      service: "api-gateway",
    }));

  it("POST /api/auth/login forwards and returns authentication data", async () => {
    upstream.request.mockResolvedValue({
      accessToken: "test-token",
      tokenType: "Bearer",
    });
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "test-password" })
      .expect(200)
      .expect({ accessToken: "test-token", tokenType: "Bearer" });
    expect(upstream.request).toHaveBeenCalledWith(
      "users",
      expect.objectContaining({ method: "POST", path: "auth/login" }),
    );
  });

  it("forwards Phase 2 product requests and bearer authorization", async () => {
    upstream.request.mockResolvedValue({ id: "product-id", code: "BP-001" });
    await request(app.getHttpServer())
      .post("/api/products")
      .set("Authorization", "Bearer catalog-token")
      .send({
        code: "BP-001",
        name: "Brake Pad",
        categoryId: "c",
        brandId: "b",
      })
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "products",
      authorization: "Bearer catalog-token",
      body: expect.objectContaining({ code: "BP-001" }),
    });
  });

  it("forwards nested compatibility queries with pagination", async () => {
    upstream.request.mockResolvedValue({ data: [], meta: { page: 1 } });
    await request(app.getHttpServer())
      .get("/api/products/product-id/vehicles?page=1&limit=20")
      .set("Authorization", "Bearer catalog-token")
      .expect(200);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      path: "products/product-id/vehicles",
      authorization: "Bearer catalog-token",
      query: expect.objectContaining({ page: "1", limit: "20" }),
    });
  });

  it("forwards Phase 3 location creation with bearer authorization", async () => {
    upstream.request.mockResolvedValue({ id: "location-id", code: "WH-A" });
    await request(app.getHttpServer())
      .post("/api/locations")
      .set("Authorization", "Bearer inventory-token")
      .send({ code: "WH-A", name: "Warehouse A" })
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "locations",
      authorization: "Bearer inventory-token",
      body: { code: "WH-A", name: "Warehouse A" },
    });
  });

  it("forwards typed movement commands without inventory logic", async () => {
    upstream.request.mockResolvedValue({ id: "movement-id", type: "TRANSFER" });
    const body = {
      type: "TRANSFER",
      productId: "product-id",
      sourceLocationId: "source-id",
      destinationLocationId: "destination-id",
      quantity: 3,
    };
    await request(app.getHttpServer())
      .post("/api/inventory/movements")
      .set("Authorization", "Bearer inventory-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "inventory/movements",
      authorization: "Bearer inventory-token",
      body,
    });
  });

  it("forwards deterministic search filters", async () => {
    upstream.request.mockResolvedValue({ data: [], meta: { page: 1 } });
    await request(app.getHttpServer())
      .get("/api/search/products?q=BP-001&year=2015&inStock=true")
      .set("Authorization", "Bearer search-token")
      .expect(200);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      path: "search/products",
      authorization: "Bearer search-token",
      query: expect.objectContaining({
        q: "BP-001",
        year: "2015",
        inStock: "true",
      }),
    });
  });

  it("forwards Supplier bodies and bearer authorization", async () => {
    upstream.request.mockResolvedValue({ id: "supplier-id", code: "SUP-001" });
    const body = { code: "SUP-001", businessName: "Parts Supplier" };
    await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Authorization", "Bearer purchasing-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "suppliers",
      authorization: "Bearer purchasing-token",
      body,
    });
  });

  it("forwards Purchase bodies and list filters without commercial logic", async () => {
    upstream.request.mockResolvedValue({ id: "purchase-id", status: "DRAFT" });
    const body = {
      supplierId: "supplier-id",
      documentDate: "2026-08-19",
      items: [
        { productId: "product-id", orderedQuantity: 10, unitCost: "1.25" },
      ],
    };
    await request(app.getHttpServer())
      .post("/api/purchases")
      .set("Authorization", "Bearer purchasing-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "purchases",
      authorization: "Bearer purchasing-token",
      body,
    });

    upstream.request.mockResolvedValue({ data: [], meta: { page: 1 } });
    await request(app.getHttpServer())
      .get("/api/purchases?supplierId=supplier-id&status=CONFIRMED&page=1")
      .set("Authorization", "Bearer purchasing-token")
      .expect(200);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      path: "purchases",
      authorization: "Bearer purchasing-token",
      query: expect.objectContaining({
        supplierId: "supplier-id",
        status: "CONFIRMED",
        page: "1",
      }),
    });
  });

  it("forwards Receipt and Return posting as thin commands", async () => {
    upstream.request.mockResolvedValue({ status: "POSTED" });
    await request(app.getHttpServer())
      .post("/api/purchase-receipts/receipt-id/post")
      .set("Authorization", "Bearer purchasing-token")
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "purchase-receipts/receipt-id/post",
      authorization: "Bearer purchasing-token",
      body: undefined,
    });

    await request(app.getHttpServer())
      .post("/api/purchase-returns/return-id/post")
      .set("Authorization", "Bearer purchasing-token")
      .expect(201);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      method: "POST",
      path: "purchase-returns/return-id/post",
      authorization: "Bearer purchasing-token",
      body: undefined,
    });
  });

  it("forwards Customer bodies and deterministic filters", async () => {
    upstream.request.mockResolvedValue({ id: "customer-id", code: "CUS-001" });
    const body = { code: "CUS-001", name: "Customer One" };
    await request(app.getHttpServer())
      .post("/api/customers")
      .set("Authorization", "Bearer sales-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "customers",
      authorization: "Bearer sales-token",
      body,
    });
    upstream.request.mockResolvedValue({ data: [], meta: { page: 1 } });
    await request(app.getHttpServer())
      .get("/api/customers?search=Customer&active=true&page=1")
      .set("Authorization", "Bearer sales-token")
      .expect(200);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      path: "customers",
      authorization: "Bearer sales-token",
      query: expect.objectContaining({
        search: "Customer",
        active: "true",
        page: "1",
      }),
    });
  });

  it("forwards Sale lifecycle and Return commands without business logic", async () => {
    const body = {
      documentDate: "2026-08-19",
      items: [
        {
          productId: "product-id",
          sourceLocationId: "location-id",
          quantity: 4,
        },
      ],
    };
    upstream.request.mockResolvedValue({ id: "sale-id", status: "DRAFT" });
    await request(app.getHttpServer())
      .post("/api/sales")
      .set("Authorization", "Bearer sales-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "sales",
      authorization: "Bearer sales-token",
      body,
    });
    await request(app.getHttpServer())
      .post("/api/sales/sale-id/post")
      .set("Authorization", "Bearer sales-token")
      .expect(201);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      method: "POST",
      path: "sales/sale-id/post",
      authorization: "Bearer sales-token",
      body: undefined,
    });
    const returnBody = {
      reason: "Return",
      items: [
        {
          saleItemId: "item-id",
          destinationLocationId: "location-id",
          quantityReturned: 2,
        },
      ],
    };
    await request(app.getHttpServer())
      .post("/api/sales/sale-id/returns")
      .set("Authorization", "Bearer sales-token")
      .send(returnBody)
      .expect(201);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      method: "POST",
      path: "sales/sale-id/returns",
      authorization: "Bearer sales-token",
      body: returnBody,
    });
  });

  it("forwards Cash Session commands and queries without drawer logic", async () => {
    const body = { openingAmount: "100.00", notes: "Morning shift" };
    upstream.request.mockResolvedValue({ id: "session-id", status: "OPEN" });
    await request(app.getHttpServer())
      .post("/api/cash-registers/register-id/sessions/open")
      .set("Authorization", "Bearer finance-token")
      .send(body)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "cash-registers/register-id/sessions/open",
      authorization: "Bearer finance-token",
      body,
    });
    upstream.request.mockResolvedValue({ expectedCash: "100.00" });
    await request(app.getHttpServer())
      .get("/api/cash-sessions/session-id/summary")
      .set("Authorization", "Bearer finance-token")
      .expect(200);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      path: "cash-sessions/session-id/summary",
      authorization: "Bearer finance-token",
    });
  });

  it("forwards Payments, Refunds, and reversals as thin financial commands", async () => {
    const payment = { paymentMethodId: "method-id", amount: "25.00" };
    upstream.request.mockResolvedValue({ id: "payment-id", status: "POSTED" });
    await request(app.getHttpServer())
      .post("/api/sales/sale-id/payments")
      .set("Authorization", "Bearer finance-token")
      .send(payment)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "sales/sale-id/payments",
      authorization: "Bearer finance-token",
      body: payment,
    });
    const reversal = { reason: "Duplicate operation" };
    await request(app.getHttpServer())
      .post("/api/payments/payment-id/reverse")
      .set("Authorization", "Bearer finance-token")
      .send(reversal)
      .expect(201);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      method: "POST",
      path: "payments/payment-id/reverse",
      authorization: "Bearer finance-token",
      body: reversal,
    });
  });

  it("forwards Phase 8 settlement and commercial queries without calculations", async () => {
    const payment = { paymentMethodId: "method-id", amount: "250.00" };
    upstream.request.mockResolvedValue({ id: "payment-id", status: "POSTED" });
    await request(app.getHttpServer())
      .post("/api/purchases/purchase-id/payments")
      .set("Authorization", "Bearer commercial-token")
      .send(payment)
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "purchases/purchase-id/payments",
      authorization: "Bearer commercial-token",
      body: payment,
    });
    await request(app.getHttpServer())
      .post("/api/purchase-returns/return-id/refunds")
      .set("Authorization", "Bearer commercial-token")
      .send(payment)
      .expect(201);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      method: "POST",
      path: "purchase-returns/return-id/refunds",
      authorization: "Bearer commercial-token",
      body: payment,
    });

    upstream.request.mockResolvedValue({ data: [], summary: {} });
    await request(app.getHttpServer())
      .get("/api/commercial/payables?overdueOnly=true&page=2")
      .set("Authorization", "Bearer commercial-token")
      .expect(200);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      path: "commercial/payables",
      authorization: "Bearer commercial-token",
      query: expect.objectContaining({ overdueOnly: "true", page: "2" }),
    });
    await request(app.getHttpServer())
      .get("/api/customers/customer-id/account?limit=10")
      .set("Authorization", "Bearer commercial-token")
      .expect(200);
    expect(upstream.request).toHaveBeenLastCalledWith("autorepuesto", {
      path: "customers/customer-id/account",
      authorization: "Bearer commercial-token",
      query: expect.objectContaining({ limit: "10" }),
    });
  });
});
