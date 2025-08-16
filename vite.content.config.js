import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/contentScript.jsx',
      name: 'contentScript',
      formats: ['iife'],
      fileName: () => 'contentScript.js'
    },
    rollupOptions: {
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    },
    emptyOutDir: false
  },
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis'
  }
});
