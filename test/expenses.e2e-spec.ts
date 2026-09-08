import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SuccessResponse } from '@miguelcazares/nestjs-response-helper';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import {
  CashflowPointDto,
  MonthlySummaryDto,
} from 'src/summary/dto/summary-response.dto';
import { createE2eApp } from './helpers/e2e-app';
import { seedUser } from './helpers/seed-user';
import { resetDatabase } from './helpers/reset-db';

jest.setTimeout(30000);

describe('Categories, transactions y summary (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let otherToken: string;
  let nomina: CategoryEntity;
  let amex: CategoryEntity;

  const post = (path: string, body: object, auth = token) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${auth}`)
      .send(body);

  const get = (path: string, auth = token) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);

    ({ token } = await seedUser(app, 'e2e-owner@example.com'));
    ({ token: otherToken } = await seedUser(app, 'e2e-intruso@example.com'));
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  describe('categorías', () => {
    it('crea una categoría de ingreso y otra de egreso', async () => {
      const income = await post('/api/categories', {
        name: 'Nómina',
        type: MovementType.INCOME,
      }).expect(HttpStatus.CREATED);

      const expense = await post('/api/categories', {
        name: 'Tarjeta de crédito AMEX',
        type: MovementType.EXPENSE,
        nature: CategoryNature.FIXED,
        color: '#00b2e3',
      }).expect(HttpStatus.CREATED);

      nomina = (income.body as SuccessResponse<CategoryEntity>).data;
      amex = (expense.body as SuccessResponse<CategoryEntity>).data;

      expect(nomina.nature).toBe(CategoryNature.VARIABLE);
      expect(amex.nature).toBe(CategoryNature.FIXED);
    });

    it('rechaza un nombre repetido sin distinguir mayúsculas', async () => {
      await post('/api/categories', {
        name: 'nómina',
        type: MovementType.INCOME,
      }).expect(HttpStatus.CONFLICT);
    });

    it('permite el mismo nombre en la dirección contraria', async () => {
      const response = await post('/api/categories', {
        name: 'Nómina',
        type: MovementType.EXPENSE,
      }).expect(HttpStatus.CREATED);

      const created = (response.body as SuccessResponse<CategoryEntity>).data;
      await request(app.getHttpServer())
        .delete(`/api/categories/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('no deja ver las categorías de otro usuario', async () => {
      await get(`/api/categories/${nomina.id}`, otherToken).expect(
        HttpStatus.NOT_FOUND,
      );

      const listed = await get('/api/categories', otherToken).expect(
        HttpStatus.OK,
      );
      const body = listed.body as SuccessResponse<
        PaginatedResponseDto<CategoryEntity>
      >;
      expect(body.data.meta.total).toBe(0);
    });

    it('filtra por tipo', async () => {
      const response = await get(
        `/api/categories?type=${MovementType.INCOME}`,
      ).expect(HttpStatus.OK);

      const body = response.body as SuccessResponse<
        PaginatedResponseDto<CategoryEntity>
      >;
      expect(body.data.data.every((c) => c.type === MovementType.INCOME)).toBe(
        true,
      );
    });
  });

  describe('movimientos', () => {
    it('deriva el tipo de la categoría', async () => {
      const response = await post('/api/transactions', {
        amount: 32000,
        occurredOn: '2026-09-01',
        categoryId: nomina.id,
      }).expect(HttpStatus.CREATED);

      const created = (response.body as SuccessResponse<TransactionEntity>)
        .data;
      expect(created.type).toBe(MovementType.INCOME);
      expect(created.amount).toBe(32000);
      expect(created.occurredOn).toBe('2026-09-01');
    });

    it('registra los egresos del mes', async () => {
      await post('/api/transactions', {
        amount: 1250.5,
        occurredOn: '2026-09-11',
        categoryId: amex.id,
        note: 'Pago mensualidad',
      }).expect(HttpStatus.CREATED);

      await post('/api/transactions', {
        amount: 749.5,
        occurredOn: '2026-09-20',
        categoryId: amex.id,
      }).expect(HttpStatus.CREATED);
    });

    it('rechaza un monto con más de dos decimales', async () => {
      await post('/api/transactions', {
        amount: 10.999,
        occurredOn: '2026-09-11',
        categoryId: amex.id,
      }).expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('rechaza un monto negativo', async () => {
      await post('/api/transactions', {
        amount: -100,
        occurredOn: '2026-09-11',
        categoryId: amex.id,
      }).expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('rechaza una fecha con hora', async () => {
      await post('/api/transactions', {
        amount: 100,
        occurredOn: '2026-09-11T10:00:00Z',
        categoryId: amex.id,
      }).expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('no deja usar la categoría de otro usuario', async () => {
      await post(
        '/api/transactions',
        { amount: 100, occurredOn: '2026-09-11', categoryId: amex.id },
        otherToken,
      ).expect(HttpStatus.NOT_FOUND);
    });

    it('filtra por rango de fechas', async () => {
      const response = await get(
        '/api/transactions?from=2026-09-10&to=2026-09-15',
      ).expect(HttpStatus.OK);

      const body = response.body as SuccessResponse<
        PaginatedResponseDto<TransactionEntity>
      >;
      expect(body.data.meta.total).toBe(1);
      expect(body.data.data[0].occurredOn).toBe('2026-09-11');
    });

    it('rechaza un rango invertido', async () => {
      await get('/api/transactions?from=2026-09-30&to=2026-09-01').expect(
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('resumen', () => {
    it('cuadra ingresos, egresos y balance del periodo', async () => {
      const response = await get('/api/summary/monthly?period=2026-09').expect(
        HttpStatus.OK,
      );

      const summary = (response.body as SuccessResponse<MonthlySummaryDto>)
        .data;
      expect(summary).toMatchObject({
        period: '2026-09',
        from: '2026-09-01',
        to: '2026-09-30',
        income: 32000,
        expense: 2000,
        balance: 30000,
      });
    });

    it('desglosa por categoría con porcentajes sobre su propia dirección', async () => {
      const response = await get('/api/summary/monthly?period=2026-09').expect(
        HttpStatus.OK,
      );

      const summary = (response.body as SuccessResponse<MonthlySummaryDto>)
        .data;
      const amexRow = summary.byCategory.find(
        (row) => row.categoryId === amex.id,
      );

      expect(amexRow).toMatchObject({
        total: 2000,
        count: 2,
        percentage: 100,
      });
    });

    it('devuelve ceros en un mes sin movimientos', async () => {
      const response = await get('/api/summary/monthly?period=2026-08').expect(
        HttpStatus.OK,
      );

      const summary = (response.body as SuccessResponse<MonthlySummaryDto>)
        .data;
      expect(summary).toMatchObject({ income: 0, expense: 0, balance: 0 });
      expect(summary.byCategory).toEqual([]);
    });

    it('rechaza un periodo mal formado', async () => {
      await get('/api/summary/monthly?period=2026-13').expect(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    it('el cashflow devuelve la serie completa, con ceros incluidos', async () => {
      const response = await get(
        '/api/summary/cashflow?months=3&until=2026-09',
      ).expect(HttpStatus.OK);

      const series = (response.body as SuccessResponse<CashflowPointDto[]>)
        .data;
      expect(series.map((point) => point.period)).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
      expect(series[0]).toMatchObject({ income: 0, expense: 0, balance: 0 });
      expect(series[2]).toMatchObject({
        income: 32000,
        expense: 2000,
        balance: 30000,
      });
    });

    it('el resumen de otro usuario está vacío', async () => {
      const response = await get(
        '/api/summary/monthly?period=2026-09',
        otherToken,
      ).expect(HttpStatus.OK);

      const summary = (response.body as SuccessResponse<MonthlySummaryDto>)
        .data;
      expect(summary).toMatchObject({ income: 0, expense: 0, balance: 0 });
    });
  });

  describe('borrado de categorías', () => {
    it('responde 409 cuando la categoría ya tiene movimientos', async () => {
      await request(app.getHttpServer())
        .delete(`/api/categories/${amex.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.CONFLICT);
    });

    it('archivar la deja fuera del listado y bloquea movimientos nuevos', async () => {
      await request(app.getHttpServer())
        .patch(`/api/categories/${amex.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isArchived: true })
        .expect(HttpStatus.OK);

      const listed = await get('/api/categories').expect(HttpStatus.OK);
      const body = listed.body as SuccessResponse<
        PaginatedResponseDto<CategoryEntity>
      >;
      expect(body.data.data.some((c) => c.id === amex.id)).toBe(false);

      await post('/api/transactions', {
        amount: 100,
        occurredOn: '2026-09-25',
        categoryId: amex.id,
      }).expect(HttpStatus.BAD_REQUEST);
    });

    it('el histórico archivado sigue contando en el resumen', async () => {
      const response = await get('/api/summary/monthly?period=2026-09').expect(
        HttpStatus.OK,
      );

      const summary = (response.body as SuccessResponse<MonthlySummaryDto>)
        .data;
      expect(summary.expense).toBe(2000);
    });
  });
});
