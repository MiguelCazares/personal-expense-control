export enum AlertKind {
  /** Faltan N días para el vencimiento. */
  UPCOMING = 'UPCOMING',
  /** Vence hoy. */
  DUE_TODAY = 'DUE_TODAY',
  /** Ya se pasó la fecha y sigue sin cubrirse. */
  OVERDUE = 'OVERDUE',
}
