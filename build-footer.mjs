import { build } from 'esbuild';
await build({ entryPoints: ['components/footer-entry.tsx'], bundle: true, minify: true, sourcemap: false, platform: 'browser', format: 'iife', target: ['es2020'], outfile: 'public/doodle-footer.js', define: { 'process.env.NODE_ENV': '"production"' } });
