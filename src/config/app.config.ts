import * as Joi from 'joi';

export interface AppConfig {
  port: number;
  env: string;
  corsOrigins: string[] | boolean;
}

export const appValidationSchema = {
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'local')
    .default('development'),
  PORT: Joi.number().default(3010),
  CORS_ORIGINS: Joi.string().optional(),
};

function parseCorsOrigins(value?: string): string[] | boolean {
  if (!value) return true; // sin restricción configurada: se permite cualquier origen
  return value.split(',').map((origin) => origin.trim());
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT || '3010', 10),
    env: process.env.NODE_ENV || 'development',
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  },
});
