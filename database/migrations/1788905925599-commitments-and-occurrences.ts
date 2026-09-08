import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommitmentsAndOccurrences1788905925599 implements MigrationInterface {
  name = 'CommitmentsAndOccurrences1788905925599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "commitments" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "category_id" integer NOT NULL, "name" character varying(120) NOT NULL, "type" character varying(16) NOT NULL, "kind" character varying(24) NOT NULL, "frequency" character varying(16) NOT NULL DEFAULT 'MONTHLY', "due_day" smallint NOT NULL, "cutoff_day" smallint, "expected_amount" numeric(12,2), "start_period" character(7) NOT NULL, "end_period" character(7), "total_installments" integer, "alert_days_before" integer array NOT NULL DEFAULT '{5,1,0}', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_commitments_due_day" CHECK ("due_day" BETWEEN 1 AND 31), CONSTRAINT "CHK_commitments_cutoff_day" CHECK ("cutoff_day" IS NULL OR "cutoff_day" BETWEEN 1 AND 31), CONSTRAINT "CHK_commitments_installments" CHECK ("total_installments" IS NULL OR "total_installments" > 0), CONSTRAINT "PK_commitments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commitments_user_active" ON "commitments" ("user_id", "is_active")`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitments" ADD CONSTRAINT "FK_commitments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitments" ADD CONSTRAINT "FK_commitments_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "commitment_occurrences" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "commitment_id" integer NOT NULL, "period" character(7) NOT NULL, "due_date" date NOT NULL, "expected_amount" numeric(12,2), "paid_amount" numeric(12,2) NOT NULL DEFAULT '0', "status" character varying(16) NOT NULL DEFAULT 'PENDING', "installment_number" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_occurrence_commitment_period" UNIQUE ("commitment_id", "period"), CONSTRAINT "PK_commitment_occurrences" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_occurrences_user_due_date" ON "commitment_occurrences" ("user_id", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_occurrences_user_status" ON "commitment_occurrences" ("user_id", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitment_occurrences" ADD CONSTRAINT "FK_occurrences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitment_occurrences" ADD CONSTRAINT "FK_occurrences_commitment" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "occurrence_id" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_occurrence" ON "transactions" ("occurrence_id")`,
    );
    // SET NULL y no CASCADE: borrar un compromiso no debe borrar el dinero que
    // realmente salió de la cuenta, solo desligarlo de su ocurrencia.
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_occurrence" FOREIGN KEY ("occurrence_id") REFERENCES "commitment_occurrences"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_occurrence"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_occurrence"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "occurrence_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitment_occurrences" DROP CONSTRAINT "FK_occurrences_commitment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitment_occurrences" DROP CONSTRAINT "FK_occurrences_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_occurrences_user_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_occurrences_user_due_date"`,
    );
    await queryRunner.query(`DROP TABLE "commitment_occurrences"`);
    await queryRunner.query(
      `ALTER TABLE "commitments" DROP CONSTRAINT "FK_commitments_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commitments" DROP CONSTRAINT "FK_commitments_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_commitments_user_active"`);
    await queryRunner.query(`DROP TABLE "commitments"`);
  }
}
