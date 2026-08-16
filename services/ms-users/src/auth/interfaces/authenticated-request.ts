import { Request } from "express";
import { AuthUser } from "../../users/users.service";

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
