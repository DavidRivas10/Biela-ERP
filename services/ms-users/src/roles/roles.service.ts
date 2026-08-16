import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { PERMISSIONS } from "../common/constants/permissions";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { Role, RoleDocument } from "./schemas/role.schema";

@Injectable()
export class RolesService {
  private readonly allowedPermissions = new Set<string>(
    Object.values(PERMISSIONS),
  );

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async findAll() {
    return this.roleModel.find().sort({ name: 1 }).lean().exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid role id");
    const role = await this.roleModel.findById(id).lean().exec();
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async create(dto: CreateRoleDto) {
    this.validatePermissions(dto.permissions);
    try {
      const role = await this.roleModel.create({
        ...dto,
        name: dto.name.trim().toLowerCase(),
        description: dto.description.trim(),
      });
      return role.toJSON();
    } catch (error: unknown) {
      if (this.isDuplicateKey(error))
        throw new ConflictException("Role name already exists");
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    if (dto.permissions) this.validatePermissions(dto.permissions);
    try {
      const role = await this.roleModel
        .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
        .lean()
        .exec();
      if (!role) throw new NotFoundException("Role not found");
      return role;
    } catch (error: unknown) {
      if (this.isDuplicateKey(error))
        throw new ConflictException("Role name already exists");
      throw error;
    }
  }

  private validatePermissions(permissions: string[]): void {
    const invalid = permissions.filter(
      (permission) => !this.allowedPermissions.has(permission),
    );
    if (invalid.length) {
      throw new BadRequestException(
        `Unknown permissions: ${invalid.join(", ")}`,
      );
    }
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
