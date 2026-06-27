// Configuración mínima (flat config) para Node + CommonJS.
module.exports = [
  // Ignores GLOBALES: deben ir en un objeto propio (sin `files`) en flat config.
  { ignores: ['node_modules/**', 'uploads/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
      'no-undef': 'error',
    },
  },
];
