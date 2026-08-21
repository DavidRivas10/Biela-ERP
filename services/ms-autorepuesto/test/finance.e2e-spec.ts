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

describe("Payment Methods, Cash, Payments, and Refunds HTTP", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authenticated = true;
  let permissions: string[];
  let cashMethodId: string;
  let cardMethodId: string;
  let registerId: string;
  let sessionId: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let locationId: string;
  let saleId: string;
  let saleReturnId: string;
  let cashPaymentId: string;
  let cardPaymentId: string;
  let cashRefundId: string;
  const suffix = Date.now().toString();
  const allPermissions = [
    "payment-methods.read",
    "payment-methods.manage",
    "cash-registers.read",
    "cash-registers.manage",
    "cash-sessions.read",
    "cash-sessions.open",
    "cash-sessions.close",
    "payments.read",
    "payments.create",
    "payments.reverse",
    "cash-movements.read",
    "cash-movements.create",
    "sales.read",
  ];

  beforeAll(async () => {
    permissions = [...allPermissions];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!authenticated) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            id: "finance-e2e-actor",
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
        data: { code: `FIN-CAT-${suffix}`, name: "Finance" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `FIN-BRAND-${suffix}`, name: "Finance" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `FIN-PROD-${suffix}`,
          name: "Finance Product",
          categoryId,
          brandId,
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `FIN-LOC-${suffix}`, name: "Finance" },
      })
    ).id;
    const sale = await prisma.sale.create({
      data: {
        documentDate: new Date("2026-08-19T00:00:00.000Z"),
        status: "POSTED",
        postedAt: new Date(),
        postedByActorId: "fixture",
        createdByActorId: "fixture",
        subtotal: "100.00",
        total: "100.00",
        items: {
          create: {
            productId,
            sourceLocationId: locationId,
            quantity: 2,
            unitPrice: "50.0000",
            lineSubtotal: "100.00",
            lineTotal: "100.00",
          },
        },
      },
      include: { items: true },
    });
    saleId = sale.id;
    saleReturnId = (
      await prisma.saleReturn.create({
        data: {
          saleId,
          status: "POSTED",
          reason: "Eligible return",
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
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({
      where: { cashSession: { cashRegisterId: registerId } },
    });
    await prisma.payment.deleteMany({ where: { saleId } });
    if (registerId)
      await prisma.cashSession.deleteMany({
        where: { cashRegisterId: registerId },
      });
    if (registerId)
      await prisma.cashRegister.deleteMany({ where: { id: registerId } });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: [cashMethodId, cardMethodId].filter(Boolean) } },
    });
    if (saleReturnId)
      await prisma.saleReturnItem.deleteMany({ where: { saleReturnId } });
    if (saleReturnId)
      await prisma.saleReturn.deleteMany({ where: { id: saleReturnId } });
    if (saleId) await prisma.saleItem.deleteMany({ where: { saleId } });
    if (saleId) await prisma.sale.deleteMany({ where: { id: saleId } });
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    if (locationId)
      await prisma.location.deleteMany({ where: { id: locationId } });
    if (productId)
      await prisma.product.deleteMany({ where: { id: productId } });
    if (brandId)
      await prisma.productBrand.deleteMany({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  it("manages normalized Payment Methods and Cash Registers with soft lifecycle", async () => {
    const cash = await request(app.getHttpServer())
      .post("/payment-methods")
      .send({ code: ` cash-${suffix} `, name: " Cash ", kind: "CASH" })
      .expect(201);
    cashMethodId = cash.body.id;
    expect(cash.body.code).toBe(`CASH-${suffix}`);
    const card = await request(app.getHttpServer())
      .post("/payment-methods")
      .send({ code: `CARD-${suffix}`, name: "Card", kind: "CARD" })
      .expect(201);
    cardMethodId = card.body.id;
    await request(app.getHttpServer())
      .post("/payment-methods")
      .send({ code: `CASH-${suffix}`, name: "Duplicate", kind: "CASH" })
      .expect(409);
    const methods = await request(app.getHttpServer())
      .get("/payment-methods?kind=CASH&active=true")
      .expect(200);
    expect(methods.body.data.map((row: { id: string }) => row.id)).toContain(
      cashMethodId,
    );
    const register = await request(app.getHttpServer())
      .post("/cash-registers")
      .send({ code: ` register-${suffix} `, name: " Main drawer " })
      .expect(201);
    registerId = register.body.id;
    expect(register.body.code).toBe(`REGISTER-${suffix}`);
    await request(app.getHttpServer())
      .get(`/cash-registers?search=drawer&active=true`)
      .expect(200)
      .expect(({ body }) => expect(body.data[0].id).toBe(registerId));
  });

  it("opens exactly one session and derives opening Cash", async () => {
    const attempts = await Promise.all([
      request(app.getHttpServer())
        .post(`/cash-registers/${registerId}/sessions/open`)
        .send({ openingAmount: "100.00" }),
      request(app.getHttpServer())
        .post(`/cash-registers/${registerId}/sessions/open`)
        .send({ openingAmount: "100.00" }),
    ]);
    expect(attempts.map((result) => result.status).sort()).toEqual([201, 409]);
    sessionId = attempts.find((result) => result.status === 201)!.body.id;
    await request(app.getHttpServer())
      .get(`/cash-registers/${registerId}/current-session`)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(sessionId));
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => expect(body.expectedCash).toBe("100"));
  });

  it("records partial/split exact Payments, tender/change, and no Inventory effects", async () => {
    const before = await prisma.inventoryMovement.count({
      where: { productId },
    });
    const unpaid = await request(app.getHttpServer())
      .get(`/sales/${saleId}`)
      .expect(200);
    expect(unpaid.body.paymentSummary.settlementStatus).toBe("UNPAID");
    const cash = await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: sessionId,
        amount: "40.00",
        tenderedAmount: "50.00",
      })
      .expect(201);
    cashPaymentId = cash.body.id;
    expect(cash.body.changeAmount).toBe("10");
    await request(app.getHttpServer())
      .get(`/sales/${saleId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentSummary.paidAmount).toBe("40");
        expect(body.paymentSummary.outstandingAmount).toBe("60");
        expect(body.paymentSummary.settlementStatus).toBe("PARTIALLY_PAID");
      });
    const card = await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({
        paymentMethodId: cardMethodId,
        amount: "60.00",
        externalReference: "CARD-AUTH",
      })
      .expect(201);
    cardPaymentId = card.body.id;
    await request(app.getHttpServer())
      .post(`/sales/${saleId}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "0.01" })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/payment-methods/${cashMethodId}`)
      .send({ kind: "CARD" })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/sales/${saleId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.paymentSummary.settlementStatus).toBe("PAID"),
      );
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => expect(body.expectedCash).toBe("140"));
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      before,
    );
  });

  it("rejects invalid lifecycle/method/session combinations", async () => {
    const draft = await prisma.sale.create({
      data: {
        documentDate: new Date(),
        status: "DRAFT",
        createdByActorId: "fixture",
        subtotal: "10.00",
        total: "10.00",
      },
    });
    await request(app.getHttpServer())
      .post(`/sales/${draft.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "1.00" })
      .expect(409);
    await prisma.sale.update({
      where: { id: draft.id },
      data: { status: "CANCELLED" },
    });
    await request(app.getHttpServer())
      .post(`/sales/${draft.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "1.00" })
      .expect(409);
    await prisma.sale.delete({ where: { id: draft.id } });
    await request(app.getHttpServer())
      .patch(`/payment-methods/${cardMethodId}/deactivate`)
      .expect(200);
    const another = await prisma.sale.create({
      data: {
        documentDate: new Date(),
        status: "POSTED",
        postedAt: new Date(),
        createdByActorId: "fixture",
        subtotal: "10.00",
        total: "10.00",
      },
    });
    await request(app.getHttpServer())
      .post(`/sales/${another.id}/payments`)
      .send({ paymentMethodId: cardMethodId, amount: "1.00" })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/payment-methods/${cardMethodId}/activate`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/sales/${another.id}/payments`)
      .send({
        paymentMethodId: cardMethodId,
        cashSessionId: sessionId,
        amount: "1.00",
      })
      .expect(400);
    await prisma.sale.delete({ where: { id: another.id } });
  });

  it("blocks a Cash Payment reversal when the OPEN session lacks Cash", async () => {
    const register = await prisma.cashRegister.create({
      data: { code: `FIN-LOW-${suffix}`, name: "Low Cash" },
    });
    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id,
        openingAmount: "0.00",
        openedByActorId: "fixture",
      },
    });
    const sale = await prisma.sale.create({
      data: {
        documentDate: new Date(),
        status: "POSTED",
        postedAt: new Date(),
        createdByActorId: "fixture",
        subtotal: "10.00",
        total: "10.00",
      },
    });
    const payment = await request(app.getHttpServer())
      .post(`/sales/${sale.id}/payments`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: session.id,
        amount: "10.00",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${session.id}/movements`)
      .send({ type: "MANUAL_OUT", amount: "10.00", reason: "Empty drawer" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payments/${payment.body.id}/reverse`)
      .send({ reason: "Cannot pay out", cashSessionId: session.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${session.id}/movements`)
      .send({ type: "MANUAL_IN", amount: "10.00", reason: "Restore drawer" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payments/${payment.body.id}/reverse`)
      .send({ reason: "Now payable", cashSessionId: session.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${session.id}/close`)
      .send({ countedAmount: "0.00" })
      .expect(201);
    await prisma.cashMovement.deleteMany({
      where: { cashSessionId: session.id },
    });
    await prisma.payment.delete({ where: { id: payment.body.id } });
    await prisma.cashSession.delete({ where: { id: session.id } });
    await prisma.cashRegister.delete({ where: { id: register.id } });
    await prisma.sale.delete({ where: { id: sale.id } });
  });

  it("allows an existing OPEN session to close after its register is deactivated", async () => {
    const register = await prisma.cashRegister.create({
      data: { code: `FIN-INACTIVE-${suffix}`, name: "Inactive close" },
    });
    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id,
        openingAmount: "5.00",
        openedByActorId: "fixture",
      },
    });
    await prisma.cashRegister.update({
      where: { id: register.id },
      data: { active: false },
    });
    await request(app.getHttpServer())
      .post(`/cash-sessions/${session.id}/movements`)
      .send({ type: "MANUAL_IN", amount: "1.00", reason: "Inactive register" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${session.id}/close`)
      .send({ countedAmount: "4.00", notes: "One unit below expected" })
      .expect(201)
      .expect(({ body }) => expect(body.differenceAmount).toBe("-1"));
    await prisma.cashSession.delete({ where: { id: session.id } });
    await prisma.cashRegister.delete({ where: { id: register.id } });
  });

  it("calculates Return value and applies Cash/non-Cash Refund limits without Inventory effects", async () => {
    const before = await prisma.inventoryMovement.count({
      where: { productId },
    });
    await request(app.getHttpServer())
      .get(`/sale-returns/${saleReturnId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.refundSummary.returnValue).toBe("50");
        expect(body.refundSummary.refundableAmount).toBe("50");
      });
    const refund = await request(app.getHttpServer())
      .post(`/sale-returns/${saleReturnId}/refunds`)
      .send({
        paymentMethodId: cashMethodId,
        cashSessionId: sessionId,
        amount: "20.00",
      })
      .expect(201);
    cashRefundId = refund.body.id;
    await request(app.getHttpServer())
      .post(`/sale-returns/${saleReturnId}/refunds`)
      .send({
        paymentMethodId: cardMethodId,
        amount: "30.00",
        externalReference: "CARD-REFUND",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sale-returns/${saleReturnId}/refunds`)
      .send({ paymentMethodId: cardMethodId, amount: "0.01" })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => expect(body.expectedCash).toBe("120"));
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      before,
    );
  });

  it("reverses Refunds and Payments through compensating history", async () => {
    await request(app.getHttpServer())
      .post(`/payments/${cardPaymentId}/reverse`)
      .send({ reason: "Would violate refund invariant" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payments/${cashRefundId}/reverse`)
      .send({ reason: "Refund entered twice", cashSessionId: sessionId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/payments/${cashRefundId}/reverse`)
      .send({ reason: "Again", cashSessionId: sessionId })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/payments/${cashPaymentId}/reverse`)
      .send({ reason: "Payment entered twice", cashSessionId: sessionId })
      .expect(201);
    const history = await request(app.getHttpServer())
      .get(`/sales/${saleId}/payments`)
      .expect(200);
    expect(
      history.body.data.find((row: { id: string }) => row.id === cashPaymentId)
        .status,
    ).toBe("REVERSED");
    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary`)
      .expect(200)
      .expect(({ body }) => expect(body.expectedCash).toBe("100"));
  });

  it("paginates and filters the Cash Movement ledger without truncating later records", async () => {
    const first = await request(app.getHttpServer())
      .get(`/cash-movements?cashSessionId=${sessionId}&page=1&limit=2`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(`/cash-movements?cashSessionId=${sessionId}&page=2&limit=2`)
      .expect(200);
    expect(first.body.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 2 }),
    );
    expect(first.body.meta.total).toBeGreaterThan(2);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(
      Date.parse(first.body.data[0].createdAt),
    ).toBeGreaterThanOrEqual(Date.parse(first.body.data[1].createdAt));

    await request(app.getHttpServer())
      .get(
        `/cash-movements?cashRegisterId=${registerId}&type=SALE_PAYMENT&page=1&limit=1`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta.total).toBe(1);
        expect(body.data[0]).toEqual(
          expect.objectContaining({
            cashSessionId: sessionId,
            paymentId: cashPaymentId,
            type: "SALE_PAYMENT",
          }),
        );
        expect(body.data[0].cashSession.cashRegister.id).toBe(registerId);
      });
    await request(app.getHttpServer())
      .get(`/cash-movements?paymentId=${cashPaymentId}`)
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBe(2));
    await request(app.getHttpServer())
      .get(`/cash-movements?reference=${cashPaymentId}`)
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBe(2));
    await request(app.getHttpServer())
      .get(
        "/cash-movements?createdFrom=2020-01-01T00:00:00.000Z&createdTo=2030-01-01T00:00:00.000Z&limit=1",
      )
      .expect(200)
      .expect(({ body }) => expect(body.meta.total).toBeGreaterThan(2));

    await request(app.getHttpServer())
      .get(`/cash-sessions/${sessionId}/summary?includeMovements=false`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.movements).toEqual([]);
        expect(body.expectedCash).toBe("100");
        expect(body.movementTotals.SALE_PAYMENT).toBe("40");
        expect(body.paymentTotalsByMethod).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              paymentMethod: expect.objectContaining({ id: cashMethodId }),
            }),
          ]),
        );
      });
  });

  it("handles manual Cash, exact close snapshots, and CLOSED immutability", async () => {
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/movements`)
      .send({ type: "MANUAL_IN", amount: "10.20", reason: "Add change fund" })
      .expect(201)
      .expect(({ body }) => expect(body.actorId).toBe("finance-e2e-actor"));
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/movements`)
      .send({
        type: "MANUAL_OUT",
        amount: "0.20",
        reason: "Remove excess coins",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/movements`)
      .send({ type: "MANUAL_OUT", amount: "1000.00", reason: "Too much" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/close`)
      .send({ countedAmount: "111.00" })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/close`)
      .send({ countedAmount: "111.00", notes: "One unit over expected" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.expectedAmount).toBe("110");
        expect(body.countedAmount).toBe("111");
        expect(body.differenceAmount).toBe("1");
      });
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/movements`)
      .send({ type: "MANUAL_IN", amount: "1.00", reason: "After close" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/cash-sessions/${sessionId}/close`)
      .send({ countedAmount: "110.00" })
      .expect(409);
  });

  it("enforces authentication, granular RBAC, and inactive-register opening", async () => {
    permissions = [];
    await request(app.getHttpServer()).get("/payment-methods").expect(403);
    await request(app.getHttpServer()).get("/cash-movements").expect(403);
    permissions = [...allPermissions];
    authenticated = false;
    await request(app.getHttpServer()).get("/payment-methods").expect(401);
    authenticated = true;
    await request(app.getHttpServer())
      .patch(`/cash-registers/${registerId}/deactivate`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/cash-registers/${registerId}/sessions/open`)
      .send({ openingAmount: "0.00" })
      .expect(409);
  });
});
