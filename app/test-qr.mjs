// QR 왕복 테스트: 방문자 화면에서 만든 QR → 스태프 화면의 jsQR로 읽어 같은 데이터가 나오는지
import { createRequire } from 'node:module';
import qrcode from './vendor/qrcode.mjs';
import { encodePayload, decodePayload } from './payload.mjs';
const jsQR = createRequire(import.meta.url)('./vendor/jsQR.js');
qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));

const tickets = [
  { big: '다나카 상', segs: [{ text: '田中', rt: 'たなか' }, { text: 'さん' }], bigLang: 'ko', hon: 'san' },
  { big: '하루토 군', segs: [{ text: '大翔', rt: 'はると' }, { text: 'くん' }], bigLang: 'ko', hon: 'kun' },
  { big: 'キム・ミンジュンさん', segs: [{ text: '김민준' }], bigLang: 'ja', hon: 'san' },
];
for (const t of tickets) {
  const text = encodePayload(t);
  const qr = qrcode(0, 'M'); qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount(), cell = 6, q = 4, size = (n + q * 2) * cell;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = (((r + q) * cell + y) * size + (c + q) * cell + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0;
    }
  const code = jsQR(px, size, size);
  const back = decodePayload(new TextDecoder().decode(new Uint8Array(code.binaryData)));
  const ok = back.big === t.big && JSON.stringify(back.segs.map(s => [s.text, s.rt ?? null])) === JSON.stringify(t.segs.map(s => [s.text, s.rt ?? null]));
  console.log(`${ok ? 'OK ' : 'NG '} ${t.big}  (${new TextEncoder().encode(text).length}바이트, QR ${n}×${n})`);
}
