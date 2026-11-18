import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums';
import { ROLE_KEY } from '../decorators';
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req =
      context.getType() === 'ws'
        ? context.switchToWs().getClient()
        : context.switchToHttp().getRequest();
    const roles =
      this.reflector.get<UserRole[]>(ROLE_KEY, context.getHandler()) || [];
    if (!req.user || !roles.includes(req.user.role))
      throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
