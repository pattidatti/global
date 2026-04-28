import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database', 'firebase/functions'],
          pixi: ['pixi.js', 'pixi-viewport'],
          charts: ['recharts'],
          forcegraph: ['react-force-graph-2d'],
        },
      },
    },
  },
});
