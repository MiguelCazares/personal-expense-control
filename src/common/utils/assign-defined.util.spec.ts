import { assignDefined } from 'src/common/utils/assign-defined.util';

describe('assignDefined', () => {
  it('copia los valores definidos', () => {
    const target = { name: 'viejo', nature: 'FIXED' };

    assignDefined(target, { name: 'nuevo' });

    expect(target).toEqual({ name: 'nuevo', nature: 'FIXED' });
  });

  it('ignora undefined en vez de borrar el valor previo', () => {
    const target = { name: 'viejo', nature: 'FIXED', color: '#fff' };

    // Así llega un DTO de PATCH: con todas las claves declaradas presentes.
    assignDefined(target, {
      name: 'nuevo',
      nature: undefined,
      color: undefined,
    });

    expect(target).toEqual({ name: 'nuevo', nature: 'FIXED', color: '#fff' });
  });

  it('sí respeta un null explícito', () => {
    const target: { color: string | null } = { color: '#fff' };

    assignDefined(target, { color: null });

    expect(target.color).toBeNull();
  });
});
