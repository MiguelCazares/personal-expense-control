import type { JwtSignOptions } from '@nestjs/jwt';
import * as Joi from 'joi';

/**
 * jsonwebtoken no acepta un string cualquiera en `expiresIn`: espera segundos o
 * una plantilla tipo '90d' / '15m'. Se reusa su propio tipo para que el valor
 * quede validado en compilación en vez de reventar al firmar el primer token.
 */
export type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

export interface JwtConfig {
  secret: string;
  expiresIn: JwtExpiresIn;
}

export const jwtValidationSchema = {
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('90d'),
};

export default (): { jwt: JwtConfig } => ({
  jwt: {
    secret: process.env.JWT_SECRET || '',
    // Único cast del archivo: es la frontera donde el .env (string suelto)
    // entra al tipo estricto de jsonwebtoken.
    expiresIn: (process.env.JWT_EXPIRES_IN || '90d') as JwtExpiresIn,
  },
});
