import {
  currentPeriod,
  periodBounds,
  periodRange,
  shiftPeriod,
} from 'src/summary/utils/period.util';

describe('period.util', () => {
  describe('periodBounds', () => {
    it.each([
      ['2026-09', '2026-09-01', '2026-09-30'],
      ['2026-01', '2026-01-01', '2026-01-31'],
      ['2026-02', '2026-02-01', '2026-02-28'],
      ['2024-02', '2024-02-01', '2024-02-29'],
      ['2026-12', '2026-12-01', '2026-12-31'],
    ])('%s abarca de %s a %s', (period, from, to) => {
      expect(periodBounds(period)).toEqual({ from, to });
    });
  });

  describe('shiftPeriod', () => {
    it.each([
      ['2026-09', 1, '2026-10'],
      ['2026-09', -1, '2026-08'],
      ['2026-12', 1, '2027-01'],
      ['2026-01', -1, '2025-12'],
      ['2026-09', -12, '2025-09'],
      ['2026-09', 0, '2026-09'],
    ])('%s desplazado %i meses da %s', (period, months, expected) => {
      expect(shiftPeriod(period, months)).toBe(expected);
    });
  });

  describe('periodRange', () => {
    it('devuelve una serie continua que termina en el periodo pedido', () => {
      expect(periodRange('2026-09', 3)).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
    });

    it('cruza el cambio de año', () => {
      expect(periodRange('2026-02', 4)).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
      ]);
    });
  });

  describe('currentPeriod', () => {
    it('usa la zona del usuario, no la del servidor', () => {
      // 2026-10-01 00:30 UTC sigue siendo 30 de septiembre en Ciudad de México.
      const instant = new Date('2026-10-01T00:30:00Z');

      expect(currentPeriod('America/Mexico_City', instant)).toBe('2026-09');
      expect(currentPeriod('UTC', instant)).toBe('2026-10');
    });
  });
});
