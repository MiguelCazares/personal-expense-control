/**
 * Utilidades de periodo 'YYYY-MM'. Todo se hace con aritmética de strings y
 * fechas UTC a propósito: `occurred_on` es un día de calendario, así que meter
 * un `Date` local aquí desplazaría los límites del mes según la zona del server.
 */

/** Mes en curso según la zona del usuario, no la del servidor. */
export function currentPeriod(
  timezone: string,
  now: Date = new Date(),
): string {
  // 'en-CA' da el formato ISO (YYYY-MM-DD) ya resuelto en la zona pedida.
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return localDate.slice(0, 7);
}

/** Primer y último día del periodo, ambos inclusivos. */
export function periodBounds(period: string): { from: string; to: string } {
  const [year, month] = period.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este mes; cubre febrero y bisiestos.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${period}-01`,
    to: `${period}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Desplaza el periodo N meses (negativo hacia atrás). */
export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Serie continua de periodos que termina en `until`, de largo `months`. */
export function periodRange(until: string, months: number): string[] {
  return Array.from({ length: months }, (_, index) =>
    shiftPeriod(until, index - months + 1),
  );
}
