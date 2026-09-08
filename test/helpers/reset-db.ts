import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

/**
 * Deja la base de test vacía. Va en un solo TRUNCATE con CASCADE porque
 * `categories` y `transactions` referencian a `users`: truncar tabla por tabla
 * falla con `cannot truncate a table referenced in a foreign key constraint`.
 * Al agregar tablas nuevas, súmalas aquí.
 */
export async function resetDatabase(app: INestApplication<App>): Promise<void> {
  await app
    .get(DataSource)
    .query(
      'TRUNCATE TABLE "transactions", "categories", "users" RESTART IDENTITY CASCADE',
    );
}
