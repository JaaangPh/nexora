import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appBuildId = Date.now().toString(36);

const appVersionPlugin: Plugin = {
  name: 'nexora-app-version',
  writeBundle(outputOptions) {
    const outputDirectory = outputOptions.dir || resolve(process.cwd(), 'dist');
    writeFileSync(resolve(outputDirectory, 'version.json'), JSON.stringify({ buildId: appBuildId }));
  },
};

export default defineConfig({
  plugins: [react(), appVersionPlugin],
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
