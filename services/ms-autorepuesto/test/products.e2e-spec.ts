import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../src/auth/guards/business-permissions.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Products HTTP with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string | undefined;
  let brandId: string | undefined;
  let definitionId: string | undefined;
  let productId: string | undefined;
  const suffix = Date.now().toString();
  const productCode = `TEST-BP-${suffix}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BusinessPermissionsGuard)
      .useValue({ canActivate: () => true })
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
  });

  afterAll(async () => {
    if (productId)
      await prisma.product.deleteMany({ where: { id: productId } });
    if (definitionId) {
      await prisma.productAttributeDefinition.deleteMany({
        where: { id: definitionId },
      });
    }
    if (brandId)
      await prisma.productBrand.deleteMany({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  it("creates the required product catalogs and controlled attribute", async () => {
    const category = await request(app.getHttpServer())
      .post("/product-categories")
      .send({ code: `braking-${suffix}`, name: `Braking ${suffix}` })
      .expect(201);
    categoryId = category.body.id as string;

    const brand = await request(app.getHttpServer())
      .post("/product-brands")
      .send({ code: `brand-${suffix}`, name: `Brand ${suffix}` })
      .expect(201);
    brandId = brand.body.id as string;

    const definition = await request(app.getHttpServer())
      .post("/product-attribute-definitions")
      .send({
        categoryId,
        code: `compound-${suffix}`,
        name: "Compound",
        valueType: "STRING",
        required: true,
      })
      .expect(201);
    definitionId = definition.body.id as string;
  });

  it("rejects an invalid category or brand reference", async () => {
    await request(app.getHttpServer())
      .post("/products")
      .send({
        code: `${productCode}-INVALID`,
        name: "Invalid product",
        categoryId: randomUUID(),
        brandId,
      })
      .expect(400);
  });

  it("rejects an invalid product DTO", () =>
    request(app.getHttpServer())
      .post("/products")
      .send({ code: "bad code", name: "x", categoryId, brandId })
      .expect(400));

  it("creates a product with a validated technical attribute", async () => {
    const response = await request(app.getHttpServer())
      .post("/products")
      .send({
        code: productCode.toLowerCase(),
        name: "Brake Pad",
        description: "Phase 2 verification product",
        categoryId,
        brandId,
        attributes: [{ definitionId, value: "ceramic" }],
      })
      .expect(201);
    productId = response.body.id as string;
    expect(response.body.code).toBe(productCode);
    expect(response.body.attributes).toHaveLength(1);
  });

  it("rejects a duplicate normalized product code", () =>
    request(app.getHttpServer())
      .post("/products")
      .send({
        code: productCode,
        name: "Duplicate Brake Pad",
        categoryId,
        brandId,
        attributes: [{ definitionId, value: "organic" }],
      })
      .expect(409));

  it("gets, searches, filters, and paginates products", async () => {
    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200)
      .expect((response) => expect(response.body.name).toBe("Brake Pad"));

    await request(app.getHttpServer())
      .get("/products")
      .query({
        search: "brake",
        categoryId,
        brandId,
        active: true,
        page: 1,
        limit: 1,
      })
      .expect(200)
      .expect((response) => {
        expect(
          response.body.data.some(
            (product: { id: string }) => product.id === productId,
          ),
        ).toBe(true);
        expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });
      });
  });

  it("updates, deactivates, and reactivates a product", async () => {
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ name: "Updated Brake Pad" })
      .expect(200)
      .expect((response) =>
        expect(response.body.name).toBe("Updated Brake Pad"),
      );
    await request(app.getHttpServer())
      .patch(`/products/${productId}/deactivate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/products/${productId}/activate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(true));
  });

  it("keeps an existing product editable, including its own active toggle, after its category and brand are later deactivated", async () => {
    await request(app.getHttpServer())
      .patch(`/product-categories/${categoryId}`)
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/product-brands/${brandId}`)
      .send({ active: false })
      .expect(200);

    // Saving the product without reassigning category/brand must still work,
    // even though both are now inactive.
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ name: "Brake Pad After Category Deactivation" })
      .expect(200);

    // The dedicated toggle must keep working regardless of category/brand state.
    await request(app.getHttpServer())
      .patch(`/products/${productId}/deactivate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/products/${productId}/activate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(true));

    // The same PATCH the frontend's edit form sends (categoryId/brandId and
    // the existing attributes resent unchanged, just toggling `active`) must
    // also keep working.
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({
        categoryId,
        brandId,
        active: false,
        attributes: [{ definitionId, value: "ceramic" }],
      })
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({
        categoryId,
        brandId,
        active: true,
        attributes: [{ definitionId, value: "ceramic" }],
      })
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(true));

    // Reassigning to a *different*, still-inactive category/brand must still
    // be rejected — only the unchanged-reference case is exempt.
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ categoryId: randomUUID() })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/product-categories/${categoryId}`)
      .send({ active: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/product-brands/${brandId}`)
      .send({ active: true })
      .expect(200);
  });

  it("stores and returns an optional reference cost and rejects a bad one", async () => {
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ referenceCost: "82.5000" })
      .expect(200)
      .expect((response) =>
        expect(Number(response.body.referenceCost)).toBe(82.5),
      );
    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200)
      .expect((response) =>
        expect(Number(response.body.referenceCost)).toBe(82.5),
      );
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ referenceCost: "not-a-number" })
      .expect(400);
  });

  it("stores and returns an optional margin percentage and rejects a bad one", async () => {
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ marginPercent: "35.00" })
      .expect(200)
      .expect((response) =>
        expect(Number(response.body.marginPercent)).toBe(35),
      );
    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200)
      .expect((response) =>
        expect(Number(response.body.marginPercent)).toBe(35),
      );
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ marginPercent: "not-a-number" })
      .expect(400);
  });

  it("uploads, lists, serves and deletes product photos, and enforces limits", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    // rejects a non-image
    await request(app.getHttpServer())
      .post(`/products/${productId}/photos`)
      .attach("file", Buffer.from("not an image"), {
        filename: "note.txt",
        contentType: "text/plain",
      })
      .expect(415);

    const uploaded = await request(app.getHttpServer())
      .post(`/products/${productId}/photos`)
      .attach("file", png, { filename: "front.png", contentType: "image/png" })
      .expect(201);
    expect(Array.isArray(uploaded.body)).toBe(true);
    expect(uploaded.body).toHaveLength(1);
    const photo = uploaded.body[0];
    expect(photo).toMatchObject({
      productId,
      mimeType: "image/png",
      originalName: "front.png",
      position: 0,
    });
    expect(typeof photo.id).toBe("string");
    expect(photo.sizeBytes).toBe(png.length);

    await request(app.getHttpServer())
      .get(`/products/${productId}/photos`)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));

    await request(app.getHttpServer())
      .get(`/products/${productId}/photos/${photo.id}`)
      .expect(200)
      .expect("Content-Type", /image\/png/)
      .expect((response) => expect(response.body).toEqual(png));

    // fill up to the max of 5 and reject the sixth
    for (let index = 0; index < 4; index += 1) {
      await request(app.getHttpServer())
        .post(`/products/${productId}/photos`)
        .attach("file", png, {
          filename: `extra-${index}.png`,
          contentType: "image/png",
        })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/products/${productId}/photos`)
      .attach("file", png, { filename: "sixth.png", contentType: "image/png" })
      .expect(400);

    const afterDelete = await request(app.getHttpServer())
      .delete(`/products/${productId}/photos/${photo.id}`)
      .expect(200);
    expect(afterDelete.body).toHaveLength(4);
    await request(app.getHttpServer())
      .get(`/products/${productId}/photos/${photo.id}`)
      .expect(404);

    // clean the remaining photos so no files linger on disk
    for (const remaining of afterDelete.body as Array<{ id: string }>) {
      await request(app.getHttpServer())
        .delete(`/products/${productId}/photos/${remaining.id}`)
        .expect(200);
    }
  });
});
