import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from 'src/auth/auth.service';
import { UserEntity } from 'src/auth/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<Repository<UserEntity>>;
  let jwtService: jest.Mocked<JwtService>;

  const buildUser = (overrides: Partial<UserEntity> = {}): UserEntity => ({
    id: 1,
    email: 'miguel@example.com',
    passwordHash: 'hashed',
    name: 'Miguel',
    timezone: 'America/Mexico_City',
    telegramChatId: null,
    isActive: true,
    createdAt: new Date('2026-09-08T00:00:00Z'),
    updatedAt: new Date('2026-09-08T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            count: jest.fn(),
            create: jest.fn((dto: Partial<UserEntity>) => dto as UserEntity),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'signed.jwt') },
        },
        { provide: ConfigService, useValue: { get: jest.fn(() => '90d') } },
      ],
    }).compile();

    service = module.get(AuthService);
    repository = module.get(getRepositoryToken(UserEntity));
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('creates the owner and returns a token when no user exists', async () => {
      repository.count.mockResolvedValue(0);
      repository.save.mockResolvedValue(buildUser());

      const result = await service.register({
        email: 'Miguel@Example.com ',
        password: 'una-contrasena-larga',
        name: 'Miguel',
      });

      expect(result.access_token).toBe('signed.jwt');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'miguel@example.com' },
        { expiresIn: '90d' },
      );
    });

    it('normalizes the email and hashes the password before saving', async () => {
      repository.count.mockResolvedValue(0);
      repository.save.mockResolvedValue(buildUser());

      await service.register({
        email: '  Miguel@Example.com ',
        password: 'una-contrasena-larga',
        name: 'Miguel',
      });

      const saved = repository.save.mock.calls[0][0] as UserEntity;
      expect(saved.email).toBe('miguel@example.com');
      expect(saved.passwordHash).not.toBe('una-contrasena-larga');
      await expect(
        bcrypt.compare('una-contrasena-larga', saved.passwordHash),
      ).resolves.toBe(true);
    });

    it('closes registration once an owner exists', async () => {
      repository.count.mockResolvedValue(1);

      await expect(
        service.register({
          email: 'otro@example.com',
          password: 'una-contrasena-larga',
          name: 'Otro',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      repository.findOne.mockResolvedValue(
        buildUser({ passwordHash: await bcrypt.hash('correcta', 12) }),
      );

      const result = await service.login({
        email: 'miguel@example.com',
        password: 'correcta',
      });

      expect(result.access_token).toBe('signed.jwt');
    });

    it('rejects a wrong password', async () => {
      repository.findOne.mockResolvedValue(
        buildUser({ passwordHash: await bcrypt.hash('correcta', 12) }),
      );

      await expect(
        service.login({ email: 'miguel@example.com', password: 'incorrecta' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nadie@example.com', password: 'lo-que-sea' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a deactivated user', async () => {
      repository.findOne.mockResolvedValue(
        buildUser({
          isActive: false,
          passwordHash: await bcrypt.hash('correcta', 12),
        }),
      );

      await expect(
        service.login({ email: 'miguel@example.com', password: 'correcta' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
