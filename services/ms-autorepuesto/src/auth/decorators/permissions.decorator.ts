import { SetMetadata } from "@nestjs/common";

export const BUSINESS_PERMISSIONS_KEY = "businessPermissions";
export const RequireBusinessPermissions = (...permissions: string[]) =>
  SetMetadata(BUSINESS_PERMISSIONS_KEY, permissions);
