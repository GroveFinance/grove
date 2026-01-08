import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

/**
 * Vite configuration for GitHub Pages demo
 * Build with: vite build --config vite.config.demo.ts --mode demo
 */
export default defineConfig({
  plugins: [tailwindcss(), react()],

  // GitHub Pages serves from /<repo-name>/
  // Note: Update this to match your repository name
  base: '/grove/',

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',  // Use esbuild instead of terser (faster, no extra deps)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      components: path.resolve(__dirname, './src/components'),
      layouts: path.resolve(__dirname, './src/components/layouts'),
      assets: path.resolve(__dirname, './src/assets'),
      hooks: path.resolve(__dirname, './src/hooks'),
      utils: path.resolve(__dirname, './src/utils'),
      context: path.resolve(__dirname, './src/context'),
      pages: path.resolve(__dirname, './src/pages'),
      styles: path.resolve(__dirname, './src/styles'),
      services: path.resolve(__dirname, './src/services'),
      types: path.resolve(__dirname, './src/types'),
    }
  },

  // Define demo mode env variables
  define: {
    'import.meta.env.VITE_API_MODE': JSON.stringify('demo'),
  },
})
