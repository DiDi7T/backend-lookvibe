import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { META_ROLES } from '../../interfaces/app-roles.js';
import { User } from '../../../users/entities/user.entity.js';

@Injectable()
export class UserRoleGuard implements CanActivate {
    constructor (
    private readonly reflector: Reflector
    ){}

    canActivate(
    context: ExecutionContext,): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles: string[] = this.reflector.get<string[]>(META_ROLES, context.getHandler()); 
    if(!validRoles || validRoles.length===0)
        return true;
    const user = context.getType<string>() === 'graphql'
      ? GqlExecutionContext.create(context).getContext<{ req: { user?: User } }>().req.user
      : context.switchToHttp().getRequest().user;
    if (!user)
        throw new BadRequestException("user not found"); 
    for (const role of user.roles) {
        if (validRoles.includes(role))
        return true
    }
    throw new ForbiddenException("user doesn't have required role"); 
    }
}
