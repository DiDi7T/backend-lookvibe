import { SetMetadata } from "@nestjs/common";
import { META_ROLES } from "../interfaces/app-roles.js";

export const RoleProtected = (...roles: string[]) => {
    return SetMetadata(META_ROLES, roles);
};