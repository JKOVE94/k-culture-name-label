// 사진을 QR 여러 장으로 나눠 보내기 (서버·인터넷 없이 방문자 폰 → 스태프 폰)
//   방문자 화면: 이름 QR + 사진 QR 조각들을 번갈아 띄운다
//   스태프 화면: 카메라로 계속 읽으며 조각을 모으고, 다 모이면 라벨을 만든다
//
// v2 (NLP2, 바이너리 + 분수 부호):
//   - 사진 JPEG 바이트를 base64 없이 QR 바이트 모드에 그대로 담는다 (같은 QR 크기에 33% 더)
//   - 원본 조각 k개를 먼저 보내고, 그 뒤로는 조각 여러 개를 XOR한 "복구 조각"을 끝없이 만든다.
//     스태프 폰은 "어느 조각이든" k개 남짓만 읽으면 사진을 복원한다 → 놓친 한 장을 한 바퀴 기다릴 필요가 없다.
//   프레임 = 'NLP2'(4) + 사진ID(3) + k(1) + 번호(2) + 전체 길이(2) + 조각(BLOCK)
// v1 (NLP1:{id}:{i}/{n}:{base64}) 은 예전 화면과의 호환용으로 읽기만 한다.
export const PHOTO_PREFIX = 'NLP1:';
export const PHOTO_TARGET_BYTES = 3000;   // JPEG 목표 크기 (QR 원본 조각 약 8장)
export const CHUNK_CHARS = 560;           // v1
export const BLOCK = 400;                 // v2 조각 바이트 (헤더 포함 412바이트 → QR 버전 13·L, 69×69: 예전 81×81보다 성겨서 화면→카메라로 잘 읽힌다)
const MAGIC = [0x4e, 0x4c, 0x50, 0x32];   // 'NLP2'
const HEAD = 12;

// 잘라 둔 사진(canvas) → 작은 회색 JPEG. 인쇄는 회색이라 색 정보는 보내지 않는다
export async function encodePhoto(src, { width = 200, height = 180, target = PHOTO_TARGET_BYTES } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const g = c.getContext('2d');
  g.filter = 'grayscale(1)';
  g.drawImage(src, 0, 0, width, height);
  if (g.filter !== 'grayscale(1)') {   // filter 미지원 브라우저: 직접 회색으로
    const img = g.getImageData(0, 0, width, height), d = img.data;
    for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    g.putImageData(img, 0, 0);
  }
  let b64 = '';
  for (const q of [0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22]) {
    b64 = c.toDataURL('image/jpeg', q).split(',')[1];
    if (b64.length * 0.75 <= target) break;
  }
  return b64;
}
export const b64ToBytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
const bytesToB64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };

export function photoChunks(id, b64, size = CHUNK_CHARS) {   // v1
  const n = Math.ceil(b64.length / size);
  return Array.from({ length: n }, (_, i) => `${PHOTO_PREFIX}${id}:${i + 1}/${n}:${b64.slice(i * size, (i + 1) * size)}`);
}

// ── v2 분수 부호 ──
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 번호 seq 프레임이 어떤 원본 조각들의 XOR인지 (비트마스크). seq < k 는 원본 그대로
export function frameMask(seq, k, idNum) {
  if (seq < k) return 1 << seq;
  const rnd = mulberry32((idNum * 2654435761) ^ (seq * 40503));
  let m = 0;
  while (!m || (m & (m - 1)) === 0) {   // 2개 이상 섞인 조각
    m = 0; for (let i = 0; i < k; i++) if (rnd() < 0.5) m |= 1 << i;
    if (k === 1) return 1;
  }
  return m;
}
export const newPhotoId = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');

