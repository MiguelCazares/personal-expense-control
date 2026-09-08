import {
  buildAlertMessage,
  formatDueDate,
} from 'src/alerts/utils/alert-message.util';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';

const buildOccurrence = (
  overrides: Partial<CommitmentOccurrenceEntity> = {},
): CommitmentOccurrenceEntity =>
  ({
    id: 1,
    dueDate: '2026-09-11',
    expectedAmount: 3200,
    paidAmount: 0,
    installmentNumber: null,
    commitment: { name: 'Tarjeta AMEX', totalInstallments: null },
    ...overrides,
  }) as CommitmentOccurrenceEntity;

describe('alert-message.util', () => {
  describe('formatDueDate', () => {
    it('no desplaza el día al formatear', () => {
      // Construir un Date desde '2026-09-01' lo interpretaría como UTC y en
      // México saldría el 31 de agosto.
      expect(formatDueDate('2026-09-01')).toBe('01/09/2026');
      expect(formatDueDate('2026-09-11')).toBe('11/09/2026');
    });
  });

  describe('buildAlertMessage', () => {
    it('anuncia los días que faltan', () => {
      const message = buildAlertMessage(
        buildOccurrence(),
        AlertKind.UPCOMING,
        5,
      );

      expect(message).toContain('Vence en 5 días');
      expect(message).toContain('Tarjeta AMEX');
      expect(message).toContain('11/09/2026');
    });

    it('dice "mañana" en vez de "en 1 días"', () => {
      const message = buildAlertMessage(
        buildOccurrence(),
        AlertKind.UPCOMING,
        1,
      );

      expect(message).toContain('Vence mañana');
      expect(message).not.toContain('1 días');
    });

    it('distingue hoy de vencido', () => {
      expect(
        buildAlertMessage(buildOccurrence(), AlertKind.DUE_TODAY, 0),
      ).toContain('Vence hoy');
      expect(
        buildAlertMessage(buildOccurrence(), AlertKind.OVERDUE, 0),
      ).toContain('Vencido y sin pagar');
    });

    it('manda el saldo pendiente, no el total', () => {
      const message = buildAlertMessage(
        buildOccurrence({ paidAmount: 1200 }),
        AlertKind.UPCOMING,
        5,
      );

      expect(message).toContain('2,000.00');
      expect(message).toContain('Abonado');
    });

    it('avisa cuando el monto aún no se conoce', () => {
      const message = buildAlertMessage(
        buildOccurrence({ expectedAmount: null }),
        AlertKind.UPCOMING,
        5,
      );

      expect(message).toContain('monto por confirmar');
    });

    it('incluye la mensualidad en un préstamo', () => {
      const message = buildAlertMessage(
        buildOccurrence({
          installmentNumber: 3,
          commitment: {
            name: 'Préstamo 1',
            totalInstallments: 24,
          } as CommitmentOccurrenceEntity['commitment'],
        }),
        AlertKind.UPCOMING,
        5,
      );

      expect(message).toContain('Mensualidad 3 de 24');
    });
  });
});
