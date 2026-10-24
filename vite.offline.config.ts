import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'offline-src',base:'/offline/',plugins:[react()],build:{outDir:'../public/offline',emptyOutDir:true}});
