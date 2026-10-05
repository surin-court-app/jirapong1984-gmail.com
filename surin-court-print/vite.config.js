import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // สำคัญ: กำหนด Relative Path สำหรับ Electron
})