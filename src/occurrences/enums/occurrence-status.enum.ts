export enum OccurrenceStatus {
  /** Aún no vence y no se ha pagado nada. */
  PENDING = 'PENDING',
  /** Hay pagos, pero no alcanzan el monto esperado. */
  PARTIAL = 'PARTIAL',
  /** Cubierta por completo. */
  PAID = 'PAID',
  /** Pasó su fecha límite sin cubrirse. */
  OVERDUE = 'OVERDUE',
  /** El usuario la descartó a mano (mes sin cargo, préstamo diferido). */
  SKIPPED = 'SKIPPED',
}
