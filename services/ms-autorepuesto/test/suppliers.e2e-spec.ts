import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Suppliers purchasing boundary", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let supplierId: string;
  let productId: string;
  let categoryId: string;
  let brandId: string;
  let permissions = [
    "suppliers.read",
    "suppliers.create",
    "suppliers.update",
    "purchases.read",
    "purchases.create",
  ];
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: "supplier-test-actor",
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
        data: { code: `SUP-CAT-${suffix}`, name: "Supplier test category" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `SUP-BRAND-${suffix}`, name: "Supplier test brand" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `SUP-PROD-${suffix}`,
          name: "Supplier test Product",
          categoryId,
          brandId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (supplierId) {
      await prisma.purchaseItem.deleteMany({
        where: { purchase: { supplierId } },
      });
      await prisma.purchase.deleteMany({ where: { supplierId } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    }
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (brandId) await prisma.productBrand.delete({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  beforeEach(() => {
    permissions = [
      "suppliers.read",
      "suppliers.create",
      "suppliers.update",
      "purchases.read",
      "purchases.create",
    ];
  });

  it("enforces Supplier permissions", () => {
    permissions = [];
    return request(app.getHttpServer()).get("/suppliers").expect(403);
  });

  it("rejects missing fields and invalid email", async () => {
    await request(app.getHttpServer()).post("/suppliers").send({}).expect(400);
    await request(app.getHttpServer())
      .post("/suppliers")
      .send({ code: `BLANK-${suffix}`, businessName: "   " })
      .expect(400);
    await request(app.getHttpServer())
      .post("/suppliers")
      .send({ code: `BAD-${suffix}`, businessName: "Bad", email: "not-email" })
      .expect(400);
  });

  it("creates and normalizes a Supplier", async () => {
    const response = await request(app.getHttpServer())
      .post("/suppliers")
      .send({
        code: ` sup-${suffix} `,
        businessName: " ACME Parts ",
        email: "BUYER@EXAMPLE.INVALID",
      })
      .expect(201);
    supplierId = response.body.id;
    expect(response.body).toMatchObject({
      code: `SUP-${suffix}`,
      businessName: "ACME Parts",
      email: "buyer@example.invalid",
      active: true,
    });
  });

  it("rejects a duplicate normalized code", () =>
    request(app.getHttpServer())
      .post("/suppliers")
      .send({ code: `SUP-${suffix}`, businessName: "Duplicate" })
      .expect(409));

  it("lists, filters, and paginates Suppliers deterministically", () =>
    request(app.getHttpServer())
      .get("/suppliers")
      .query({ search: "acme", active: true, page: 1, limit: 1 })
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].id).toBe(supplierId);
        expect(response.body.meta).toMatchObject({
          page: 1,
          limit: 1,
          total: 1,
        });
      }));

  it("updates and deactivates a Supplier", async () => {
    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}`)
      .send({ contactName: "Updated Contact" })
      .expect(200)
      .expect((response) =>
        expect(response.body.contactName).toBe("Updated Contact"),
      );
    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}/deactivate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
  });

  it("rejects an inactive Supplier for a new Purchase", () =>
    request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        documentDate: "2026-08-19",
        items: [{ productId, orderedQuantity: 1, unitCost: "1.00" }],
      })
      .expect(409));

  it("preserves Purchase history after Supplier deactivation", async () => {
    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}/activate`)
      .expect(200);
    const purchase = await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        supplierDocumentNumber: `HIST-${suffix}`,
        documentDate: "2026-08-19",
        items: [{ productId, orderedQuantity: 2, unitCost: "1.25" }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}/deactivate`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/purchases/${purchase.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.supplier.id).toBe(supplierId);
        expect(response.body.supplier.active).toBe(false);
      });
  });
});
