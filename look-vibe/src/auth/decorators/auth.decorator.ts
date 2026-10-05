import { applyDecorators, UseGuards } from "@nestjs/common";
import { AppRoles } from "../interfaces/app-roles.js";
import { RoleProtected } from "./role-protected.decorator.js";
import { AuthGuard } from "@nestjs/passport";
import { UserRoleGuard } from "../guards/user-role/user-role.guard.js";

export const Auth = (...roles: AppRoles[]) => {
    return applyDecorators(
        RoleProtected(...roles), 
        UseGuards(AuthGuard('jwt'), UserRoleGuard) //UFFF El passporta ya viene con un guard de jwt, 
        //entonces aca lo que hago es usar ese guard de jwt y el guard de roles que yo cree, para que primero valide el token y luego valide los roles
    );
};