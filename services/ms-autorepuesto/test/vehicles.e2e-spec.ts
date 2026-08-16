import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../src/auth/guards/business-permissions.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Vehicles HTTP with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let brandId: string | undefined;
  let modelId: string | undefined;
  let vehicleId: string | undefined;
  const suffix = Date.now().toString();

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
    if (vehicleId)
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    if (modelId)
      await prisma.vehicleModel.deleteMany({ where: { id: modelId } });
    if (brandId)
      await prisma.vehicleBrand.deleteMany({ where: { id: brandId } });
    await app.close();
  });

  it("creates a vehicle brand and relational model", async () => {
    const brand = await request(app.getHttpServer())
      .post("/vehicle-brands")
      .send({ code: `toyota-${suffix}`, name: `Toyota ${suffix}` })
      .expect(201);
    brandId = brand.body.id as string;

    const model = await request(app.getHttpServer())
      .post("/vehicle-models")
      .send({ brandId, code: `corolla-${suffix}`, name: "Corolla" })
      .expect(201);
    modelId = model.body.id as string;
    expect(model.body.brand.id).toBe(brandId);
  });

  it("rejects invalid vehicle references and DTOs", async () => {
    await request(app.getHttpServer())
      .post("/vehicles")
      .send({ modelId: randomUUID(), year: 2015, engine: "1.8L" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/vehicles")
      .send({ modelId, year: 1700, engine: "1.8L" })
      .expect(400);
  });

  it("creates a deterministic Toyota Corolla fitment variant", async () => {
    const response = await request(app.getHttpServer())
      .post("/vehicles")
      .send({
        modelId,
        year: 2015,
        engine: "1.8L",
        generation: "E170",
        trim: "LE",
      })
      .expect(201);
    vehicleId = response.body.id as string;
    expect(response.body).toMatchObject({ year: 2015, engine: "1.8L" });
    expect(response.body.model).toMatchObject({ id: modelId, name: "Corolla" });
  });

  it("gets, filters, and paginates vehicles", async () => {
    await request(app.getHttpServer())
      .get(`/vehicles/${vehicleId}`)
      .expect(200)
      .expect((response) => expect(response.body.model.brand.id).toBe(brandId));
    await request(app.getHttpServer())
      .get("/vehicles")
      .query({
        brandId,
        modelId,
        year: 2015,
        engine: "1.8",
        active: true,
        page: 1,
        limit: 1,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(vehicleId);
        expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });
      });
  });

  it("updates, deactivates, and reactivates a vehicle", async () => {
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .send({ trim: "XLE" })
      .expect(200)
      .expect((response) => expect(response.body.trim).toBe("XLE"));
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}/deactivate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}/activate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(true));
  });
});
