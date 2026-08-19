import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Locations HTTP with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let locationId: string | undefined;
  let permissions = ["locations.read", "locations.create", "locations.update"];
  const suffix = Date.now().toString();
  const code = `WH-A-${suffix}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: "locations-test-user",
            email: "locations@example.com",
            active: true,
            roles: [{ id: "role", name: "test", permissions }],
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
  });

  afterAll(async () => {
    if (locationId)
      await prisma.location.deleteMany({ where: { id: locationId } });
    await app.close();
  });

  beforeEach(() => {
    permissions = ["locations.read", "locations.create", "locations.update"];
  });

  it("enforces location permissions", async () => {
    permissions = ["locations.read"];
    await request(app.getHttpServer())
      .post("/locations")
      .send({ code, name: "Restricted" })
      .expect(403);
  });

  it("rejects an invalid location DTO", () =>
    request(app.getHttpServer())
      .post("/locations")
      .send({ code: "?", name: "x", unexpected: true })
      .expect(400));

  it("creates and normalizes a physical location", async () => {
    const response = await request(app.getHttpServer())
      .post("/locations")
      .send({
        code: code.toLowerCase(),
        name: "Brake parts bin",
        zone: "Warehouse A",
        aisle: "01",
        rack: "R02",
        shelf: "S03",
        bin: "B04",
      })
      .expect(201);
    locationId = response.body.id as string;
    expect(response.body).toMatchObject({ code, active: true });
  });

  it("rejects a duplicate location code at the database boundary", () =>
    request(app.getHttpServer())
      .post("/locations")
      .send({ code: code.toLowerCase(), name: "Duplicate" })
      .expect(409));

  it("gets the location", () =>
    request(app.getHttpServer())
      .get(`/locations/${locationId}`)
      .expect(200)
      .expect((response) => expect(response.body.code).toBe(code)));

  it("lists, filters, and paginates locations", () =>
    request(app.getHttpServer())
      .get("/locations")
      .query({
        code: "wh-a",
        search: "warehouse",
        active: true,
        page: 1,
        limit: 1,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(locationId);
        expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });
      }));

  it("updates the location", () =>
    request(app.getHttpServer())
      .patch(`/locations/${locationId}`)
      .send({ name: "Updated brake parts bin", description: "Updated" })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          name: "Updated brake parts bin",
          description: "Updated",
        }),
      ));

  it("deactivates and activates the location", async () => {
    await request(app.getHttpServer())
      .patch(`/locations/${locationId}/deactivate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/locations/${locationId}/activate`)
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(true));
  });
});
