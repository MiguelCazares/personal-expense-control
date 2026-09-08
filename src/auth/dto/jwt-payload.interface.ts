export interface JwtPayload {
  /** Id del usuario (claim estándar `sub`). */
  sub: number;
  email: string;
}
