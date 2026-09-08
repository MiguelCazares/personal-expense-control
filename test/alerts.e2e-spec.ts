import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SuccessResponse } from '@miguelcazares/nestjs-response-helper';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { AlertEntity } from 'src/alerts/entities/alert.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';
import { AlertsService } from 'src/alerts/alerts.service';
import { NOTIFICATION_CHANNEL } from 'src/alerts/notifications/notification.interface';
import { TelegramMockService } from 'src/alerts/notifications/telegram-mock.service';
import { PublicUserDto } from 'src/auth/dto/auth-response.dto';
import { UserEntity } from 'src/auth/entities/user.entity';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { createE2eApp } from './helpers/e2e-app';
import { seedUser } from './helpers/seed-user';
import { resetDatabase } from './helpers/reset-db';

jest.setTimeout(30000);

type Paged<T> = SuccessResponse<PaginatedResponseDto<T>>;

describe('Alerts (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let userId: number;
  let alertsService: AlertsService;
  let channel: TelegramMockService;
  let occurrenceRepo: Repository<CommitmentOccurrenceEntity>;

  let amex: CommitmentEntity;
  let septiembre: CommitmentOccurrenceEntity;

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const patch = (path: string, body: object) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  /** dispatchForUser recibe la entidad; aquí basta con los campos que usa. */
  const currentUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: userId,
      telegramChatId: '123456789',
      timezone: 'America/Mexico_City',
      ...overrides,
    }) as UserEntity;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);

    const seeded = await seedUser(app, 'e2e-alerts@example.com');
    token = seeded.token;
    userId = seeded.user.id;

    alertsService = app.get(AlertsService);
    channel = app.get<TelegramMockService>(NOTIFICATION_CHANNEL);
    occurrenceRepo = app.get(getRepositoryToken(CommitmentOccurrenceEntity));

    const categoryResponse = await post('/api/categories', {
      name: 'Tarjeta AMEX',
      type: MovementType.EXPENSE,
      nature: CategoryNature.FIXED,
    }).expect(HttpStatus.CREATED);
    const category = (categoryResponse.body as SuccessResponse<CategoryEntity>)
      .data;

    const commitmentResponse = await post('/api/commitments', {
      name: 'Tarjeta de crédito AMEX',
      categoryId: category.id,
      kind: CommitmentKind.CREDIT_CARD,
      dueDay: 11,
      expectedAmount: 3200,
      startPeriod: '2026-09',
      alertDaysBefore: [5, 1, 0],
    }).expect(HttpStatus.CREATED);
    amex = (commitmentResponse.body as SuccessResponse<CommitmentEntity>).data;

    // Se deja una sola ocurrencia para que las cuentas del test sean exactas.
    const all = await occurrenceRepo.findBy({ commitmentId: amex.id });
    septiembre = all.find((o) => o.period.trim() === '2026-09')!;
    await occurrenceRepo.delete(
      all.filter((o) => o.id !== septiembre.id).map((o) => o.id),
    );
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  describe('el canal en tests es el mock', () => {
    it('no sale a la red aunque Telegram estuviera encendido', () => {
      expect(channel).toBeInstanceOf(TelegramMockService);
    });
  });

  describe('generación', () => {
    it('no genera nada en un día que no toca', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-08');
      expect(created).toBe(0);
    });

    it('genera el aviso de 5 días antes', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-06');
      expect(created).toBe(1);

      const listed = await get('/api/alerts').expect(HttpStatus.OK);
      const alerts = (listed.body as Paged<AlertEntity>).data.data;

      expect(alerts).toHaveLength(1);
      expect(alerts[0].kind).toBe(AlertKind.UPCOMING);
      expect(alerts[0].daysBefore).toBe(5);
      expect(alerts[0].message).toContain('Vence en 5 días');
      expect(alerts[0].sentAt).toBeNull();
    });

    it('correrlo dos veces el mismo día no duplica el aviso', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-06');
      expect(created).toBe(0);

      const listed = await get('/api/alerts').expect(HttpStatus.OK);
      expect((listed.body as Paged<AlertEntity>).data.meta.total).toBe(1);
    });

    it('el día del vencimiento genera un aviso distinto', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-11');
      expect(created).toBe(1);

      const listed = await get(
        `/api/alerts?kind=${AlertKind.DUE_TODAY}`,
      ).expect(HttpStatus.OK);
      expect((listed.body as Paged<AlertEntity>).data.meta.total).toBe(1);
    });

    it('pasada la fecha genera el aviso de vencido', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-20');
      expect(created).toBe(1);

      const listed = await get(`/api/alerts?kind=${AlertKind.OVERDUE}`).expect(
        HttpStatus.OK,
      );
      expect((listed.body as Paged<AlertEntity>).data.meta.total).toBe(1);
    });

    it('no vuelve a avisar de un vencimiento ya vencido', async () => {
      const created = await alertsService.generateForUser(userId, '2026-09-21');
      expect(created).toBe(0);
    });
  });

  describe('envío', () => {
    it('sin telegramChatId las alertas quedan en espera', async () => {
      const sent = await alertsService.dispatchForUser(
        currentUser({ telegramChatId: null }),
      );
      expect(sent).toBe(0);

      const pendientes = await get('/api/alerts?pending=true').expect(
        HttpStatus.OK,
      );
      expect(
        (pendientes.body as Paged<AlertEntity>).data.meta.total,
      ).toBeGreaterThan(0);
    });

    it('el mensaje de prueba sin chat responde 400, no 500', async () => {
      await post('/api/alerts/test', {}).expect(HttpStatus.BAD_REQUEST);
    });

    it('configurar el chat permite el envío', async () => {
      const response = await patch('/api/auth/me', {
        telegramChatId: '123456789',
      }).expect(HttpStatus.OK);

      expect(
        (response.body as SuccessResponse<PublicUserDto>).data.telegramChatId,
      ).toBe('123456789');
    });

    it('un PATCH parcial de perfil conserva la zona horaria', async () => {
      // Regresión: Object.assign copiaba las claves undefined del DTO y la
      // respuesta salía sin timezone ni telegramChatId.
      const response = await patch('/api/auth/me', {
        name: 'Miguel',
      }).expect(HttpStatus.OK);

      const profile = (response.body as SuccessResponse<PublicUserDto>).data;
      expect(profile.name).toBe('Miguel');
      expect(profile.timezone).toBe('America/Mexico_City');
      expect(profile.telegramChatId).toBe('123456789');
    });

    it('rechaza una zona horaria inventada', async () => {
      await patch('/api/auth/me', { timezone: 'Marte/Olympus' }).expect(
        HttpStatus.BAD_REQUEST,
      );
    });

    it('despacha lo pendiente y lo marca enviado', async () => {
      channel.sent.length = 0;

      const sent = await alertsService.dispatchForUser(currentUser());

      expect(sent).toBe(3);
      expect(channel.sent).toHaveLength(3);
      expect(channel.sent[0].chatId).toBe('123456789');

      const pendientes = await get('/api/alerts?pending=true').expect(
        HttpStatus.OK,
      );
      expect((pendientes.body as Paged<AlertEntity>).data.meta.total).toBe(0);
    });

    it('no reenvía lo ya enviado', async () => {
      channel.sent.length = 0;

      const sent = await alertsService.dispatchForUser(currentUser());

      expect(sent).toBe(0);
      expect(channel.sent).toHaveLength(0);
    });

    it('POST /api/alerts/test manda el mensaje de prueba', async () => {
      channel.sent.length = 0;

      await post('/api/alerts/test', {}).expect(HttpStatus.OK);

      expect(channel.sent).toHaveLength(1);
      expect(channel.sent[0].message).toContain('ms-expenses');
    });
  });

  describe('lo pagado deja de molestar', () => {
    it('un vencimiento cubierto ya no genera avisos', async () => {
      await occurrenceRepo.update(
        { id: septiembre.id },
        { status: 'PAID' as never, paidAmount: 3200 },
      );

      const created = await alertsService.generateForUser(userId, '2026-09-25');
      expect(created).toBe(0);
    });
  });
});
