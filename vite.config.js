import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      // Enable polyfills for Node.js built-ins used by poro
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      // Polyfill specific modules
      protocolImports: true
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    },
    // Handle Node.js built-ins used by poro
    dedupe: ['poro']
  },
  define: {
    // Provide global URLSearchParams for browser
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['localforage', 'poro']
  },
  server: {
    port: 3001,
    open: true,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/poro/, /node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  root: '.'
})

