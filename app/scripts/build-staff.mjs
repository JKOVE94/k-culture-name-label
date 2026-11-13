// 스태프 화면을 "한 파일"로 묶는다: src/print.src.html + src/staff.mjs + vendor → print.html
// Bluefy(iPhone)에는 Service Worker가 없어서, 필요한 것을 전부 HTML 하나에 넣어야
// 한 번 연 뒤 인터넷 없이 동작하고 HTTP 캐시로 다시 열 가능성도 높아진다.
// 사용법: (app/에서) node scripts/build-staff.mjs   ※ esbuild 필요: npm i -D esbuild
import { build } from 'esbuild';
import fs from 'node:fs';

const kst = new Date(Date.now() + 9 * 3600e3).toISOString();   // 한국 시간 기준 빌드 시각
const version = kst.slice(0, 10).replace(/-/g, '') + '-' + kst.slice(11, 16).replace(':', '');
const out = await build({
  entryPoints: ['src/staff.mjs'], bundle: true, format: 'esm', minify: true, write: false,
  define: { __STAFF_VERSION__: JSON.stringify(version) }, target: ['safari15'],
});
const esc = s => s.replace(/<\/script/gi, '<\\/script');
const js = esc(out.outputFiles[0].text);
const vendor = ['vendor/jsQR.js', 'vendor/niimbluelib.min.js']
  .map(f => `<script>/* ${f} */\n${esc(fs.readFileSync(f, 'utf8'))}\n</script>`).join('\n');

let html = fs.readFileSync('src/print.src.html', 'utf8');
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="staff-version" content="${version}">`);
html = html.replace('<!--BUNDLE-->', `${vendor}\n<script type="module">\n${js}</script>`);
html = html.replace(/^<!doctype html>\n/i, m => `${m}<!-- 자동 생성 파일: src/print.src.html, src/staff.mjs 를 고친 뒤 node scripts/build-staff.mjs -->\n`);
fs.writeFileSync('print.html', html);
console.log(`print.html ${(html.length / 1024).toFixed(0)}KB, version ${version}`);
