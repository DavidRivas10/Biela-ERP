import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import * as argon2 from "argon2";
import { Model } from "mongoose";
import { AppModule } from "../app.module";
import { ADMIN_PERMISSIONS } from "../common/constants/permissions";
import { Role, RoleDocument } from "../roles/schemas/role.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

async function seed(): Promise<void> {
  const required = [
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_PASSWORD",
    "SEED_ADMIN_FIRST_NAME",
    "SEED_ADMIN_LAST_NAME",
  ] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(
      `Missing seed environment variables: ${missing.join(", ")}`,
    );
  if (process.env.SEED_ADMIN_PASSWORD!.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters");
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const roleModel = app.get<Model<RoleDocument>>(getModelToken(Role.name));
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const role = await roleModel.findOneAndUpdate(
      { name: "administrator" },
      {
        description: "Phase 1 system administrator",
        permissions: ADMIN_PERMISSIONS,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const email = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
    const existing = await userModel.findOne({ email });
    if (existing) {
      existing.roles = [role._id];
      existing.active = true;
      await existing.save();
      Logger.log(
        `Administrator already existed; role and active status verified`,
        "Seed",
      );
    } else {
      await userModel.create({
        email,
        passwordHash: await argon2.hash(process.env.SEED_ADMIN_PASSWORD!, {
          type: argon2.argon2id,
        }),
        firstName: process.env.SEED_ADMIN_FIRST_NAME!.trim(),
        lastName: process.env.SEED_ADMIN_LAST_NAME!.trim(),
        roles: [role._id],
        active: true,
      });
      Logger.log("Administrator created", "Seed");
    }
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  Logger.error(message, undefined, "Seed");
  process.exitCode = 1;
});
