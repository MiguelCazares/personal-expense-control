import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.(spec|e2e-spec).ts$',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Sin `transform` propio a propósito: ts-jest lee `isolatedModules: true` de
  // tsconfig.json y transpila sin type-check. No lo quites de ahí — construir el
  // programa completo de TypeScript para una app NestJS + TypeORM se pasa del
  // techo de heap (~486MB) del runner de CI y el job muere con OOM (exit 134).
  // Los tipos los cubren `nest build` (tsc) y typescript-eslint.
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 55,
      functions: 55,
      lines: 70,
    },
  },
};

export default config;
