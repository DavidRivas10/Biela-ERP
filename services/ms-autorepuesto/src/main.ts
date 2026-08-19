import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn"],
  });
  const config = app.get(ConfigService);
  app.use(helmet());
  app.enableCors({
    origin: config
      .getOrThrow<string>("CORS_ORIGINS")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle("BIELA ms-autorepuesto")
    .setDescription(
      "BIELA operational service: catalog, locations, inventory, movements, and deterministic search",
    )
    .setVersion("3.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = config.getOrThrow<number>("MS_AUTOREPUESTO_PORT");
  await app.listen(port);
  Logger.log(`ms-autorepuesto listening on port ${port}`, "Bootstrap");
}

void bootstrap();
