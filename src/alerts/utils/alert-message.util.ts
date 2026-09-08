import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

/** 'YYYY-MM-DD' → '11/09/2026', sin construir un Date (evita el corrimiento de zona). */
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatAmount(occurrence: CommitmentOccurrenceEntity): string {
  const pending =
    occurrence.expectedAmount !== null
      ? occurrence.expectedAmount - occurrence.paidAmount
      : null;

  if (pending === null) return 'monto por confirmar';
  return currencyFormatter.format(pending);
}

function headline(kind: AlertKind, daysBefore: number): string {
  switch (kind) {
    case AlertKind.DUE_TODAY:
      return '🔔 <b>Vence hoy</b>';
    case AlertKind.OVERDUE:
      return '⚠️ <b>Vencido y sin pagar</b>';
    default:
      return daysBefore === 1
        ? '📅 <b>Vence mañana</b>'
        : `📅 <b>Vence en ${daysBefore} días</b>`;
  }
}

/**
 * Texto del aviso. Va en HTML porque es lo que entiende Telegram con
 * `parse_mode: 'HTML'`, y se manda el **saldo pendiente**, no el total: si ya
 * abonaste algo, lo útil es lo que falta.
 */
export function buildAlertMessage(
  occurrence: CommitmentOccurrenceEntity,
  kind: AlertKind,
  daysBefore: number,
): string {
  const name = occurrence.commitment.name;
  const lines = [
    headline(kind, daysBefore),
    name,
    `${formatDueDate(occurrence.dueDate)} · ${formatAmount(occurrence)}`,
  ];

  if (occurrence.paidAmount > 0) {
    lines.push(
      `<i>Abonado: ${currencyFormatter.format(occurrence.paidAmount)}</i>`,
    );
  }

  if (occurrence.installmentNumber && occurrence.commitment.totalInstallments) {
    lines.push(
      `<i>Mensualidad ${occurrence.installmentNumber} de ${occurrence.commitment.totalInstallments}</i>`,
    );
  }

  return lines.join('\n');
}
