import { defineConfig } from "vite";
export default defineConfig({
  build:{outDir:"dist",assetsDir:"assets",sourcemap:false,minify:"esbuild",cssMinify:true,manifest:true,rollupOptions:{output:{entryFileNames:"assets/index-[hash].js",chunkFileNames:"assets/chunk-[hash].js",assetFileNames:"assets/[name]-[hash][extname]"}}}
});
