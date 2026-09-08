/**
 * Dirección del dinero. Lo comparten `categories` y `transactions`: una
 * transacción solo puede colgar de una categoría del mismo tipo, y esa regla
 * es más fácil de sostener con un único enum que con dos paralelos.
 */
export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}
