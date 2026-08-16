import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForAuthentication(
      dto.email,
    );
    const validPassword = user
      ? await argon2.verify(user.passwordHash, dto.password).catch(() => false)
      : false;

    if (!user || !validPassword || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const expiresIn = this.configService.getOrThrow<string>(
      "JWT_ACCESS_EXPIRES_IN",
    );
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: expiresIn as JwtSignOptions["expiresIn"] },
    );

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { accessToken, tokenType: "Bearer", expiresIn, user: safeUser };
  }
}
