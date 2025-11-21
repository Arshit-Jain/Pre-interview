import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // SECURITY: Explicitly expose BACKEND_URL to the client
  // By default, Vite only exposes variables starting with VITE_
  envPrefix: ['VITE_', 'BACKEND_URL'],
})