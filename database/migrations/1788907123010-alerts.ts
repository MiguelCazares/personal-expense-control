import { MigrationInterface, QueryRunner } from 'typeorm';

export class Alerts1788907123010 implements MigrationInterface {
  name = 'Alerts1788907123010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "occurrence_id" integer NOT NULL, "kind" character varying(16) NOT NULL, "days_before" integer NOT NULL DEFAULT 0, "channel" character varying(16) NOT NULL DEFAULT 'TELEGRAM', "scheduled_for" date NOT NULL, "message" text NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_alert_occurrence_kind_days_channel" UNIQUE ("occurrence_id", "kind", "days_before", "channel"), CONSTRAINT "PK_alerts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_user_sent_at" ON "alerts" ("user_id", "sent_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_alerts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_alerts_occurrence" FOREIGN KEY ("occurrence_id") REFERENCES "commitment_occurrences"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_alerts_occurrence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_alerts_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_alerts_user_sent_at"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
  }
}
