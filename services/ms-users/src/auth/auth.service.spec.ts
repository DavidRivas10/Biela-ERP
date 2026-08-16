import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService, UserWithPassword } from "../users/users.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let usersService: jest.Mocked<
    Pick<UsersService, "findByEmailForAuthentication">
  >;
  let service: AuthService;
  let activeUser: UserWithPassword;

  beforeAll(async () => {
    activeUser = {
      id: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      active: true,
      roles: [],
      passwordHash: await argon2.hash("correct-password"),
    };
  });

  beforeEach(() => {
    usersService = { findByEmailForAuthentication: jest.fn() };
    const config = new ConfigService({ JWT_ACCESS_EXPIRES_IN: "15m" });
    service = new AuthService(
      usersService as unknown as UsersService,
      new JwtService({ secret: "test_secret_that_is_long_enough_12345" }),
      config,
    );
  });

  it("authenticates an active account with the correct password", async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(activeUser);
    const result = await service.login({
      email: activeUser.email,
      password: "correct-password",
    });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an invalid password without a specific account leak", async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(activeUser);
    await expect(
      service.login({ email: activeUser.email, password: "wrong-password" }),
    ).rejects.toThrow(new UnauthorizedException("Invalid credentials"));
  });

  it("rejects a nonexistent account with the same public error", async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(null);
    await expect(
      service.login({
        email: "missing@example.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow(new UnauthorizedException("Invalid credentials"));
  });

  it("rejects an inactive account", async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue({
      ...activeUser,
      active: false,
    });
    await expect(
      service.login({ email: activeUser.email, password: "correct-password" }),
    ).rejects.toThrow(new UnauthorizedException("Invalid credentials"));
  });
});
