import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  
  return {
    base: mode === 'production' ? '/SpendingDashboard/frontend/dist/' : '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    server: {
      port: 3000,
      open: true
    },
    define: {
      'process.env.ENCRYPTION_PASSWORD': JSON.stringify(env.ENCRYPTION_PASSWORD),
      'process.env.MONTHLY_BUDGET': JSON.stringify(env.MONTHLY_BUDGET),
      'process.env.ENCRYPTED_STATS': JSON.stringify(env.ENCRYPTED_STATS),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_DATABASE_URL': JSON.stringify(env.FIREBASE_DATABASE_URL),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID)
    }
  };
});