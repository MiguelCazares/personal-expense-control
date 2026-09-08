import {
  dueDateFor,
  installmentNumberFor,
  monthsBetween,
} from 'src/commitments/utils/due-date.util';

describe('due-date.util', () => {
  describe('dueDateFor', () => {
    it.each([
      ['2026-09', 1, '2026-09-01'],
      ['2026-09', 11, '2026-09-11'],
      ['2026-09', 30, '2026-09-30'],
    ])('%s con día %i da %s', (period, day, expected) => {
      expect(dueDateFor(period, day)).toBe(expected);
    });

    it('recorta el día 31 al último día del mes', () => {
      expect(dueDateFor('2026-09', 31)).toBe('2026-09-30');
      expect(dueDateFor('2026-02', 31)).toBe('2026-02-28');
      expect(dueDateFor('2024-02', 30)).toBe('2024-02-29');
      expect(dueDateFor('2026-01', 31)).toBe('2026-01-31');
    });
  });

  describe('monthsBetween', () => {
    it.each([
      ['2026-09', '2026-09', 0],
      ['2026-09', '2026-12', 3],
      ['2026-09', '2027-09', 12],
      ['2026-09', '2026-08', -1],
    ])('de %s a %s hay %i meses', (from, to, expected) => {
      expect(monthsBetween(from, to)).toBe(expected);
    });
  });

  describe('installmentNumberFor', () => {
    it('la primera mensualidad es la 1', () => {
      expect(installmentNumberFor('2026-09', '2026-09')).toBe(1);
    });

    it('avanza un número por mes', () => {
      expect(installmentNumberFor('2026-09', '2026-10')).toBe(2);
      expect(installmentNumberFor('2026-09', '2027-08')).toBe(12);
    });
  });
});