// 사진 바이트 → frame(seq) 함수 (seq 0..65535 아무 번호나 만들 수 있다)
export function photoFountain(idHex, bytes, block = BLOCK) {
  const k = Math.max(1, Math.ceil(bytes.length / block));
  if (k > 30) throw new Error('사진이 너무 커요');
  const idB = [0, 2, 4].map(i => parseInt(idHex.slice(i, i + 2), 16)), idNum = parseInt(idHex, 16);
  const blocks = Array.from({ length: k }, (_, i) => { const b = new Uint8Array(block); b.set(bytes.subarray(i * block, (i + 1) * block)); return b; });
  const frame = seq => {
    const out = new Uint8Array(HEAD + block), m = frameMask(seq, k, idNum);
    out.set(MAGIC); out.set(idB, 4); out[7] = k; out[8] = seq >> 8; out[9] = seq & 255; out[10] = bytes.length >> 8; out[11] = bytes.length & 255;
    const body = out.subarray(HEAD);
    for (let i = 0; i < k; i++) if (m & (1 << i)) for (let j = 0; j < block; j++) body[j] ^= blocks[i][j];
    return out;
  };
  return { k, frame };
}
export const isPhotoFrame = bytes => bytes.length > HEAD && MAGIC.every((v, i) => bytes[i] === v);

// 스태프 화면용: 조각 모으기 (v2 바이너리 + v1 텍스트)
export class PhotoCollector {
  constructor() { this.parts = new Map(); }
  // v2: GF(2) 소거법으로 조각을 모은다. 이미 아는 조합이면 버린다
  addFrame(bytes) {
    if (!isPhotoFrame(bytes)) return null;
    const id = [...bytes.subarray(4, 7)].map(b => b.toString(16).padStart(2, '0')).join('');
    const k = bytes[7], seq = (bytes[8] << 8) | bytes[9], len = (bytes[10] << 8) | bytes[11];
    let p = this.parts.get(id);
    if (!p) { p = { v: 2, k, len, total: k, rows: [] }; this.parts.set(id, p); }
    if (p.done) return this.status(id);
    let mask = frameMask(seq, k, parseInt(id, 16)), data = bytes.slice(HEAD);
    for (const r of p.rows) if (mask & r.pivot) { mask ^= r.mask; xorInto(data, r.data); }
    if (!mask) return this.status(id);   // 새 정보 없음
    const pivot = mask & -mask;
    for (const r of p.rows) if (r.mask & pivot) { r.mask ^= mask; xorInto(r.data, data); }
    p.rows.push({ mask, pivot, data });
    if (p.rows.length === k) {
      const out = new Uint8Array(k * data.length);
      for (const r of p.rows) out.set(r.data, Math.log2(r.pivot) * data.length);
      p.bytes = out.subarray(0, len); p.done = true;
    }
    return this.status(id);
  }
  add(text) {   // v1
    const m = text.match(/^NLP1:([^:]+):(\d+)\/(\d+):([A-Za-z0-9+/=]*)$/);
    if (!m) return null;
    const [, id, i, n, data] = m;
    const p = this.parts.get(id) ?? { v: 1, total: +n, got: new Map() };
    p.got.set(+i, data); this.parts.set(id, p);
    return this.status(id);
  }
  status(id) {
    const p = this.parts.get(id);
    if (!p) return { id, got: 0, total: 0, done: false };
    if (p.v === 2) return { id, got: p.rows.length, total: p.k, done: !!p.done };
    return { id, got: p.got.size, total: p.total, done: p.got.size === p.total };
  }
  base64(id) {
    const p = this.parts.get(id);
    if (!p) return null;
    if (p.v === 2) return p.done ? bytesToB64(p.bytes) : null;
    if (p.got.size !== p.total) return null;
    return Array.from({ length: p.total }, (_, k) => p.got.get(k + 1)).join('');
  }
  async image(id) {
    const b64 = this.base64(id);
    if (!b64) return null;
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    return img;
  }
  forget(id) { this.parts.delete(id); }
}
function xorInto(a, b) { for (let j = 0; j < a.length; j++) a[j] ^= b[j]; }
