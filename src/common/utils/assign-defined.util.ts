/**
 * Copia solo las claves con valor definido.
 *
 * `Object.assign(entity, dto)` no sirve para un PATCH: class-transformer crea
 * la instancia del DTO con **todas** sus propiedades declaradas, así que las que
 * el cliente no mandó llegan como `undefined` y pisan los valores de la entidad.
 * TypeORM ignora `undefined` al guardar, de modo que la base sobrevive, pero la
 * respuesta sale con campos borrados.
 */
export function assignDefined<T extends object>(
  target: T,
  source: Partial<T> | Record<string, unknown>,
): T {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value;
    }
  }

  return target;
}
