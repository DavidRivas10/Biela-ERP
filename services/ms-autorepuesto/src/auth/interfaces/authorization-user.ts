import { Request } from "express";

export interface AuthorizationRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface AuthorizationUser {
  id: string;
  email: string;
  active: boolean;
  roles: AuthorizationRole[];
}

export interface AuthorizedRequest extends Request {
  user: AuthorizationUser;
}
