import { randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as argon2 from "argon2";
import { FilterQuery, Model, Types } from "mongoose";

// Unambiguous alphabet: no 0/O, 1/l/I to make a handed-over password easy to type.
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 16): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return value;
}
import { Role, RoleDocument } from "../roles/schemas/role.schema";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User, UserDocument } from "./schemas/user.schema";

export interface AuthRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: AuthRole[];
}

export interface UserWithPassword extends AuthUser {
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<AuthUser> {
    await this.validateRoles(dto.roleIds);
    try {
      const user = await this.userModel.create({
        email: dto.email.trim().toLowerCase(),
        passwordHash: await argon2.hash(dto.password, {
          type: argon2.argon2id,
        }),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        roles: dto.roleIds?.map((id) => new Types.ObjectId(id)) ?? [],
      });
      return this.findOne(user.id);
    } catch (error: unknown) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException("A user with that email already exists");
      }
      throw error;
    }
  }

  async findAll(query: ListUsersQueryDto) {
    const filter: FilterQuery<UserDocument> = {};
    if (query.search?.trim()) {
      const escaped = query.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { email: { $regex: escaped, $options: "i" } },
        { firstName: { $regex: escaped, $options: "i" } },
        { lastName: { $regex: escaped, $options: "i" } },
      ];
    }

    const [documents, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate("roles")
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: documents.map((document) => this.toAuthUser(document)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<AuthUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid user id");
    }
    const user = await this.userModel.findById(id).populate("roles").exec();
    if (!user) throw new NotFoundException("User not found");
    return this.toAuthUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<AuthUser> {
    await this.findOne(id);
    await this.validateRoles(dto.roleIds);
    const update: Record<string, unknown> = { ...dto };
    if (dto.email) update.email = dto.email.trim().toLowerCase();
    if (dto.firstName) update.firstName = dto.firstName.trim();
    if (dto.lastName) update.lastName = dto.lastName.trim();
    if (dto.roleIds) {
      update.roles = dto.roleIds.map((roleId) => new Types.ObjectId(roleId));
      delete update.roleIds;
    }
    try {
      await this.userModel
        .findByIdAndUpdate(id, update, { runValidators: true })
        .exec();
      return this.findOne(id);
    } catch (error: unknown) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException("A user with that email already exists");
      }
      throw error;
    }
  }

  /**
   * Admin-driven password reset: there is no mail server, so the administrator
   * generates a fresh temporary password here and hands it to the person
   * directly. The plaintext is returned to the caller exactly once and is never
   * stored or logged; only its argon2 hash is persisted, replacing the old one.
   */
  async resetPassword(
    id: string,
  ): Promise<{ user: AuthUser; temporaryPassword: string }> {
    await this.findOne(id);
    const temporaryPassword = generateTemporaryPassword();
    await this.userModel
      .findByIdAndUpdate(id, {
        passwordHash: await argon2.hash(temporaryPassword, {
          type: argon2.argon2id,
        }),
      })
      .exec();
    return { user: await this.findOne(id), temporaryPassword };
  }

  async setActive(id: string, active: boolean): Promise<AuthUser> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { active }, { new: true })
      .exec();
    if (!user) throw new NotFoundException("User not found");
    return this.findOne(id);
  }

  async findByEmailForAuthentication(
    email: string,
  ): Promise<UserWithPassword | null> {
    const user = await this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select("+passwordHash")
      .populate("roles")
      .exec();
    if (!user) return null;
    return { ...this.toAuthUser(user), passwordHash: user.passwordHash };
  }

  async findAuthenticationContext(id: string): Promise<AuthUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const user = await this.userModel.findById(id).populate("roles").exec();
    return user ? this.toAuthUser(user) : null;
  }

  private async validateRoles(roleIds?: string[]): Promise<void> {
    if (!roleIds?.length) return;
    const uniqueIds = [...new Set(roleIds)];
    const count = await this.roleModel.countDocuments({
      _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) },
      active: true,
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException(
        "One or more roles are invalid or inactive",
      );
    }
  }

  private toAuthUser(user: UserDocument): AuthUser {
    const populatedRoles = (user.roles as unknown as RoleDocument[]).filter(
      (role) => role && role.active,
    );
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      active: user.active,
      roles: populatedRoles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: [...role.permissions],
      })),
    };
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === 11000
    );
  }
}
