import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import * as dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

// Debe llamarse antes de requerir cualquier otro módulo.
// Con SENTRY_DSN vacío, init() no reporta nada: el servicio corre igual.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : 1.0,
  profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE
    ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE)
    : 1.0,
});
