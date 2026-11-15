import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'dist/assets/app.js',
  logLevel: 'info',
});
