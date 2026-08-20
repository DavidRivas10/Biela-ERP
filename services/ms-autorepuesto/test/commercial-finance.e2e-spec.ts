import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Phase 8 commercial settlement HTTP", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authenticated = true;
  let permissions: string[];
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let locationId: string;
  let supplierId: string;
  let customerId: string;
  let purchaseId: string;
  let purchaseItemId: string;
  let purchaseReturnId: string;
  let saleId: string;
  let walkInSaleId: string;
  let cashMethodId: string;
  let bankMethodId: string;
  let registerId: string;
  let sessionId: string;
  let cashPurchasePaymentId: string;
  let bankPurchasePaymentId: string;
  let cashSupplierRefundId: string;
  let bankSupplierRefundId: string;
  const suffix = Date.now().toString();
  const allPermissions = [
    "purchases.read",
    "purchases.pay",
    "purchases.update",
    "sales.read",
    "payments.read",
    "payments.create",
    "payments.reverse",
    "cash-sessions.read",
    "cash-movements.read",
    "commercial-receivables.read",
    "commercial-payables.read",
    "commercial-summary.read",
  ];

  beforeAll(async () => {
    permissions = [...allPermissions];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!authenticated) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            id: "phase-8-e2e-actor",
            roles: [{ permissions }],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    categoryId = (
      await prisma.productCategory.create({
        data: { code: `P8-CAT-${suffix}`, name: "Phase 8" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `P8-BRAND-${suffix}`, name: "Phase 8" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `P8-PROD-${suffix}`,
          name: "Phase 8 Product",
          categoryId,
          brandId,
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `P8-LOC-${suffix}`, name: "Phase 8" },
      })
    ).id;
    supplierId = (
      await prisma.supplier.create({
        data: {
          code: `P8-SUP-${suffix}`,
          businessName: "Phase 8 Supplier",
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { code: `P8-CUS-${suffix}`, name: "Phase 8 Customer" },
      })
    ).id;
    const purchase = await prisma.purchase.create({
      data: {
        supplierId,
        documentDate: new Date("2026-08-01T00:00:00.000Z"),
        paymentDueDate: new Date("2026-08-02T00:00:00.000Z"),
        status: "CONFIRMED",
        createdByActorId: "fixture",
        confirmedByActorId: "fixture",
        confirmedAt: new Date(),
        subtotal: "1000.00",
        total: "1000.00",
        items: {
          create: {
            productId,
            orderedQuantity: 3,
            unitCost: "333.3333",
            lineSubtotal: "1000.00",
            lineTotal: "1000.00",
          },
        },
      },
      include: { items: true },
    });
    purchaseId = purchase.id;
    purchaseItemId = purchase.items[0].id;
    saleId = (
      await prisma.sale.create({
        data: {
          customerId,
          documentDate: new Date("2026-08-01T00:00:00.000Z"),
          paymentDueDate: new Date("2026-08-02T00:00:00.000Z"),
          status: "POSTED",
          createdByActorId: "fixture",
          postedByActorId: "fixture",
          postedAt: new Date(),
          subtotal: "100.00",
          total: "100.00",
        },
      })
    ).id;
    walkInSaleId = (
      await prisma.sale.create({
        data: {
          documentDate: new Date("2026-08-03T00:00:00.000Z"),
          status: "POSTED",
          createdByActorId: "fixture",
          postedByActorId: "fixture",
          postedAt: new Date(),
          subtotal: "50.00",
          total: "50.00",
        },
      })
    ).id;
    cashMethodId = (
      await prisma.paymentMethod.create({
        data: { code: `P8-CASH-${suffix}`, name: "Cash", kind: "CASH" },
      })
    ).id;
    bankMethodId = (
      await prisma.paymentMethod.create({
        data: {
          code: `P8-BANK-${suffix}`,
          name: "Bank",
          kind: "BANK_TRANSFER",
        },
      })
    ).id;
    registerId = (
      await prisma.cashRegister.create({
        data: { code: `P8-REG-${suffix}`, name: "Phase 8 Drawer" },
      })
    ).id;
    sessionId = (
      await prisma.cashSession.create({
        data: {
          cashRegisterId: registerId,
          openingAmount: "2000.00",
          openedByActorId: "fixture",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({
      where: { cashSession: { cashRegisterId: registerId } },
    });
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { purchaseId },
          { saleId: { in: [saleId, walkInSaleId].filter(Boolean) } },
        ],
      },
    });
    if (purchaseReturnId) {
      await prisma.purchaseReturnItem.deleteMany({
        where: { purchaseReturnId },
      });
      await prisma.purchaseReturn.deleteMany({
        where: { id: purchaseReturnId },
      });
    }
    if (purchaseId) {
      await prisma.purchaseItem.deleteMany({ where: { purchaseId } });
      await prisma.purchase.deleteMany({ where: { id: purchaseId } });
    }
    await prisma.sale.deleteMany({
      where: { id: { in: [saleId, walkInSaleId].filter(Boolean) } },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.cashSession.deleteMany({
      where: { cashRegisterId: registerId },
    });
    await prisma.cashRegister.deleteMany({ where: { id: registerId } });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: [cashMethodId, bankMethodId].filter(Boolean) } },
    });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productBrand.deleteMany({ where: { id: brandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  it("starts a confirmed Purchase financially UNPAID with an independent due date", async () => {
    await request(app.getHttpServer())
      .get(`/purchases/${purchaseId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentDueDate).toContain("2026-08-02");
        expect(body.paymentSummary.settlementStatus).toBe("UNPAID");
        expect(body.paymentSummary.outstandingAmount).toBe("1000");
      });
  });

  it("rejects invalid Purchase lifecycle, method, Cash Session, and Cash availability", async () => {
    const draft = await prisma.purchase.create({
      data: {
        supplierId,
        documentDate: new Date(),
        status: "DRAFT",
        createdByActorId: "fixture",
        subtotal: "10.00",
        total: "10.00",
      },
    });
    await request(app.getHttpServer())
      .post(`/purchases/${draft.id}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "1.00" })
      .expect(409);
    await prisma.purchase.update({
      where: { id: draft.id },
      data: { status: "CANCELLED" },
    });
    await request(app.getHttpServer())
      .post(`/purchases/${draft.id}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "1.00" })
      .expect(409);
    await prisma.purchase.delete({ where: { id: draft.id } });

    await prisma.paymentMethod.update({
      where: { id: bankMethodId },
      data: { active: false },
    });
    await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "1.00" })
      .expect(409);
    await prisma.paymentMethod.update({
      where: { id: bankMethodId },
      data: { active: true },
    });

    const register = await prisma.cashRegister.create({
      data: { code: `P8-LOW-${suffix}`, name: "Low Phase 8 Cash" },
    });
    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id,
        openingAmount: "10.00",
        openedByActorId: "fixture",
      },
    });
    await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: session.id,
        amount: "20.00",
      })
      .expect(409);
    await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedByActorId: "fixture",
        closedAt: new Date(),
        expectedAmount: "10.00",
        countedAmount: "10.00",
        differenceAmount: "0.00",
      },
    });
    await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: session.id,
        amount: "1.00",
      })
      .expect(409);
    await prisma.cashSession.delete({ where: { id: session.id } });
    await prisma.cashRegister.delete({ where: { id: register.id } });
  });

  it("supports partial/split Purchase Payments with exact Cash isolation", async () => {
    const inventoryBefore = await prisma.inventoryMovement.count({
      where: { productId },
    });
    const cash = await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: sessionId,
        amount: "200.00",
      })
      .expect(201);
    cashPurchasePaymentId = cash.body.id;
    await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/cancel`)
      .expect(409);
    const bank = await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({
        paymentMethodId: bankMethodId,
        amount: "800.00",
        externalReference: "BANK-P8",
      })
      .expect(201);
    bankPurchasePaymentId = bank.body.id;
    await request(app.getHttpServer())
      .get(`/purchases/${purchaseId}/payments?page=1&limit=10`)
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBe(2));
    await request(app.getHttpServer())
      .post(`/purchases/${purchaseId}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "0.01" })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/purchases/${purchaseId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentSummary.paidAmount).toBe("1000");
        expect(body.paymentSummary.outstandingAmount).toBe("0");
        expect(body.paymentSummary.settlementStatus).toBe("PAID");
      });
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => expect(body.expectedCash).toBe("1800"));
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      inventoryBefore,
    );
  });

  it("allocates Purchase Return money cumulatively and exposes Supplier credit", async () => {
    purchaseReturnId = (
      await prisma.purchaseReturn.create({
        data: {
          purchaseId,
          status: "POSTED",
          reason: "Phase 8 exact return",
          createdByActorId: "fixture",
          postedByActorId: "fixture",
          postedAt: new Date(),
          items: {
            create: {
              purchaseItemId,
              sourceLocationId: locationId,
              quantityReturned: 1,
            },
          },
        },
      })
    ).id;
    await request(app.getHttpServer())
      .get(`/purchases/${purchaseId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentSummary.purchaseReturnValue).toBe("333.33");
        expect(body.paymentSummary.netPurchaseObligation).toBe("666.67");
        expect(body.paymentSummary.supplierCreditAmount).toBe("333.33");
      });
    await request(app.getHttpServer())
      .get(`/purchase-returns/${purchaseReturnId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.refundSummary.returnValue).toBe("333.33");
        expect(body.refundSummary.refundableAmount).toBe("333.33");
      });
  });

  it("records partial CASH and non-cash Supplier Refunds without Inventory effects", async () => {
    const inventoryBefore = await prisma.inventoryMovement.count({
      where: { productId },
    });
    const cash = await request(app.getHttpServer())
      .post(`/purchase-returns/${purchaseReturnId}/refunds`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: sessionId,
        amount: "100.00",
      })
      .expect(201);
    cashSupplierRefundId = cash.body.id;
    const bank = await request(app.getHttpServer())
      .post(`/purchase-returns/${purchaseReturnId}/refunds`)
      .send({ paymentMethodId: bankMethodId, amount: "233.33" })
      .expect(201);
    bankSupplierRefundId = bank.body.id;
    await request(app.getHttpServer())
      .post(`/purchase-returns/${purchaseReturnId}/refunds`)
      .send({ paymentMethodId: bankMethodId, amount: "0.01" })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expectedCash).toBe("1900");
        expect(body.movementTotals.PURCHASE_PAYMENT).toBe("200");
        expect(body.movementTotals.SUPPLIER_REFUND).toBe("100");
      });
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      inventoryBefore,
    );
  });

  it("reverses purchase-side money through compensating Cash history", async () => {
    await request(app.getHttpServer())
      .post(`/payments/${bankSupplierRefundId}/reverse`)
      .send({ reason: "Bank refund correction" })
      .expect(201);
    const emptyRegister = await prisma.cashRegister.create({
      data: { code: `P8-EMPTY-${suffix}`, name: "Empty reversal drawer" },
    });
    const emptySession = await prisma.cashSession.create({
      data: {
        cashRegisterId: emptyRegister.id,
        openingAmount: "0.00",
        openedByActorId: "fixture",
      },
    });
    await request(app.getHttpServer())
      .post(`/payments/${cashSupplierRefundId}/reverse`)
      .send({
        reason: "Insufficient reversal drawer",
        cashSessionId: emptySession.id,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payments/${cashSupplierRefundId}/reverse`)
      .send({ reason: "Cash refund correction", cashSessionId: sessionId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payments/${cashPurchasePaymentId}/reverse`)
      .send({ reason: "Cash purchase correction", cashSessionId: sessionId })
      .expect(201);
    await prisma.cashSession.delete({ where: { id: emptySession.id } });
    await prisma.cashRegister.delete({ where: { id: emptyRegister.id } });
    await request(app.getHttpServer())
      .post(`/payments/${bankPurchasePaymentId}/reverse`)
      .send({ reason: "Bank purchase correction" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payments/${bankPurchasePaymentId}/reverse`)
      .send({ reason: "Duplicate reversal" })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expectedCash).toBe("2000");
        expect(body.movementTotals.SUPPLIER_REFUND_REVERSAL).toBe("100");
        expect(body.movementTotals.PURCHASE_PAYMENT_REVERSAL).toBe("200");
      });
  });

  it("returns paginated Customer AR including overdue and walk-in Sales", async () => {
    await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "40.00" })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/customers/${customerId}/account?limit=10`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.outstandingAmount).toBe("60.00");
        expect(body.summary.partiallyPaidCount).toBe(1);
        expect(body.summary.overdueCount).toBe(1);
        expect(body.data[0].overdue).toBe(true);
      });
    await request(app.getHttpServer())
      .get("/commercial/receivables?settlementStatus=UNPAID&page=1&limit=100")
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.data.some(
            (row: { id: string; walkIn: boolean }) =>
              row.id === walkInSaleId && row.walkIn,
          ),
        ).toBe(true);
      });
    const completion = await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "60.00" })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/customers/${customerId}/account?settlementStatus=PAID&limit=10`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.paidCount).toBe(1);
        expect(body.summary.outstandingAmount).toBe("0.00");
      });
    await request(app.getHttpServer())
      .post(`/payments/${completion.body.id}/reverse`)
      .send({ reason: "Restore partial receivable" })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/customers/${customerId}/account?page=1&limit=1`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.outstandingAmount).toBe("60.00");
        expect(body.meta.limit).toBe(1);
      });
  });

  it("returns Supplier AP and the non-accounting commercial summary", async () => {
    await request(app.getHttpServer())
      .get(`/suppliers/${supplierId}/account?page=1&limit=10`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.netAmount).toBe("666.67");
        expect(body.summary.outstandingAmount).toBe("666.67");
        expect(body.summary.overdueCount).toBe(1);
      });
    await request(app.getHttpServer())
      .get("/commercial/payables?overdueOnly=true&page=1&limit=10")
      .expect(200)
      .expect(({ body }) =>
        expect(
          body.data.some((row: { id: string }) => row.id === purchaseId),
        ).toBe(true),
      );
    await request(app.getHttpServer())
      .get("/commercial/summary")
      .expect(200)
      .expect(({ body }) => {
        expect(body.receivables.outstandingAmount).toBeDefined();
        expect(body.payables.outstandingAmount).toBeDefined();
        expect(body.cash.openSessionCount).toBeGreaterThanOrEqual(1);
      });
  });

  it("enforces authentication and Phase 8 permissions", async () => {
    permissions = [];
    await request(app.getHttpServer())
      .get("/commercial/receivables")
      .expect(403);
    permissions = [...allPermissions];
    authenticated = false;
    await request(app.getHttpServer())
      .get("/commercial/receivables")
      .expect(401);
    authenticated = true;
  });
});
