import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { UserEntity } from 'src/auth/entities/user.entity';

export interface SeededUser {
  user: UserEntity;
  token: string;
}

/**
 * Crea un usuario y firma su token directamente, sin pasar por /auth/register:
 * ese endpoint solo admite un usuario, y estas pruebas necesitan dos para
 * verificar que un usuario no ve los datos del otro.
 */
export async function seedUser(
  app: INestApplication<App>,
  email: string,
  timezone = 'America/Mexico_City',
): Promise<SeededUser> {
  const repo = app.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
  const jwtService = app.get(JwtService);

  const user = await repo.save(
    repo.create({
      email,
      passwordHash: 'no-usado-en-estas-pruebas',
      name: email,
      timezone,
    }),
  );

  return {
    user,
    token: jwtService.sign({ sub: user.id, email: user.email }),
  };
}
