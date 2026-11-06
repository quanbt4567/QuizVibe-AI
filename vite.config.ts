/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build-time boundary guard preventing browser code (`src/`) from importing
 * server-only database modules (`api/lib/db`).
 */
function serverOnlyDbBoundaryPlugin(): Plugin {
  return {
    name: 'quizvibe-server-only-db-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      const normalizedImporter = importer.replace(/\\/g, '/');
      const normalizedSource = source.replace(/\\/g, '/');

      if (normalizedImporter.includes('/src/')) {
        const resolved = normalizedSource.startsWith('.')
          ? path.resolve(path.dirname(importer), source).replace(/\\/g, '/')
          : normalizedSource;

        if (
          resolved.includes('/api/_lib/db') ||
          resolved.includes('/api/_lib/auth') ||
          resolved.includes('/api/lib/db') ||
          resolved.includes('/api/lib/auth')
        ) {
          throw new Error(
            `SECURITY_VIOLATION: Client module "${importer}" attempted to import server-only module "${source}".`
          );
        }
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [serverOnlyDbBoundaryPlugin(), react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'api/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['.agents/**', 'node_modules/**', 'dist/**'],
  },
});
