import * as Joi from 'joi';

export interface SentryConfig {
  dsn: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

export const sentryValidationSchema = {
  // A diferencia de los ms de invoixup, aquí el DSN es opcional: un DSN vacío
  // deja a Sentry inicializado pero inerte, para poder correr sin cuenta.
  SENTRY_DSN: Joi.string().uri().allow('').default(''),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(1.0),
  SENTRY_PROFILES_SAMPLE_RATE: Joi.number().min(0).max(1).default(1.0),
};

export default (): { sentry: SentryConfig } => ({
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 1.0,
    profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE
      ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE)
      : 1.0,
  },
});
