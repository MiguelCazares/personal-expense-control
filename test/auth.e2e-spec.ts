import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GlobalExceptionFilter } from '@miguelcazares/nestjs-global-exception-filter';
import { SuccessResponse } from '@miguelcazares/nestjs-response-helper';
import { AppModule } from 'src/app.module';
import { UserEntity } from 'src/auth/entities/user.entity';
import { AuthResponseDto, PublicUserDto } from 'src/auth/dto/auth-response.dto';

jest.setTimeout(30000);

const OWNER = {
  email: 'e2e-owner@example.com',
  password: 'una-contrasena-larga',
  name: 'E2E Owner',
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    await app.init();

    userRepo = app.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    // El registro solo abre con la tabla vacía; se limpia para poder correr
    // la suite de forma repetible.
    await userRepo.clear();
  });

  afterAll(async () => {
    await userRepo.clear();
    await app.close();
  });

  it('GET /api/health responde sin token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({ service: 'ms-expenses' });
  });

  it('GET /api/auth/me sin token responde 401', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('POST /api/auth/register da de alta al propietario', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(OWNER)
      .expect(HttpStatus.CREATED);

    const body = response.body as SuccessResponse<AuthResponseDto>;
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(body.data.user.email).toBe(OWNER.email);
    expect(body.data.user).not.toHaveProperty('passwordHash');
  });

  it('POST /api/auth/register se cierra tras el primer usuario', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...OWNER, email: 'e2e-segundo@example.com' })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('POST /api/auth/register rechaza un payload inválido con 422', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'no-es-un-correo', password: 'corta', name: '' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('POST /api/auth/login rechaza credenciales inválidas', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OWNER.email, password: 'incorrecta' })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('POST /api/auth/login + GET /api/auth/me devuelven al propietario', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OWNER.email, password: OWNER.password })
      .expect(HttpStatus.OK);

    const token = (login.body as SuccessResponse<AuthResponseDto>).data
      .access_token;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(HttpStatus.OK);

    expect((me.body as SuccessResponse<PublicUserDto>).data).toMatchObject({
      email: OWNER.email,
      name: OWNER.name,
      timezone: 'America/Mexico_City',
    });
  });
});
