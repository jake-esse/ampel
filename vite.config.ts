import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Vite 7 defaults to 'baseline-widely-available' (browsers from ~2.5 years ago)
    // Removed 'ES2020' as it's not compatible with lightningcss
    outDir: 'dist',
  },
  base: '/',
})
