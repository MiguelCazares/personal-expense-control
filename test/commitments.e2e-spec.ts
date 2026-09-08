import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SuccessResponse } from '@miguelcazares/nestjs-response-helper';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { OccurrencesService } from 'src/occurrences/occurrences.service';
import { PublicUserDto } from 'src/auth/dto/auth-response.dto';
import { createE2eApp } from './helpers/e2e-app';
import { seedUser } from './helpers/seed-user';
import { resetDatabase } from './helpers/reset-db';

jest.setTimeout(30000);

type Paged<T> = SuccessResponse<PaginatedResponseDto<T>>;

describe('Commitments y occurrences (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let otherToken: string;

  let amexCategory: CategoryEntity;
  let bbvaCategory: CategoryEntity;
  let variableCategory: CategoryEntity;
  let amex: CommitmentEntity;
  let bbva: CommitmentEntity;

  const post = (path: string, body: object, auth = token) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${auth}`)
      .send(body);

  const patch = (path: string, body: object, auth = token) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${auth}`)
      .send(body);

  const get = (path: string, auth = token) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${auth}`);

  const createCategory = async (
    name: string,
    nature: CategoryNature,
  ): Promise<CategoryEntity> => {
    const response = await post('/api/categories', {
      name,
      type: MovementType.EXPENSE,
      nature,
    }).expect(HttpStatus.CREATED);

    return (response.body as SuccessResponse<CategoryEntity>).data;
  };

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);

    ({ token } = await seedUser(app, 'e2e-commitments@example.com'));
    ({ token: otherToken } = await seedUser(app, 'e2e-otro@example.com'));

    amexCategory = await createCategory('Tarjeta AMEX', CategoryNature.FIXED);
    bbvaCategory = await createCategory('Tarjeta BBVA', CategoryNature.FIXED);
    variableCategory = await createCategory(
      'Restaurantes',
      CategoryNature.VARIABLE,
    );
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  describe('alta de compromisos', () => {
    it('crea la BBVA con vencimiento el día 1 y materializa de inmediato', async () => {
      const response = await post('/api/commitments', {
        name: 'Tarjeta de crédito BBVA',
        categoryId: bbvaCategory.id,
        kind: CommitmentKind.CREDIT_CARD,
        dueDay: 1,
        expectedAmount: 4500,
        startPeriod: '2026-09',
      }).expect(HttpStatus.CREATED);

      bbva = (response.body as SuccessResponse<CommitmentEntity>).data;
      expect(bbva.type).toBe(MovementType.EXPENSE);
      expect(bbva.alertDaysBefore).toEqual([5, 1, 0]);

      const listed = await get(
        `/api/occurrences?commitmentId=${bbva.id}`,
      ).expect(HttpStatus.OK);
      const body = listed.body as Paged<CommitmentOccurrenceEntity>;

      // Mes actual más el horizonte de 3 meses.
      expect(body.data.meta.total).toBe(4);
      expect(body.data.data[0].status).toBe(OccurrenceStatus.PENDING);
    });

    it('crea la AMEX con vencimiento el día 11', async () => {
      const response = await post('/api/commitments', {
        name: 'Tarjeta de crédito AMEX',
        categoryId: amexCategory.id,
        kind: CommitmentKind.CREDIT_CARD,
        dueDay: 11,
        cutoffDay: 28,
        startPeriod: '2026-09',
      }).expect(HttpStatus.CREATED);

      amex = (response.body as SuccessResponse<CommitmentEntity>).data;
      expect(amex.expectedAmount).toBeNull();
    });

    it('septiembre queda con la BBVA el día 1 y la AMEX el 11', async () => {
      const response = await get('/api/occurrences?period=2026-09').expect(
        HttpStatus.OK,
      );
      const body = response.body as Paged<CommitmentOccurrenceEntity>;

      expect(body.data.data.map((o) => [o.commitment.name, o.dueDate])).toEqual(
        [
          ['Tarjeta de crédito BBVA', '2026-09-01'],
          ['Tarjeta de crédito AMEX', '2026-09-11'],
        ],
      );
    });

    it('rechaza colgar un compromiso de una categoría VARIABLE', async () => {
      await post('/api/commitments', {
        name: 'No debería existir',
        categoryId: variableCategory.id,
        kind: CommitmentKind.OTHER,
        dueDay: 5,
        startPeriod: '2026-09',
      }).expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza endPeriod anterior a startPeriod', async () => {
      await post('/api/commitments', {
        name: 'Rango inválido',
        categoryId: bbvaCategory.id,
        kind: CommitmentKind.LOAN,
        dueDay: 5,
        startPeriod: '2026-09',
        endPeriod: '2026-08',
      }).expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza un día de pago fuera de rango', async () => {
      await post('/api/commitments', {
        name: 'Día inválido',
        categoryId: bbvaCategory.id,
        kind: CommitmentKind.OTHER,
        dueDay: 32,
        startPeriod: '2026-09',
      }).expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('no deja usar la categoría de otro usuario', async () => {
      await post(
        '/api/commitments',
        {
          name: 'Ajeno',
          categoryId: bbvaCategory.id,
          kind: CommitmentKind.OTHER,
          dueDay: 5,
          startPeriod: '2026-09',
        },
        otherToken,
      ).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('préstamo con mensualidades', () => {
    it('materializa solo hasta la última cuota', async () => {
      const category = await createCategory(
        'Préstamo corto',
        CategoryNature.FIXED,
      );

      const response = await post('/api/commitments', {
        name: 'Préstamo 3 meses',
        categoryId: category.id,
        kind: CommitmentKind.LOAN,
        dueDay: 15,
        expectedAmount: 1000,
        startPeriod: '2026-09',
        totalInstallments: 3,
      }).expect(HttpStatus.CREATED);

      const loan = (response.body as SuccessResponse<CommitmentEntity>).data;

      const listed = await get(
        `/api/occurrences?commitmentId=${loan.id}`,
      ).expect(HttpStatus.OK);
      const body = listed.body as Paged<CommitmentOccurrenceEntity>;

      expect(body.data.meta.total).toBe(3);
      expect(body.data.data.map((o) => o.installmentNumber)).toEqual([1, 2, 3]);
    });
  });

  describe('conciliación de pagos', () => {
    let septiembreAmex: CommitmentOccurrenceEntity;

    beforeAll(async () => {
      const listed = await get(
        `/api/occurrences?commitmentId=${amex.id}&period=2026-09`,
      ).expect(HttpStatus.OK);
      septiembreAmex = (listed.body as Paged<CommitmentOccurrenceEntity>).data
        .data[0];
    });

    it('ajusta el monto real del corte sin tocar el del compromiso', async () => {
      await patch(`/api/occurrences/${septiembreAmex.id}`, {
        expectedAmount: 3200,
      }).expect(HttpStatus.OK);

      const commitment = await get(`/api/commitments/${amex.id}`).expect(
        HttpStatus.OK,
      );
      expect(
        (commitment.body as SuccessResponse<CommitmentEntity>).data
          .expectedAmount,
      ).toBeNull();
    });

    it('un pago parcial deja el vencimiento en PARTIAL', async () => {
      await post('/api/transactions', {
        amount: 1200,
        occurredOn: '2026-09-10',
        categoryId: amexCategory.id,
        occurrenceId: septiembreAmex.id,
      }).expect(HttpStatus.CREATED);

      const response = await get(
        `/api/occurrences/${septiembreAmex.id}`,
      ).expect(HttpStatus.OK);
      const occurrence = (
        response.body as SuccessResponse<CommitmentOccurrenceEntity>
      ).data;

      expect(occurrence.paidAmount).toBe(1200);
      expect(occurrence.status).toBe(OccurrenceStatus.PARTIAL);
    });

    it('al cubrir el total pasa a PAID', async () => {
      await post('/api/transactions', {
        amount: 2000,
        occurredOn: '2026-09-11',
        categoryId: amexCategory.id,
        occurrenceId: septiembreAmex.id,
      }).expect(HttpStatus.CREATED);

      const response = await get(
        `/api/occurrences/${septiembreAmex.id}`,
      ).expect(HttpStatus.OK);
      const occurrence = (
        response.body as SuccessResponse<CommitmentOccurrenceEntity>
      ).data;

      expect(occurrence.paidAmount).toBe(3200);
      expect(occurrence.status).toBe(OccurrenceStatus.PAID);
    });

    it('borrar el pago devuelve el vencimiento a PARTIAL', async () => {
      const listed = await get(
        `/api/transactions?categoryId=${amexCategory.id}`,
      ).expect(HttpStatus.OK);
      const transactions = (listed.body as Paged<TransactionEntity>).data.data;
      const last = transactions[0];

      await request(app.getHttpServer())
        .delete(`/api/transactions/${last.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.NO_CONTENT);

      const response = await get(
        `/api/occurrences/${septiembreAmex.id}`,
      ).expect(HttpStatus.OK);
      const occurrence = (
        response.body as SuccessResponse<CommitmentOccurrenceEntity>
      ).data;

      expect(occurrence.paidAmount).toBe(1200);
      expect(occurrence.status).toBe(OccurrenceStatus.PARTIAL);
    });

    it('no deja pagar un vencimiento con una categoría que no es la suya', async () => {
      await post('/api/transactions', {
        amount: 100,
        occurredOn: '2026-09-11',
        categoryId: bbvaCategory.id,
        occurrenceId: septiembreAmex.id,
      }).expect(HttpStatus.BAD_REQUEST);
    });

    it('no deja enlazar el vencimiento de otro usuario', async () => {
      await post(
        '/api/transactions',
        {
          amount: 100,
          occurredOn: '2026-09-11',
          categoryId: amexCategory.id,
          occurrenceId: septiembreAmex.id,
        },
        otherToken,
      ).expect(HttpStatus.NOT_FOUND);
    });

    it('omitir el mes lo saca del radar', async () => {
      const listed = await get(
        `/api/occurrences?commitmentId=${bbva.id}&period=2026-12`,
      ).expect(HttpStatus.OK);
      const diciembre = (listed.body as Paged<CommitmentOccurrenceEntity>).data
        .data[0];

      await patch(`/api/occurrences/${diciembre.id}`, {
        status: OccurrenceStatus.SKIPPED,
      }).expect(HttpStatus.OK);

      const response = await get(`/api/occurrences/${diciembre.id}`).expect(
        HttpStatus.OK,
      );
      expect(
        (response.body as SuccessResponse<CommitmentOccurrenceEntity>).data
          .status,
      ).toBe(OccurrenceStatus.SKIPPED);
    });
  });

  describe('edición y borrado', () => {
    it('cambiar el día de pago mueve solo los vencimientos pendientes', async () => {
      await patch(`/api/commitments/${bbva.id}`, { dueDay: 5 }).expect(
        HttpStatus.OK,
      );

      const listed = await get(
        `/api/occurrences?commitmentId=${bbva.id}&period=2026-10`,
      ).expect(HttpStatus.OK);
      const octubre = (listed.body as Paged<CommitmentOccurrenceEntity>).data
        .data[0];

      expect(octubre.dueDate).toBe('2026-10-05');
    });

    it('el mes omitido conserva su fecha original', async () => {
      const listed = await get(
        `/api/occurrences?commitmentId=${bbva.id}&period=2026-12`,
      ).expect(HttpStatus.OK);
      const diciembre = (listed.body as Paged<CommitmentOccurrenceEntity>).data
        .data[0];

      expect(diciembre.dueDate).toBe('2026-12-01');
    });

    it('responde 409 al borrar un compromiso con pagos encima', async () => {
      await request(app.getHttpServer())
        .delete(`/api/commitments/${amex.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.CONFLICT);
    });

    it('desactivarlo lo saca del listado por defecto', async () => {
      await patch(`/api/commitments/${amex.id}`, { isActive: false }).expect(
        HttpStatus.OK,
      );

      const listed = await get('/api/commitments').expect(HttpStatus.OK);
      const body = listed.body as Paged<CommitmentEntity>;
      expect(body.data.data.some((c) => c.id === amex.id)).toBe(false);

      const all = await get('/api/commitments?includeInactive=true').expect(
        HttpStatus.OK,
      );
      expect(
        (all.body as Paged<CommitmentEntity>).data.data.some(
          (c) => c.id === amex.id,
        ),
      ).toBe(true);
    });
  });

  describe('marcado de vencidas (lo que corre el cron)', () => {
    it('pasa a OVERDUE lo pendiente cuya fecha ya pasó', async () => {
      const service = app.get(OccurrencesService);
      const me = await get('/api/auth/me').expect(HttpStatus.OK);
      const userId = (me.body as SuccessResponse<PublicUserDto>).data.id;

      // Se simula "hoy" en 2027 en vez de esperar al cron de medianoche.
      const affected = await service.markOverdue(userId, '2027-01-01');
      expect(affected).toBeGreaterThan(0);

      const listed = await get(
        `/api/occurrences?status=${OccurrenceStatus.OVERDUE}`,
      ).expect(HttpStatus.OK);
      expect(
        (listed.body as Paged<CommitmentOccurrenceEntity>).data.meta.total,
      ).toBeGreaterThan(0);
    });

    it('no reabre lo que el usuario omitió a mano', async () => {
      const listed = await get(
        `/api/occurrences?status=${OccurrenceStatus.SKIPPED}`,
      ).expect(HttpStatus.OK);

      const skipped = (listed.body as Paged<CommitmentOccurrenceEntity>).data;
      expect(skipped.meta.total).toBe(1);
      expect(skipped.data[0].period.trim()).toBe('2026-12');
    });

    it('no toca lo ya pagado', async () => {
      const listed = await get(
        `/api/occurrences?status=${OccurrenceStatus.PAID}`,
      ).expect(HttpStatus.OK);

      const paid = (listed.body as Paged<CommitmentOccurrenceEntity>).data;
      expect(paid.data.every((o) => o.status === OccurrenceStatus.PAID)).toBe(
        true,
      );
    });

    it('lo vencido sale en upcoming aunque quede fuera de la ventana', async () => {
      const response = await get('/api/occurrences/upcoming?days=1').expect(
        HttpStatus.OK,
      );

      const upcoming = (
        response.body as SuccessResponse<CommitmentOccurrenceEntity[]>
      ).data;
      expect(upcoming.some((o) => o.status === OccurrenceStatus.OVERDUE)).toBe(
        true,
      );
    });
  });

  describe('aislamiento por usuario', () => {
    it('otro usuario no ve ningún vencimiento', async () => {
      const response = await get('/api/occurrences', otherToken).expect(
        HttpStatus.OK,
      );
      expect(
        (response.body as Paged<CommitmentOccurrenceEntity>).data.meta.total,
      ).toBe(0);
    });

    it('otro usuario no ve el compromiso por id', async () => {
      await get(`/api/commitments/${bbva.id}`, otherToken).expect(
        HttpStatus.NOT_FOUND,
      );
    });
  });
});
