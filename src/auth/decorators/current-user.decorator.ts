import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserEntity } from 'src/auth/entities/user.entity';

/** Usuario completo resuelto por JwtStrategy. Para el id suelto usa @UserId(). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserEntity => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as UserEntity;
  },
);
