// 사진 QR 조각 왕복 테스트: 4.2KB 이미지 → QR 여러 장 → jsQR로 읽기 → 다시 합치기
import vm from 'node:vm';
import fs from 'node:fs';
import qrcode from './vendor/qrcode.mjs';
import { photoChunks, PhotoCollector } from './photo-qr.mjs';
import { encodePayload, decodePayload } from './payload.mjs';
const sandbox = { self: {} }; vm.runInNewContext(fs.readFileSync(new URL('./vendor/jsQR.js', import.meta.url), 'utf8'), sandbox);
const jsQR = sandbox.self.jsQR ?? sandbox.jsQR;
qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));

const raw = Buffer.alloc(4200); for (let i = 0; i < raw.length; i++) raw[i] = (i * 73 + 11) % 256;
const b64 = raw.toString('base64');
const chunks = photoChunks('p8a1c2', b64);
const col = new PhotoCollector();
let maxModules = 0;
for (const text of [...chunks].reverse()) {           // 순서가 뒤섞여 읽혀도 되는지
  const qr = qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount(); maxModules = Math.max(maxModules, n);
  const cell = 4, q = 4, size = (n + q * 2) * cell, px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = (((r + q) * cell + y) * size + (c + q) * cell + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  const code = jsQR(px, size, size);
  col.add(new TextDecoder().decode(new Uint8Array(code.binaryData)));
}
const st = col.status('p8a1c2');
const ok = Buffer.from(col.base64('p8a1c2'), 'base64').equals(raw);
console.log(`사진 ${raw.length}바이트 → QR ${chunks.length}장 (최대 ${maxModules}×${maxModules}), 수집 ${st.got}/${st.total}, 복원 ${ok ? 'OK' : 'NG'}`);
const name = decodePayload(encodePayload({ big: '다나카 상', segs: [{ text: '田中', rt: 'たなか' }], bigLang: 'ko', hon: 'san', photo: { id: 'p8a1c2', n: chunks.length } }));
console.log('이름 QR의 사진 정보:', JSON.stringify(name.photo));
