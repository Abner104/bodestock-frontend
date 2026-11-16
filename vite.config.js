import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
  ],
  server: {
    port: 5173,
    https: true,
    host: true,
    headers: {
      // Requerido para que SharedArrayBuffer / WASM funcione en navegadores modernos
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  optimizeDeps: {
    exclude: ['@undecaf/zbar-wasm']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React + React DOM — SIEMPRE su propio chunk, evaluado antes que
          // cualquier otra regla. Sin esto, react-dom termina agrupado en
          // vendor-misc mientras vendor-three (R3F/drei) también depende de
          // React -- Rollup no garantiza el orden de inicialización entre
          // chunks hermanos, así que R3F podía ejecutar antes de que React
          // estuviera listo y fallar con "Cannot read properties of
          // undefined (reading 'useLayoutEffect')". Un chunk propio para
          // React se carga como dependencia común antes que los demás.
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom')
              || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Firebase — siempre necesario, chunk propio
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase-v2';
          }
          // MUI — pesado, chunk propio
          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
            return 'vendor-mui';
          }
          // Framer Motion + motion-dom/motion-utils (sus sub-paquetes internos)
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-dom') || id.includes('node_modules/motion-utils')) {
            return 'vendor-motion';
          }
          // GSAP — solo Super Admin
          if (id.includes('node_modules/gsap')) {
            return 'vendor-gsap';
          }
          // Three.js + React Three Fiber — muy pesado. Varias dependencias
          // de drei/fiber tienen que vivir en el MISMO chunk que three,
          // porque hay DOS copias de zustand en el árbol (zustand@5 en la
          // raíz, usado por drei/fiber directo, y zustand@4 anidado dentro
          // de tunnel-rat -- node_modules/tunnel-rat/node_modules/zustand,
          // que no se dedupea porque tunnel-rat fija ^4.3.2). Si cualquiera
          // de los dos termina en un chunk distinto al del otro, Rollup no
          // garantiza el orden de inicialización entre esos dos chunks
          // hermanos y revienta con "Cannot access 'X' before
          // initialization" (confirmado con Playwright: el símbolo roto,
          // 'MT', es el `create` de zustand usado por useProgress).
          // `postprocessing` (el paquete, usado por @react-three/postprocessing)
          // tiene el mismo problema de chunk separado por una razón
          // distinta (dependencia circular real en tiempo de ejecución con
          // three) -- mismo síntoma, se agrupa acá por la misma razón.
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')
              || id.includes('node_modules/postprocessing') || id.includes('node_modules/n8ao')
              || id.includes('node_modules/tunnel-rat') || id.includes('node_modules/zustand')
              || id.includes('node_modules/use-sync-external-store') || id.includes('node_modules/its-fine')
              || id.includes('node_modules/react-reconciler') || id.includes('node_modules/suspend-react')) {
            return 'vendor-three';
          }
          // Konva — solo warehouse maps
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) {
            return 'vendor-konva';
          }
          // xlsx — importado dinámicamente en exports
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/fflate')) {
            return 'vendor-xlsx';
          }
          // jsPDF + canvg/html2canvas/svg-pathdata (dependencias de jspdf)
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/canvg') || id.includes('node_modules/dompurify') || id.includes('node_modules/rgbcolor') || id.includes('node_modules/svg-pathdata') || id.includes('node_modules/stackblur-canvas') || id.includes('node_modules/performance-now') || id.includes('node_modules/raf')) {
            return 'vendor-pdf';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Radix UI
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // Lodash — muchos módulos pequeños, chunk propio
          if (id.includes('node_modules/lodash')) {
            return 'vendor-lodash';
          }
          // i18n — solo si el usuario usa el idioma
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          // core-js polyfills — chunk propio para no contaminar el misc
          if (id.includes('node_modules/core-js') || id.includes('node_modules/@babel')) {
            return 'vendor-polyfills';
          }
          // QR code — solo se usa en modales específicos
          if (id.includes('node_modules/qrcode') || id.includes('node_modules/dijkstrajs')) {
            return 'vendor-qr';
          }
          // Resto de node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        }
      }
    }
  }
})
