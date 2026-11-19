// v2 사진 QR(바이너리 + 분수 부호) 테스트
//  1) QR로 그렸다가 jsQR로 바이트를 그대로 읽는지
//  2) 프레임을 무작위로 놓쳐도(읽기 성공률 p) 몇 장 만에 복원되는지 — v1(정해진 조각 순환)과 비교
import vm from 'node:vm';
import fs from 'node:fs';
import qrcode from './vendor/qrcode.mjs';
import { photoFountain, PhotoCollector, isPhotoFrame } from './photo-qr.mjs';
const sandbox = { self: {} }; vm.runInNewContext(fs.readFileSync(new URL('./vendor/jsQR.js', import.meta.url), 'utf8'), sandbox);
const jsQR = sandbox.self.jsQR ?? sandbox.jsQR;
globalThis.btoa ??= s => Buffer.from(s, 'binary').toString('base64');

const raw = new Uint8Array(+(process.argv[2] || 3400)); for (let i = 0; i < raw.length; i++) raw[i] = (i * 73 + 11) % 256;
const { k, frame } = photoFountain('a1b2c3', raw);

// 1) QR 왕복 (바이트 모드에 바이너리 그대로)
const col = new PhotoCollector();
let modules = 0;
let used = 0;
for (const seq of [...Array(30).keys()].map(i => (i % 2 ? i : k + i))) {   // 원본 절반은 놓치고 복구 조각으로
  used++;
  const bytes = frame(seq);
  const save = qrcode.stringToBytes; qrcode.stringToBytes = () => Array.from(bytes);
  const qr = qrcode(0, 'L'); qr.addData('_'.repeat(bytes.length), 'Byte'); qr.make();
  qrcode.stringToBytes = save;
  const n = qr.getModuleCount(); modules = n;
  const cell = 4, q = 4, size = (n + q * 2) * cell, px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = (((r + q) * cell + y) * size + (c + q) * cell + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  const code = jsQR(px, size, size, { inversionAttempts: 'dontInvert' });
  const got = new Uint8Array(code.binaryData);
  if (!isPhotoFrame(got)) throw new Error('magic');
  col.addFrame(got);
  if (col.status('a1b2c3').done) break;
}
const ok = Buffer.from(col.base64('a1b2c3'), 'base64').equals(Buffer.from(raw));
console.log(`QR 왕복: ${raw.length}바이트 → 원본 조각 ${k}장, QR ${modules}×${modules}, ${used}장 읽고 복원 ${ok ? 'OK' : 'NG'}`);
if (!ok) process.exit(1);

// 2) 놓침 시뮬레이션: 화면에 뜬 프레임 수 (평균, 1000회)
function simV2(p, nameEvery = 6) {
  const c = new PhotoCollector(); let shown = 0, seq = 0, name = false;
  while (!(name && c.status('a1b2c3').done)) {
    shown++;
    const isName = shown % nameEvery === 1;
    if (Math.random() < p) { if (isName) name = true; else c.addFrame(frame(seq)); }
    if (!isName) seq++;
  }
  return shown;
}
function simV1(p, n = 10) {   // 예전: 조각 10장 + 이름 4장 순환, 정해진 조각을 다 모아야 함
  const cycle = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? ['N', i] : [i])).flat();
  const got = new Set(); let shown = 0;
  while (got.size < n + 1) { const f = cycle[shown % cycle.length]; shown++; if (Math.random() < p) got.add(f); }
  return shown;
}
const avg = (f, ...a) => { let s = 0; for (let i = 0; i < 1000; i++) s += f(...a); return s / 1000; };
for (const p of [0.8, 0.5, 0.3]) {
  const v1 = avg(simV1, p), v2 = avg(simV2, p);
  console.log(`읽기 성공률 ${p * 100}%: 예전 ${v1.toFixed(1)}장 ≈ ${(v1 * 0.35).toFixed(1)}초 → 새 방식 ${v2.toFixed(1)}장 ≈ ${(v2 * 0.25).toFixed(1)}초`);
}
