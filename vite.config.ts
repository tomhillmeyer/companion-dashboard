import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // or vue, etc.

export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron
  build: {
    outDir: 'dist',
  }
})