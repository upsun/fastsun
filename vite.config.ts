import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
  server: {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
    proxy: {
      '/api': {
        target: 'https://api.fastly.com/',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('API\tproxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(
              'API\tSending Request to the Target:',
              '[' + req.method + '] ' + proxyReq.protocol + '//' + proxyReq.host + proxyReq.path, // URL
              //JSON.stringify(proxyReq.getHeaders())
            );
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('API\tReceived Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/rt': {
        target: 'https://rt.fastly.com/',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/rt/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('RT\tproxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(
              'API\tSending Request to the Target:',
              '[' + req.method + '] ' + proxyReq.protocol + '//' + proxyReq.host + proxyReq.path, // URL
              //JSON.stringify(proxyReq.getHeaders())
            );
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('RT\tReceived Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
        // manualChunks: {},
      },
    },
  },
});
