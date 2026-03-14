## Dependências

```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Scripts sugeridos no package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Se o alias `@` do seu projeto não aponta para `src`

Ajuste isto em `vitest.config.ts`.
