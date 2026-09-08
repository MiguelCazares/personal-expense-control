import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoriesAndTransactions1788900598811 implements MigrationInterface {
  name = 'CategoriesAndTransactions1788900598811';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "name" character varying(80) NOT NULL, "type" character varying(16) NOT NULL, "nature" character varying(16) NOT NULL DEFAULT 'VARIABLE', "color" character varying(9), "icon" character varying(64), "is_archived" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_categories" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_user_type" ON "categories" ("user_id", "type")`,
    );
    // Índice de expresión: el nombre es único por usuario y tipo sin distinguir
    // mayúsculas, para que "Nómina" y "nómina" no convivan. No se puede declarar
    // en la entidad, así que vive solo aquí.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_categories_user_name_type" ON "categories" ("user_id", lower("name"), "type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "type" character varying(16) NOT NULL, "amount" numeric(12,2) NOT NULL, "occurred_on" date NOT NULL, "category_id" integer NOT NULL, "note" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_transactions_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_transactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_occurred_on" ON "transactions" ("user_id", "occurred_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_category" ON "transactions" ("user_id", "category_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_user_category"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_user_occurred_on"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_categories_user_name_type"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_categories_user_type"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
