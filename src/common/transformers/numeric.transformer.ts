import { ValueTransformer } from 'typeorm';

// Postgres returns decimal/numeric columns as strings; keep them numbers in JS
export const numericTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
