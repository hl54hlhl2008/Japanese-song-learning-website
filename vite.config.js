import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// kuromoji 的 Node 入口依赖文件系统；构建时替换成浏览器可打包的入口。
const offlineTokenizer = fileURLToPath(new URL('./node_modules/@faanau/kuromoji/src/kuromoji.js', import.meta.url))
const browserDictionaryLoader = fileURLToPath(new URL('./src/lib/AndroidDictionaryLoader.cjs', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: '@faanau/kuromoji', replacement: offlineTokenizer },
    { find: './loader/NodeDictionaryLoader', replacement: browserDictionaryLoader },
  ] },
  // Keep user-provided full-song audio in /song instead of duplicating it under
  // /public. Vite serves these files at the site root in development and copies
  // them into dist for a production build.
  publicDir: 'song',
})
