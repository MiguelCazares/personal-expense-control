/**
 * VARIABLE: el gasto cambia mes a mes y se registra a mano (comida, transporte).
 * FIXED: hay un compromiso recurrente detrás (tarjeta, préstamo, suscripción).
 * En F2 solo las categorías FIXED pueden colgar un `commitment`.
 */
export enum CategoryNature {
  VARIABLE = 'VARIABLE',
  FIXED = 'FIXED',
}
