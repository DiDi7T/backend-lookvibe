import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { User } from '../../users/entities/user.entity.js';

type GraphQLContext = { req: Request & { user?: User } };

@Injectable()
export class GqlJwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request & { user?: User } {
    return GqlExecutionContext.create(context).getContext<GraphQLContext>().req;
  }
}
