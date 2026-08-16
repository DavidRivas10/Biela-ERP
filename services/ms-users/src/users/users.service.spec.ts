import { ConflictException } from "@nestjs/common";
import { Model } from "mongoose";
import { RoleDocument } from "../roles/schemas/role.schema";
import { UserDocument } from "./schemas/user.schema";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  it("maps the MongoDB unique index error to a conflict response", async () => {
    const userModel = { create: jest.fn().mockRejectedValue({ code: 11000 }) };
    const roleModel = { countDocuments: jest.fn() };
    const service = new UsersService(
      userModel as unknown as Model<UserDocument>,
      roleModel as unknown as Model<RoleDocument>,
    );

    await expect(
      service.create({
        email: "duplicate@example.com",
        password: "long-enough-password",
        firstName: "Duplicate",
        lastName: "User",
      }),
    ).rejects.toThrow(ConflictException);
  });
});
