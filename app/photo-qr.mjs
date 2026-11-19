// 사진을 QR 여러 장으로 나눠 보내기 (서버·인터넷 없이 방문자 폰 → 스태프 폰)
//   방문자 화면: 이름 QR + 사진 QR 조각들을 번갈아 띄운다 (약 0.35초 간격)
//   스태프 화면: 카메라로 계속 읽으며 조각을 모으고, 다 모이면 라벨을 만든다
// 조각 형식: NLP1:{사진ID}:{번호}/{전체}:{base64 조각}
export const PHOTO_PREFIX = 'NLP1:';
export const PHOTO_TARGET_BYTES = 3600;   // JPEG 목표 크기 (QR 약 9장)
export const CHUNK_CHARS = 560;

// 잘라 둔 사진(canvas) → 작은 회색 JPEG(base64). 인쇄는 회색이라 색 정보는 보내지 않는다
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

export function photoChunks(id, b64, size = CHUNK_CHARS) {
  const n = Math.ceil(b64.length / size);
  return Array.from({ length: n }, (_, i) => `${PHOTO_PREFIX}${id}:${i + 1}/${n}:${b64.slice(i * size, (i + 1) * size)}`);
}

// 스태프 화면용: 조각 모으기
export class PhotoCollector {
  constructor() { this.parts = new Map(); }
  add(text) {
    const m = text.match(/^NLP1:([^:]+):(\d+)\/(\d+):([A-Za-z0-9+/=]*)$/);
    if (!m) return null;
    const [, id, i, n, data] = m;
    const p = this.parts.get(id) ?? { total: +n, got: new Map() };
    p.got.set(+i, data); this.parts.set(id, p);
    return this.status(id);
  }
  status(id) {
    const p = this.parts.get(id);
    if (!p) return { id, got: 0, total: 0, done: false };
    return { id, got: p.got.size, total: p.total, done: p.got.size === p.total };
  }
  base64(id) {
    const p = this.parts.get(id);
    if (!p || p.got.size !== p.total) return null;
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
