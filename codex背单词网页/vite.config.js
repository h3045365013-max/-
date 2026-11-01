import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 相对路径可同时适配本地预览和 GitHub Pages 项目站点子路径。
export default defineConfig({ base: './', plugins: [vue()] })
