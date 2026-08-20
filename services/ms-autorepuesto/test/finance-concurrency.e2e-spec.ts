import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Phase 7 financial concurrency with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cashMethodId: string;
  let cardMethodId: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let locationId: string;
  const saleIds: string[] = [];
  const registerIds: string[] = [];
  const suffix = Date.now().toString();
  const permissions = [
    "cash-registers.manage",
    "cash-registers.read",
    "cash-sessions.open",
    "cash-sessions.close",
    "cash-sessions.read",
    "cash-movements.create",
    "payments.create",
    "payments.read",
    "payments.reverse",
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: "finance-race-actor",
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
    cashMethodId = (
      await prisma.paymentMethod.create({
        data: { code: `RACE-CASH-${suffix}`, name: "Race Cash", kind: "CASH" },
      })
    ).id;
    cardMethodId = (
      await prisma.paymentMethod.create({
        data: { code: `RACE-CARD-${suffix}`, name: "Race Card", kind: "CARD" },
      })
    ).id;
    categoryId = (
      await prisma.productCategory.create({
        data: { code: `RACE-CAT-${suffix}`, name: "Race" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `RACE-BRAND-${suffix}`, name: "Race" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `RACE-PROD-${suffix}`,
          name: "Race",
          categoryId,
          brandId,
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `RACE-LOC-${suffix}`, name: "Race" },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({
      where: { cashSession: { cashRegisterId: { in: registerIds } } },
    });
    await prisma.payment.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.cashSession.deleteMany({
      where: { cashRegisterId: { in: registerIds } },
    });
    await prisma.cashRegister.deleteMany({
      where: { id: { in: registerIds } },
    });
    const returnIds = (
      await prisma.saleReturn.findMany({
        where: { saleId: { in: saleIds } },
        select: { id: true },
      })
    ).map((row) => row.id);
    await prisma.saleReturnItem.deleteMany({
      where: { saleReturnId: { in: returnIds } },
    });
    await prisma.saleReturn.deleteMany({ where: { id: { in: returnIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: [cashMethodId, cardMethodId] } },
    });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productBrand.deleteMany({ where: { id: brandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  const createSale = async (total = "100.00") => {
    const sale = await prisma.sale.create({
      data: {
        documentDate: new Date("2026-08-19T00:00:00.000Z"),
        status: "POSTED",
        postedAt: new Date(),
        postedByActorId: "fixture",
        createdByActorId: "fixture",
        subtotal: total,
        total,
        items: {
          create: {
            productId,
            sourceLocationId: locationId,
            quantity: 1,
            unitPrice: total,
            lineSubtotal: total,
            lineTotal: total,
          },
        },
      },
      include: { items: true },
    });
    saleIds.push(sale.id);
    return sale;
  };

  const createSession = async (openingAmount = "100.00") => {
    const register = await prisma.cashRegister.create({
      data: {
        code: `RACE-REG-${suffix}-${registerIds.length}`,
        name: "Race Register",
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
    return { register, session };
  };

  const createReturn = async (sale: Awaited<ReturnType<typeof createSale>>) =>
    prisma.saleReturn.create({
      data: {
        saleId: sale.id,
        status: "POSTED",
        reason: "Race return",
        createdByActorId: "fixture",
        postedByActorId: "fixture",
        postedAt: new Date(),
        items: {
          create: {
            saleItemId: sale.items[0].id,
            destinationLocationId: locationId,
            quantityReturned: 1,
          },
        },
      },
    });

  it("allows only one concurrent OPEN session per register", async () => {
    const register = await prisma.cashRegister.create({
      data: { code: `RACE-OPEN-${suffix}`, name: "Race Open" },
    });
    registerIds.push(register.id);
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/cash-registers/${register.id}/sessions/open`)
        .send({ openingAmount: "0.00" }),
      request(app.getHttpServer())
        .post(`/cash-registers/${register.id}/sessions/open`)
        .send({ openingAmount: "0.00" }),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });

  it("serializes concurrent Payments so they cannot overpay", async () => {
    const sale = await createSale();
    const pay = () =>
      request(app.getHttpServer())
        .post(`/sales/${sale.id}/payments`)
        .send({ paymentMethodId: cardMethodId, amount: "70.00" });
    const results = await Promise.all([pay(), pay()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(
      (
        await prisma.payment.aggregate({
          where: { saleId: sale.id, status: "POSTED" },
          _sum: { amount: true },
        })
      )._sum.amount?.toFixed(2),
    ).toBe("70.00");
  });

  it("serializes concurrent Refunds so they cannot over-refund", async () => {
    const sale = await createSale();
    await request(app.getHttpServer())
      .post(`/sales/${sale.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "100.00" })
      .expect(201);
    const saleReturn = await createReturn(sale);
    const refund = () =>
      request(app.getHttpServer())
        .post(`/sale-returns/${saleReturn.id}/refunds`)
        .send({ paymentMethodId: cardMethodId, amount: "70.00" });
    const results = await Promise.all([refund(), refund()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });

  it("serializes MANUAL_OUT and prevents negative expected Cash", async () => {
    const { session } = await createSession();
    const take = () =>
      request(app.getHttpServer())
        .post(`/cash-sessions/${session.id}/movements`)
        .send({
          type: "MANUAL_OUT",
          amount: "70.00",
          reason: "Concurrent drawer out",
        });
    const results = await Promise.all([take(), take()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });

  it("makes concurrent reversal idempotence-safe", async () => {
    const sale = await createSale();
    const payment = await request(app.getHttpServer())
      .post(`/sales/${sale.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "100.00" })
      .expect(201);
    const reverse = () =>
      request(app.getHttpServer())
        .post(`/payments/${payment.body.id}/reverse`)
        .send({ reason: "Concurrent reversal" });
    const results = await Promise.all([reverse(), reverse()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.payment.count({
        where: { id: payment.body.id, status: "REVERSED" },
      }),
    ).toBe(1);
    expect(
      await prisma.cashMovement.count({
        where: { paymentId: payment.body.id },
      }),
    ).toBe(0);
  });

  it("keeps Payment vs close atomic with no movement after CLOSED", async () => {
    const sale = await createSale("10.00");
    const { session } = await createSession("0.00");
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/sales/${sale.id}/payments`).send({
        paymentMethodId: cashMethodId,
        cashSessionId: session.id,
        amount: "10.00",
      }),
      request(app.getHttpServer())
        .post(`/cash-sessions/${session.id}/close`)
        .send({ countedAmount: "0.00", notes: "Concurrent payment close" }),
    ]);
    expect(
      results.filter((row) => row.status === 201).length,
    ).toBeGreaterThanOrEqual(1);
    const closed = await prisma.cashSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    const movementTotal = await prisma.cashMovement.aggregate({
      where: { cashSessionId: session.id },
      _sum: { amount: true },
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.expectedAmount?.toFixed(2)).toBe(
      movementTotal._sum.amount?.toFixed(2) ?? "0.00",
    );
  });

  it("keeps Refund and manual movement races with close atomic", async () => {
    const sale = await createSale("10.00");
    await request(app.getHttpServer())
      .post(`/sales/${sale.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "10.00" })
      .expect(201);
    const saleReturn = await createReturn(sale);
    const refundSession = await createSession();
    await Promise.all([
      request(app.getHttpServer())
        .post(`/sale-returns/${saleReturn.id}/refunds`)
        .send({
          paymentMethodId: cashMethodId,
          cashSessionId: refundSession.session.id,
          amount: "10.00",
        }),
      request(app.getHttpServer())
        .post(`/cash-sessions/${refundSession.session.id}/close`)
        .send({ countedAmount: "100.00", notes: "Concurrent refund close" }),
    ]);
    const refundClosed = await prisma.cashSession.findUniqueOrThrow({
      where: { id: refundSession.session.id },
    });
    const refundMovementCount = await prisma.cashMovement.count({
      where: { cashSessionId: refundSession.session.id },
    });
    expect(refundClosed.expectedAmount?.toFixed(2)).toBe(
      refundMovementCount ? "90.00" : "100.00",
    );
    expect(refundClosed.status).toBe("CLOSED");

    const manualSession = await createSession();
    await Promise.all([
      request(app.getHttpServer())
        .post(`/cash-sessions/${manualSession.session.id}/movements`)
        .send({
          type: "MANUAL_IN",
          amount: "10.00",
          reason: "Concurrent close movement",
        }),
      request(app.getHttpServer())
        .post(`/cash-sessions/${manualSession.session.id}/close`)
        .send({ countedAmount: "100.00", notes: "Concurrent manual close" }),
    ]);
    const manualClosed = await prisma.cashSession.findUniqueOrThrow({
      where: { id: manualSession.session.id },
    });
    const manualCount = await prisma.cashMovement.count({
      where: { cashSessionId: manualSession.session.id },
    });
    expect(manualClosed.expectedAmount?.toFixed(2)).toBe(
      manualCount ? "110.00" : "100.00",
    );
  });

  it("allows only one concurrent close transition", async () => {
    const { session } = await createSession("0.00");
    const close = () =>
      request(app.getHttpServer())
        .post(`/cash-sessions/${session.id}/close`)
        .send({ countedAmount: "0.00" });
    const results = await Promise.all([close(), close()]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
  });
});
