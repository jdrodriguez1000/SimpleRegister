import type { Config } from 'jest';

const config: Config = {
  // Entorno de ejecucion: Node.js (API routes, no DOM)
  testEnvironment: 'node',

  // ts-jest como transformador para TypeScript
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Sobreescritura minima: moduleResolution node16 para compatibilidad con Jest
          moduleResolution: 'node16',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },

  // Resolucion del alias @/* definido en tsconfig.json
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Ubicacion de los tests
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx',
  ],

  // Cobertura: habilitada, umbral minimo > 90% en logica critica (DoD B02-V)
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/app/api/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Inicialización de entorno: carga variables NEXT_PUBLIC_* para tests FE
  setupFiles: ['<rootDir>/jest.setup.ts'],

  // Hooks del framework de test: aislamiento de estado entre bloques it()
  // Reseta el store in-memory del register_rate_limiter antes de cada test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.afterenv.ts'],

  // Supress output verbosity en CI
  verbose: true,
};

export default config;
