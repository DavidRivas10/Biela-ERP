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

  it("resetPassword returns a fresh temporary password and stores only its hash", async () => {
    const userDoc = {
      id: "507f1f77bcf86cd799439011",
      email: "a@b.com",
      firstName: "Ana",
      lastName: "López",
      active: true,
      roles: [],
    };
    const read = () => ({
      populate: () => ({ exec: () => Promise.resolve(userDoc) }),
    });
    const userModel = {
      findById: jest.fn(read),
      findByIdAndUpdate: jest.fn(() => ({
        exec: () => Promise.resolve(userDoc),
      })),
    };
    const service = new UsersService(
      userModel as unknown as Model<UserDocument>,
      {} as unknown as Model<RoleDocument>,
    );

    const first = await service.resetPassword(userDoc.id);
    const second = await service.resetPassword(userDoc.id);

    expect(first.temporaryPassword).toHaveLength(16);
    expect(first.temporaryPassword).toMatch(/^[A-Za-z2-9]+$/);
    expect(second.temporaryPassword).not.toBe(first.temporaryPassword);
    expect(first.user.email).toBe("a@b.com");

    const updateArgs = userModel.findByIdAndUpdate.mock.calls[0] as unknown as [
      string,
      { passwordHash: string },
    ];
    const stored = updateArgs[1].passwordHash;
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(stored).not.toContain(first.temporaryPassword);
  });
});
