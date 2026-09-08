import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserEntity } from 'src/auth/entities/user.entity';

/**
 * Id del usuario autenticado, tomado del JWT ya validado por JwtStrategy.
 * Es el equivalente al @BusinessId() del client-gateway de invoixup: cada
 * consulta se acota a este id, para no depender de que el caller lo mande.
 */
export const UserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest<Request>();
    return (request.user as UserEntity).id;
  },
);
