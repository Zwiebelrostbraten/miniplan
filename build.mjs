import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const result = await build({
  bundle: true,
  entryPoints: ['src/app.js'],
  format: 'iife',
  loader: { '.ics': 'text' },
  minify: true,
  platform: 'browser',
  target: ['es2020'],
  write: false,
});
const [template, css] = await Promise.all([readFile('src/index.html', 'utf8'), readFile('src/style.css', 'utf8')]);
const js = result.outputFiles[0].text;
const html = template
  .replace('<style>/* INLINE_CSS */</style>', '<link rel="stylesheet" href="miniplan.css">')
  .replace('<script>/* INLINE_JS */</script>', '<script src="miniplan.js"></script>');
await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', html),
  writeFile('dist/miniplan.html', html),
  writeFile('dist/miniplan.css', css),
  writeFile('dist/miniplan.js', js),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.js', 'dist/miniplan.worker.js'),
]);
console.log('dist/index.html und dist/miniplan.html erstellt');
