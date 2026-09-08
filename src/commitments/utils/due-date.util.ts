import { periodBounds } from 'src/summary/utils/period.util';

/**
 * Fecha límite del compromiso dentro de un periodo.
 * `dueDay` se recorta al último día del mes: un compromiso que vence el 31 cae
 * el 28 en febrero, no se desborda a marzo.
 */
export function dueDateFor(period: string, dueDay: number): string {
  const { to } = periodBounds(period);
  const lastDay = Number(to.slice(-2));
  const day = Math.min(dueDay, lastDay);

  return `${period}-${String(day).padStart(2, '0')}`;
}

/** Meses completos entre dos periodos 'YYYY-MM'. Negativo si `to` es anterior. */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);

  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/**
 * Número de mensualidad de un periodo, contando desde 1 en `startPeriod`.
 * Es lo que apaga solo a un préstamo cuando llega a su última cuota.
 */
export function installmentNumberFor(
  startPeriod: string,
  period: string,
): number {
  return monthsBetween(startPeriod, period) + 1;
}
