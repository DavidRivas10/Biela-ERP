import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Phase 8 commercial concurrency with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let locationId: string;
  let supplierId: string;
  let cashMethodId: string;
  let bankMethodId: string;
  const purchaseIds: string[] = [];
  const registerIds: string[] = [];
  const suffix = Date.now().toString();
  const permissions = [
    "purchases.pay",
    "payments.read",
    "payments.reverse",
    "cash-sessions.close",
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: "phase-8-race-actor",
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
        data: { code: `P8-RACE-CAT-${suffix}`, name: "P8 Race" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `P8-RACE-BRAND-${suffix}`, name: "P8 Race" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `P8-RACE-PROD-${suffix}`,
          name: "P8 Race",
          categoryId,
          brandId,
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `P8-RACE-LOC-${suffix}`, name: "P8 Race" },
      })
    ).id;
    supplierId = (
      await prisma.supplier.create({
        data: {
          code: `P8-RACE-SUP-${suffix}`,
          businessName: "P8 Race Supplier",
        },
      })
    ).id;
    cashMethodId = (
      await prisma.paymentMethod.create({
        data: {
          code: `P8-RACE-CASH-${suffix}`,
          name: "P8 Race Cash",
          kind: "CASH",
        },
      })
    ).id;
    bankMethodId = (
      await prisma.paymentMethod.create({
        data: {
          code: `P8-RACE-BANK-${suffix}`,
          name: "P8 Race Bank",
          kind: "BANK_TRANSFER",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({
      where: { cashSession: { cashRegisterId: { in: registerIds } } },
    });
    await prisma.payment.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    });
    const returnIds = (
      await prisma.purchaseReturn.findMany({
        where: { purchaseId: { in: purchaseIds } },
        select: { id: true },
      })
    ).map((row) => row.id);
    await prisma.purchaseReturnItem.deleteMany({
      where: { purchaseReturnId: { in: returnIds } },
    });
    await prisma.purchaseReturn.deleteMany({
      where: { id: { in: returnIds } },
    });
    await prisma.purchaseItem.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    });
    await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.cashSession.deleteMany({
      where: { cashRegisterId: { in: registerIds } },
    });
    await prisma.cashRegister.deleteMany({
      where: { id: { in: registerIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: [cashMethodId, bankMethodId] } },
    });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productBrand.deleteMany({ where: { id: brandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  const createPurchase = async (total = "100.00") => {
    const purchase = await prisma.purchase.create({
      data: {
        supplierId,
        documentDate: new Date(),
        status: "CONFIRMED",
        createdByActorId: "fixture",
        confirmedByActorId: "fixture",
        confirmedAt: new Date(),
        subtotal: total,
        total,
        items: {
          create: {
            productId,
            orderedQuantity: 1,
            unitCost: total,
            lineSubtotal: total,
            lineTotal: total,
          },
        },
      },
      include: { items: true },
    });
    purchaseIds.push(purchase.id);
    return purchase;
  };

  const createReturn = async (
    purchase: Awaited<ReturnType<typeof createPurchase>>,
  ) =>
    prisma.purchaseReturn.create({
      data: {
        purchaseId: purchase.id,
        status: "POSTED",
        reason: "Concurrent supplier credit",
        createdByActorId: "fixture",
        postedByActorId: "fixture",
        postedAt: new Date(),
        items: {
          create: {
            purchaseItemId: purchase.items[0].id,
            sourceLocationId: locationId,
            quantityReturned: 1,
          },
        },
      },
    });

  const createSession = async (openingAmount: string) => {
    const register = await prisma.cashRegister.create({
      data: {
        code: `P8-RACE-REG-${suffix}-${registerIds.length}`,
        name: "P8 Race Register",
      },
    });
    registerIds.push(register.id);
    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id,
        openingAmount,
        openedByActorId: "fixture",
      },
    });
    return session;
  };

  it("serializes concurrent Purchase Payments so they cannot overpay", async () => {
    const purchase = await createPurchase();
    const pay = () =>
      request(app.getHttpServer())
        .post(`/purchases/${purchase.id}/payments`)
        .send({ paymentMethodId: bankMethodId, amount: "70.00" });
    const results = await Promise.all([pay(), pay()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });

  it("serializes concurrent Supplier Refunds so they cannot exceed credit", async () => {
    const purchase = await createPurchase();
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.id}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "100.00" })
      .expect(201);
    const purchaseReturn = await createReturn(purchase);
    const refund = () =>
      request(app.getHttpServer())
        .post(`/purchase-returns/${purchaseReturn.id}/refunds`)
        .send({ paymentMethodId: bankMethodId, amount: "70.00" });
    const results = await Promise.all([refund(), refund()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });

  it("keeps a Cash Purchase Payment atomic against session close", async () => {
    const purchase = await createPurchase("10.00");
    const session = await createSession("10.00");
    await Promise.all([
      request(app.getHttpServer())
        .post(`/purchases/${purchase.id}/payments`)
        .send({
          paymentMethodId: cashMethodId,
          cashSessionId: session.id,
          amount: "10.00",
        }),
      request(app.getHttpServer())
        .post(`/cash-sessions/${session.id}/close`)
        .send({ countedAmount: "10.00", notes: "Concurrent purchase close" }),
    ]);
    const closed = await prisma.cashSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    const count = await prisma.cashMovement.count({
      where: { cashSessionId: session.id },
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.expectedAmount?.toFixed(2)).toBe(count ? "0.00" : "10.00");
  });

  it("keeps a Cash Supplier Refund atomic against session close", async () => {
    const purchase = await createPurchase("10.00");
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.id}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "10.00" })
      .expect(201);
    const purchaseReturn = await createReturn(purchase);
    const session = await createSession("0.00");
    await Promise.all([
      request(app.getHttpServer())
        .post(`/purchase-returns/${purchaseReturn.id}/refunds`)
        .send({
          paymentMethodId: cashMethodId,
          cashSessionId: session.id,
          amount: "10.00",
        }),
      request(app.getHttpServer())
        .post(`/cash-sessions/${session.id}/close`)
        .send({ countedAmount: "0.00", notes: "Concurrent refund close" }),
    ]);
    const closed = await prisma.cashSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    const count = await prisma.cashMovement.count({
      where: { cashSessionId: session.id },
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.expectedAmount?.toFixed(2)).toBe(count ? "10.00" : "0.00");
  });

  it("serializes Payment reversal against Supplier Refund eligibility", async () => {
    const purchase = await createPurchase();
    const payment = await request(app.getHttpServer())
      .post(`/purchases/${purchase.id}/payments`)
      .send({ paymentMethodId: bankMethodId, amount: "100.00" })
      .expect(201);
    const purchaseReturn = await createReturn(purchase);
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/payments/${payment.body.id}/reverse`)
        .send({ reason: "Concurrent supplier state" }),
      request(app.getHttpServer())
        .post(`/purchase-returns/${purchaseReturn.id}/refunds`)
        .send({ paymentMethodId: bankMethodId, amount: "70.00" }),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
    const active = await prisma.payment.groupBy({
      by: ["type"],
      where: { purchaseId: purchase.id, status: "POSTED" },
      _sum: { amount: true },
    });
    const paid = active.find((row) => row.type === "PURCHASE_PAYMENT")?._sum
      .amount;
    const refunded = active.find((row) => row.type === "SUPPLIER_REFUND")?._sum
      .amount;
    expect(
      (paid ?? new Prisma.Decimal(0)).greaterThanOrEqualTo(refunded ?? 0),
    ).toBe(true);
  });
});
