import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1788898839921 implements MigrationInterface {
  name = 'InitialMigration1788898839921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying(180) NOT NULL, "password_hash" character varying NOT NULL, "name" character varying(120) NOT NULL, "timezone" character varying(64) NOT NULL DEFAULT 'America/Mexico_City', "telegram_chat_id" character varying(64), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
