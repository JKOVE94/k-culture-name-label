// Niimbot 라벨 렌더러 (흑백 1비트)
//   크기 50×80 (포토카드형, 기본) / 50×30 (작은 이름표)
//   B1 Pro: 300dpi, 인쇄 헤드 567px → 50×80 = 567×945px, 50×30 = 567×354px
//   B1    : 203dpi, 인쇄 헤드 384px → 50×80 = 384×640px, 50×30 = 384×240px
// 디자인은 크기별 기준 좌표로 그리고, 프린터 해상도에 맞게 통째로 확대한다 (글자는 벡터라 깨끗하게 커짐)
// 감열 프린터는 검정 한 가지 색만 찍을 수 있으므로, 화면의 파스텔 디자인을
// "검정 선·패턴" 디자인으로 다시 그린다. 이모지(컬러 글꼴)는 쓰지 않고 도형으로 그린다.
export const LABEL_W = 384, LABEL_H = 240;   // 디자인 기준 좌표
export const PRINTERS = {
  B1_PRO: { name: 'B1 Pro', dpi: 300, headPx: 567 },
  B1:     { name: 'B1',     dpi: 203, headPx: 384 },
};
export const LABEL_SIZES = {
  // 54mm 폭 롤도 인쇄 헤드 폭(약 48mm)만큼만 찍히므로 좌우에 약 3mm 흰 여백이 남는다
  '54x80': { name: '54×80 포토카드', mm: [54, 80], base: [360, 576] },
  '50x80': { name: '50×80 포토카드', mm: [50, 80], base: [360, 576] },
  '50x30': { name: '50×30 이름표', mm: [50, 30], base: [LABEL_W, LABEL_H] },
};
export const DEFAULT_SIZE = '54x80';

// ── 포토카드 템플릿 (한국 전통 모티프, 흑백 감열지용) ──
export const TEMPLATES = {
  saekdong: { ko: '색동', ja: 'セットン（虹色のしま）' },
  changsal: { ko: '한옥 창살', ja: '韓屋のまど' },
  idcard:   { ko: '한글 이름 증명서', ja: 'ハングル名前証' },
  bojagi:   { ko: '조각보', ja: 'ポジャギ（つぎはぎ布）' },
};
export const DEFAULT_TEMPLATE = 'saekdong';
// 사진 종류: 없음 / 인물(세로 10:11) / 풍경(가로 16:10). 템플릿마다 사진 칸 모양이 달라진다
export const PHOTO_KINDS = { portrait: { ja: '人物（たて）', aspect: 10 / 11 }, landscape: { ja: '風景（よこ）', aspect: 16 / 10 } };
export const photoAspect = kind => (PHOTO_KINDS[kind] ?? PHOTO_KINDS.portrait).aspect;
export const guessPhotoKind = img => (img.width / img.height >= 1.25 ? 'landscape' : 'portrait');
// (이전 버전 호환) 기본 사진 비율
export const PHOTO_ASPECT = PHOTO_KINDS.portrait.aspect;
/** 사진 표현: 'gray' = B1 Pro 회색조 인쇄, 'dither' = 흑백 점(오류 확산) */
export const PHOTO_MODES = { gray: '회색조', dither: '디더링' };
export function labelPixels({ dpi, headPx }, mm = [50, 30]) {
  return { w: Math.min(headPx, Math.round(mm[0] * dpi / 25.4)), h: Math.round(mm[1] * dpi / 25.4) };
}

const FONT_KO = '"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';
const FONT_JA = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';

function pattern(ctx, kind) {
  const c = document.createElement('canvas'); c.width = c.height = 6;
  const p = c.getContext('2d'); p.fillStyle = '#fff'; p.fillRect(0, 0, 6, 6); p.fillStyle = '#000';
  if (kind === 'solid') p.fillRect(0, 0, 6, 6);
  if (kind === 'diag') for (let i = -6; i < 12; i += 3) { p.beginPath(); p.moveTo(i, 6); p.lineTo(i + 6, 0); p.lineWidth = 1.2; p.strokeStyle = '#000'; p.stroke(); }
  if (kind === 'dots') { p.fillRect(1, 1, 2, 2); p.fillRect(4, 4, 2, 2); }
  if (kind === 'vline') { p.fillRect(0, 0, 2, 6); p.fillRect(3, 0, 1, 6); }
  if (kind === 'check') { p.fillRect(0, 0, 3, 3); p.fillRect(3, 3, 3, 3); }
  return ctx.createPattern(c, 'repeat');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function heart(ctx, x, y, s, fill = true) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  if (fill) ctx.fill(); else { ctx.lineWidth = 2; ctx.stroke(); }
}
function flower(ctx, x, y, r) {
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
}
function fitFont(ctx, text, family, max, min, width) {
  for (let s = max; s >= min; s -= 2) { ctx.font = `800 ${s}px ${family}`; if (ctx.measureText(text).width <= width) return s; }
  return min;
}

/**
 * @param {object} d
 *   big:   큰 줄 (예: "다나카 상" / "キムさん")
 *   segs:  작은 줄 조각 [{ text: '田中', rt: 'たなか' }, { text: 'さん' }]
 *   bigLang: 'ko' | 'ja'
 *   footer: 맨 아래 문구
 */
/**
 * data.photo: 사진(Image/ImageBitmap/Canvas). 있으면 사진형 포카로 그린다.
 * photoMode: 'gray'면 사진 부분만 16단계 회색으로 남긴다 → 인쇄 시 PageColorType.Grayscale 필요
 */
export function renderLabel(canvas, data, printer = PRINTERS.B1_PRO, size = DEFAULT_SIZE, photoMode = 'dither') {
  const spec = LABEL_SIZES[size] ?? LABEL_SIZES[DEFAULT_SIZE];
  const { w, h } = labelPixels(printer, spec.mm);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const [BW, BH] = spec.base;
  const s = Math.min(w / BW, h / BH);
  ctx.setTransform(s, 0, 0, s, (w - BW * s) / 2, (h - BH * s) / 2);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  let box = null;
  if (size === '50x30') drawCompact(ctx, data);
  else {
    const kind = data.photo ? (PHOTO_KINDS[data.photoKind] ? data.photoKind : guessPhotoKind(data.photo)) : 'none';
    const tpl = TEMPLATE_DRAW[data.tpl] ?? TEMPLATE_DRAW[DEFAULT_TEMPLATE];
    box = tpl(ctx, data, kind);   // 사진 칸(기준 좌표)을 돌려준다
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  toMono(ctx, w, h);
  if (box && data.photo) {
    // 사진 칸은 글자와 따로 처리한다 (글자는 선명한 흑백, 사진은 회색조 또는 디더링)
    const ox = (w - BW * s) / 2, oy = (h - BH * s) / 2;
    const bx = Math.round(ox + box.x * s), by = Math.round(oy + box.y * s);
    const bw = Math.round(box.w * s), bh = Math.round(box.h * s);
    drawPhotoRegion(ctx, data.photo, bx, by, bw, bh, photoMode);
    const lw = Math.max(3, Math.round(3 * s));
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - lw, by - lw, bw + lw * 2, lw); ctx.fillRect(bx - lw, by + bh, bw + lw * 2, lw);
    ctx.fillRect(bx - lw, by, lw, bh); ctx.fillRect(bx + bw, by, lw, bh);
  }
  return canvas;
}

// ── 사진 처리: 가운데 맞춰 채우기 → 밝기 범위 늘리기 → 회색 16단계 또는 Atkinson 디더링 ──
function drawPhotoRegion(ctx, photo, x, y, w, h, mode) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const pw = photo.width, ph = photo.height, k = Math.max(w / pw, h / ph);
  g.drawImage(photo, (w - pw * k) / 2, (h - ph * k) / 2, pw * k, ph * k);
  const img = g.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  // 감열지는 어두운 쪽이 뭉개지므로 2%~98% 구간을 0~255로 늘리고 살짝 밝게(감마 0.85)
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.floor(n * 0.98)] || 255;
  for (let i = 0; i < n; i++) lum[i] = 255 * Math.pow(Math.min(1, Math.max(0, (lum[i] - lo) / Math.max(1, hi - lo))), 0.85);
  if (mode === 'gray') {
    for (let i = 0; i < n; i++) lum[i] = Math.round(lum[i] / 17) * 17;   // 16단계
  } else {
    // Atkinson 디더링: 오차의 3/4만 퍼뜨려 감열지에서 덜 시커멓게 나온다
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx, old = lum[i], nv = old < 128 ? 0 : 255, err = (old - nv) / 8;
      lum[i] = nv;
      for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
        const X = xx + dx, Y = yy + dy;
        if (X >= 0 && X < w && Y < h) lum[Y * w + X] += err;
      }
    }
  }
  for (let i = 0; i < n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = lum[i]; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, x, y);
}

// ── 50×30 작은 이름표 (기준 384×240) ──
function drawCompact(ctx, { big, segs = [], bigLang = 'ko', footer = 'K-CULTURE 体験ブース' }) {

  // 바깥 테두리
  ctx.lineWidth = 3; roundRect(ctx, 4, 4, LABEL_W - 8, LABEL_H - 8, 18); ctx.stroke();
  ctx.save(); roundRect(ctx, 4, 4, LABEL_W - 8, LABEL_H - 8, 18); ctx.clip();

  // 흑백 색동 줄: 오색 대신 다섯 가지 무늬
  const kinds = ['solid', 'diag', 'dots', 'vline', 'check'];
  const bw = (LABEL_W - 8) / kinds.length;
  kinds.forEach((k, i) => { ctx.fillStyle = pattern(ctx, k); ctx.fillRect(4 + i * bw, 4, bw + 1, 14); });
  ctx.fillStyle = '#000'; ctx.fillRect(4, 18, LABEL_W - 8, 2);
  ctx.restore();

  // 장식: 꽃(왼쪽 위), 하트(오른쪽 아래)
  flower(ctx, 30, 44, 7);
  ctx.fillStyle = '#000'; heart(ctx, LABEL_W - 32, LABEL_H - 50, 16, true);
  heart(ctx, LABEL_W - 50, LABEL_H - 38, 9, false);

  // 인사말
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
  ctx.font = `700 15px ${FONT_KO}`; ctx.fillText('♡ 안녕하세요! ♡', LABEL_W / 2, 44);

  // 큰 이름 (자동 크기)
  // 이름 영역(y 54~152)의 세로 가운데에 둔다. 너무 길면(글자 44px 미만) ・나 공백에서 두 줄로 나눈다.
  const fam = bigLang === 'ja' ? FONT_JA : FONT_KO;
  const maxW = LABEL_W - 84, mid = 103;
  let size = fitFont(ctx, big, fam, 72, 26, maxW);
  const cut = Math.max(big.lastIndexOf('・'), big.lastIndexOf(' '));
  if (size < 44 && cut > 0) {
    const l1 = big.slice(0, cut + (big[cut] === '・' ? 1 : 0)).trim(), l2 = big.slice(cut + 1).trim();
    size = Math.min(fitFont(ctx, l1, fam, 50, 24, maxW), fitFont(ctx, l2, fam, 50, 24, maxW));
    ctx.font = `800 ${size}px ${fam}`;
    ctx.fillText(l1, LABEL_W / 2, mid - 4);
    ctx.fillText(l2, LABEL_W / 2, mid - 4 + size * 1.05);
  } else {
    ctx.font = `800 ${size}px ${fam}`;
    ctx.fillText(big, LABEL_W / 2, mid + size * 0.36);
  }

  // 작은 줄 + 후리가나
  const smallY = 182, smallSize = 20, rtSize = 12;
  ctx.font = `600 ${smallSize}px ${FONT_JA}`;
  const widths = segs.map(s => ctx.measureText(s.text).width);
  let x = LABEL_W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  segs.forEach((s, i) => {
    ctx.font = `600 ${smallSize}px ${FONT_JA}`; ctx.fillText(s.text, x, smallY);
    if (s.rt) {
      ctx.font = `500 ${rtSize}px ${FONT_JA}`; ctx.textAlign = 'center';
      ctx.fillText(s.rt, x + widths[i] / 2, smallY - smallSize - 1);
      ctx.textAlign = 'left';
    }
    x += widths[i];
  });

  // 아래 문구
  ctx.textAlign = 'center'; ctx.font = `700 12px ${FONT_JA}`;
  const fw = ctx.measureText(footer).width;
  ctx.fillRect(LABEL_W / 2 - fw / 2 - 22, 210, 14, 1.5); ctx.fillRect(LABEL_W / 2 + fw / 2 + 8, 210, 14, 1.5);
  ctx.fillText(footer, LABEL_W / 2, 214);
}

// ── 50×80 포토카드 (기준 360×576) ──
// 카드 크기(54×86) 슬리브·케이스에 넣어 보관하는 것을 전제로 한 세로 디자인
const RC = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const RV = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const RF = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
const roman = ch => { const c = ch.charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return ''; return RC[Math.floor(c / 588)] + RV[Math.floor((c % 588) / 28)] + RF[c % 28]; };
const HON_KO = { san: '상', kun: '군', chan: '짱' };

// 한글 글자 블록에 쓸 이름: 일본 이름이면 큰 줄에서 호칭을 뗀 한글, 한국 이름이면 원래 한글
export function hangulName({ big, segs = [], bigLang = 'ko', hon }) {
  if (bigLang === 'ja') return segs.map(s => s.text).join('').replace(/[^\uac00-\ud7a3]/g, '');
  let name = big;
  const suf = HON_KO[hon];
  if (suf && name.endsWith(' ' + suf)) name = name.slice(0, -(suf.length + 1));
  return name.replace(/[^\uac00-\ud7a3]/g, '');
}

// ── 템플릿 공통 부품 (기준 360×576) ──
const W0 = 360, H0 = 576, CX = W0 / 2;
const fmtDate = date => { const t = new Date(date ?? Date.now()); return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`; };
const fmtNo = no => (no ? `No. ${String(no).padStart(3, '0')}` : '');
const txt = (d) => {
  const forJa = d.bigLang !== 'ja';   // 일본인 방문자(일→한)면 true
  return {
    forJa,
    greet: forJa ? '♡ 안녕하세요! ♡' : '♡ はじめまして！ ♡',
    msg: forJa ? '出会えてうれしいです！' : '만나서 반가워요!',
    foot: forJa ? 'ハングルで書くと、こうなるよ！' : '일본어로 쓰면 이렇게 돼요!',
    msgFont: forJa ? FONT_JA : FONT_KO,
  };
};
function drawName(ctx, d, y, maxW, maxSize, min = 26) {   // y = 이름 블록 세로 가운데, 반환 = 블록 아래 끝
  const big = d.big, fam = d.bigLang === 'ja' ? FONT_JA : FONT_KO;
  ctx.textAlign = 'center'; ctx.fillStyle = '#000';
  let size = fitFont(ctx, big, fam, maxSize, min, maxW);
  const cut = Math.max(big.lastIndexOf('・'), big.lastIndexOf(' '));
  if (size < maxSize * 0.66 && cut > 0) {
    const l1 = big.slice(0, cut + (big[cut] === '・' ? 1 : 0)).trim(), l2 = big.slice(cut + 1).trim();
    size = Math.min(fitFont(ctx, l1, fam, maxSize * 0.72, min, maxW), fitFont(ctx, l2, fam, maxSize * 0.72, min, maxW));
    ctx.font = `800 ${size}px ${fam}`;
    ctx.fillText(l1, CX, y + size * 0.32); ctx.fillText(l2, CX, y + size * 1.4);
    return y + size * 1.65;
  }
  ctx.font = `800 ${size}px ${fam}`; ctx.fillText(big, CX, y + size * 0.36);
  return y + size * 0.6;
}
// 이름 블록 아래 끝(ny)에서 후리가나가 겹치지 않는 원래 이름 기준선
const segsY = (ny, size, segs) => ny + (segs.some(x => x.rt) ? size * 1.62 + 8 : size + 10);
// 이름이 두 줄로 나뉘는지 미리 알기 (사진 칸 높이를 줄이는 데 쓴다)
function willWrap(ctx, d, maxW, maxSize, min = 26) {
  const fam = d.bigLang === 'ja' ? FONT_JA : FONT_KO;
  const cut = Math.max(d.big.lastIndexOf('・'), d.big.lastIndexOf(' '));
  return fitFont(ctx, d.big, fam, maxSize, min, maxW) < maxSize * 0.66 && cut > 0;
}
function drawSegs(ctx, segs, y, size = 22, cx = CX) {   // 원래 이름 + 후리가나 (y = 글자 기준선)
  ctx.font = `600 ${size}px ${FONT_JA}`;
  const widths = segs.map(x => ctx.measureText(x.text).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left'; ctx.fillStyle = '#000';
  segs.forEach((sg, i) => {
    ctx.font = `600 ${size}px ${FONT_JA}`; ctx.fillText(sg.text, x, y);
    if (sg.rt) { ctx.font = `500 ${Math.round(size * 0.6)}px ${FONT_JA}`; ctx.textAlign = 'center'; ctx.fillText(sg.rt, x + widths[i] / 2, y - size - 2); ctx.textAlign = 'left'; }
    x += widths[i];
  });
  ctx.textAlign = 'center';
}
function drawTiles(ctx, d, y, h = 78, maxW = 300, cx = CX) {   // 한글 글자 블록 (일본인 카드만)
  const chars = d.bigLang !== 'ja' ? [...hangulName(d)].slice(0, 6) : [];
  if (!chars.length) return y;
  const gap = 8, tw = Math.min(h * 0.8, (maxW - gap * (chars.length - 1)) / chars.length);
  let tx = cx - (chars.length * tw + (chars.length - 1) * gap) / 2;
  for (const ch of chars) {
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
    roundRect(ctx, tx, y, tw, h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.min(tw * 0.62, h * 0.5))}px ${FONT_KO}`; ctx.fillText(ch, tx + tw / 2, y + h * 0.56);
    ctx.font = `600 ${Math.round(h * 0.17)}px sans-serif`; ctx.fillText(roman(ch), tx + tw / 2, y + h * 0.86);
    tx += tw + gap;
  }
  return y + h;
}
function drawDateNo(ctx, d, y, x0 = 30, x1 = W0 - 30) {
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y - 22, x1 - x0, 1.5);
  ctx.font = `700 15px sans-serif`;
  ctx.textAlign = 'left'; ctx.fillText(fmtDate(d.date), x0, y);
  ctx.textAlign = 'right'; ctx.fillText(fmtNo(d.no), x1, y);
  ctx.textAlign = 'center';
}
function drawMsg(ctx, d, y, size = 18, hearts = true) {
  const t = txt(d);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${t.msgFont}`;
  ctx.fillText(t.msg, CX, y);
  if (hearts) { const mw = ctx.measureText(t.msg).width / 2; heart(ctx, CX - mw - 16, y - size * 0.8, size * 0.7, true); heart(ctx, CX + mw + 16, y - size * 0.8, size * 0.7, true); }
}
function badge(ctx, y, text = 'K-CULTURE 体験ブース', size = 15) {
  ctx.font = `800 ${size}px ${FONT_JA}`;
  const bw = ctx.measureText(text).width + size * 2;
  ctx.fillStyle = '#000'; roundRect(ctx, CX - bw / 2, y, bw, size * 1.9, size * 0.95); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, CX, y + size * 1.32);
  ctx.fillStyle = '#000';
}
// 사진 칸 크기 맞추기: 정해진 영역 안에서 사진 비율대로 가운데 배치
function fitBox(kind, x, y, w, h) {
  const a = photoAspect(kind);
  let bw = w, bh = w / a;
  if (bh > h) { bh = h; bw = h * a; }
  return { x: Math.round(x + (w - bw) / 2), y: Math.round(y + (h - bh) / 2), w: Math.round(bw), h: Math.round(bh) };
}

// ── 1. 색동: 오색 줄을 다섯 가지 흑백 무늬로 ──
// 한복 소매처럼 가로 줄을 여러 겹 쌓는다 (색 대신 무늬 농도로 오색을 표현)
function saekdongFrame(ctx, band = 22) {
  ctx.lineWidth = 4; roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 26); ctx.stroke();
  ctx.save(); roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 26); ctx.clip();
  const kinds = ['solid', 'diag', 'dots', 'check', 'solid'], sh = band / kinds.length;
  kinds.forEach((k, i) => {
    ctx.fillStyle = k === 'solid' ? '#000' : pattern(ctx, k);
    ctx.fillRect(6, 6 + i * sh, W0 - 12, sh - 1.2);
    ctx.fillRect(6, H0 - 6 - band + i * sh + 1.2, W0 - 12, sh - 1.2);
  });
  ctx.fillStyle = '#000'; ctx.fillRect(6, 6 + band, W0 - 12, 2.5); ctx.fillRect(6, H0 - 8.5 - band, W0 - 12, 2.5);
  ctx.restore();
}
function tplSaekdong(ctx, d, kind) {
  const t = txt(d);
  if (kind === 'none') { drawPhotocard(ctx, d); return null; }   // 이름 중심 기본형
  saekdongFrame(ctx, 22);
  badge(ctx, 40, 'K-CULTURE 体験ブース', 14);
  ctx.fillStyle = '#000'; flower(ctx, 34, 53, 8); flower(ctx, W0 - 34, 53, 8);
  const wrap = willWrap(ctx, d, W0 - 70, kind === 'portrait' ? 56 : 58) ? 44 : 0;
  if (kind === 'portrait') {
    const box = fitBox(kind, 30, 80, 300, 276 - wrap);
    const ny = drawName(ctx, d, box.y + box.h + 36, W0 - 70, 56);
    drawSegs(ctx, d.segs, Math.max(segsY(ny, 21, d.segs), 466), 21);
    drawDateNo(ctx, d, 508); drawMsg(ctx, d, 532, 15);
    return box;
  }
  const box = fitBox(kind, 22, 80, 316, 196 - wrap);   // 풍경: 넓은 사진 + 글자 블록까지
  const ny = drawName(ctx, d, box.y + box.h + 36, W0 - 70, 58);
  drawSegs(ctx, d.segs, segsY(ny, 20, d.segs), 20);
  drawTiles(ctx, d, segsY(ny, 20, d.segs) + 12, 60, 290);
  drawDateNo(ctx, d, 512); drawMsg(ctx, d, 536, 15);
  return box;
}

// ── 2. 한옥 창살: 테두리 전체가 문살 무늬, 사진은 창문처럼 ──
function latticeBand(ctx, x, y, w, h, t) {
  // 바깥 띠(두께 t)에 띠살·교살 느낌의 격자를 그린다
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.rect(x + t, y + t, w - 2 * t, h - 2 * t); ctx.clip('evenodd');
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  const step = t / 2;
  for (let gx = x; gx <= x + w; gx += step) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy <= y + h; gy += step) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
  // 칸마다 작은 마름모 (亞자살 느낌)
  ctx.fillStyle = '#000';
  for (let gx = x + step / 2; gx < x + w; gx += step) for (let gy = y + step / 2; gy < y + h; gy += step) {
    ctx.beginPath(); ctx.moveTo(gx, gy - 2.5); ctx.lineTo(gx + 2.5, gy); ctx.lineTo(gx, gy + 2.5); ctx.lineTo(gx - 2.5, gy); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h); ctx.lineWidth = 2.5; ctx.strokeRect(x + t, y + t, w - 2 * t, h - 2 * t);
}
function windowCorners(ctx, b, off = 7, len = 18) {   // 사진 둘레 ㄱ자 문틀 모서리
  ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  const L = b.x - off, T = b.y - off, R = b.x + b.w + off, B = b.y + b.h + off;
  for (const [x, y, dx, dy] of [[L, T, 1, 1], [R, T, -1, 1], [L, B, 1, -1], [R, B, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + dx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * len); ctx.stroke();
  }
}
function plaque(ctx, y, text = 'K-CULTURE 体験ブース') {   // 현판 모양 이름판
  ctx.font = `800 15px ${FONT_JA}`;
  const w = ctx.measureText(text).width + 34, x = CX - w / 2;
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, 28);
  ctx.fillRect(x - 8, y + 4, 8, 20); ctx.fillRect(x + w, y + 4, 8, 20);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, CX, y + 20); ctx.fillStyle = '#000';
}
function tplChangsal(ctx, d, kind) {
  const t = txt(d);
  latticeBand(ctx, 6, 6, W0 - 12, H0 - 12, 22);
  plaque(ctx, 40);
  if (kind === 'none') {
    // 둥근 창(원창) 안에 이름의 첫 글자
    const r = 92, cy = 172;
    ctx.save(); ctx.beginPath(); ctx.arc(CX, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.lineWidth = 2;
    for (let i = -r; i <= r; i += 16) { ctx.beginPath(); ctx.moveTo(CX + i, cy - r); ctx.lineTo(CX + i, cy + r); ctx.stroke(); ctx.beginPath(); ctx.moveTo(CX - r, cy + i); ctx.lineTo(CX + r, cy + i); ctx.stroke(); }
    ctx.restore();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(CX, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(CX, cy, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.stroke();
    const first = [...hangulName(d)][0] ?? '한';
    ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.font = `800 70px ${FONT_KO}`; ctx.fillText(first, CX, cy + 22);
    ctx.font = `600 14px sans-serif`; ctx.fillText(roman(first), CX, cy + 44);
    const ny = drawName(ctx, d, 318, W0 - 76, 60);
    drawSegs(ctx, d.segs, Math.max(segsY(ny, 21, d.segs), 392), 21);
    drawMsg(ctx, d, 452, 17);
    drawDateNo(ctx, d, 500, 40, W0 - 40);
    ctx.font = `600 13px ${t.forJa ? FONT_JA : FONT_KO}`; ctx.fillText(t.foot, CX, 526);
    return null;
  }
  const wrap = willWrap(ctx, d, W0 - 76, kind === 'portrait' ? 52 : 58) ? 46 : 0;
  const box = kind === 'portrait' ? fitBox(kind, 48, 92, 264, 262 - wrap) : fitBox(kind, 44, 94, 272, 172 - wrap * 0.6);
  windowCorners(ctx, box);
  const ny = drawName(ctx, d, box.y + box.h + 44, W0 - 76, kind === 'portrait' ? 52 : 58);
  drawSegs(ctx, d.segs, segsY(ny, 20, d.segs), 20);
  if (kind === 'landscape') drawTiles(ctx, d, segsY(ny, 20, d.segs) + 12, 56, 270);
  drawDateNo(ctx, d, 500, 40, W0 - 40);
  ctx.font = `600 13px ${t.forJa ? FONT_JA : FONT_KO}`; ctx.fillText(t.foot, CX, 526);
  return box;
}

// ── 3. 한글 이름 증명서: 신분증 형식 + 도장 ──
function seal(ctx, x, y, r, rot = -0.2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(r * 0.36)}px ${FONT_KO}`; ctx.fillText('한글이름', 0, -r * 0.08);
  ctx.fillText('발급완료', 0, r * 0.38);
  heart(ctx, 0, -r * 0.72, r * 0.2, true);
  ctx.restore();
}
function fields(ctx, d, x, y, w, rowH = 30) {
  const forJa = d.bigLang !== 'ja';
  const orig = d.segs.map(sg => sg.text).join('') + (d.segs.some(sg => sg.rt) ? `（${d.segs.filter(sg => sg.rt).map(sg => sg.rt).join(' ')}）` : '');
  const rows = [
    [forJa ? '이름 / なまえ' : '이름 / 名前', d.big, d.bigLang === 'ja' ? FONT_JA : FONT_KO, 800],
    [forJa ? '원래 이름' : '원래 이름', orig, FONT_JA, 600],
    ['발급일', fmtDate(d.date), 'sans-serif', 700],
    ['No.', d.no ? String(d.no).padStart(3, '0') : '-', 'sans-serif', 700],
  ];
  const lw = 86;
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#000';
  rows.forEach(([label, value, font, weight], i) => {
    const ry = y + i * rowH;
    ctx.beginPath(); ctx.moveTo(x, ry + rowH); ctx.lineTo(x + w, ry + rowH); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#000';
    ctx.font = `700 12px ${FONT_KO}`; ctx.fillText(label, x + 2, ry + rowH * 0.62);
    const maxW = w - lw - 4;
    let size = 18; ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(value).width > maxW && size > 8) { size--; ctx.font = `${weight} ${size}px ${font}`; }
    ctx.fillText(value, x + lw, ry + rowH * 0.66);
  });
  ctx.textAlign = 'center';
  return y + rows.length * rowH;
}
function mrz(ctx, d, y) {   // 여권 아래 기계판독줄 흉내
  ctx.fillStyle = '#000'; ctx.fillRect(20, y - 22, W0 - 40, 2); ctx.fillRect(20, y - 18, W0 - 40, 1);
  ctx.font = `700 12px monospace`; ctx.textAlign = 'center';
  ctx.fillText(`<<HANGUL<<NAME<<CARD<<${d.no ? String(d.no).padStart(3, '0') : '000'}<<K-CULTURE<<`, CX, y);
}
function tplIdcard(ctx, d, kind) {
  ctx.lineWidth = 4; roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 20); ctx.stroke();
  ctx.save(); roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 20); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(6, 6, W0 - 12, 56);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `800 22px ${FONT_KO}`; ctx.fillText('한글 이름 증명서', CX, 34);
  ctx.font = `700 11px sans-serif`; ctx.fillText('HANGUL NAME CARD · K-CULTURE 体験ブース', CX, 52);
  ctx.fillStyle = '#000';
  let box = null, y;
  if (kind === 'portrait') {
    box = fitBox(kind, 20, 74, 128, 141);
    y = fields(ctx, d, 158, 76, 182, 34) + 10;
    const ny = drawName(ctx, d, Math.max(y, box.y + box.h) + 40, W0 - 60, 54);
    drawTiles(ctx, d, ny + 16, 72, 200, 128);
    seal(ctx, 290, Math.max(ny + 52, 450), 40);
  } else if (kind === 'landscape') {
    box = fitBox(kind, 20, 72, 320, 176);
    y = fields(ctx, d, 24, box.y + box.h + 8, 312, 30);
    drawTiles(ctx, d, y + 14, 64, 196, 124);
    seal(ctx, 290, y + 48, 38);
  } else {
    const ny = drawName(ctx, d, 112, W0 - 60, 64);
    y = fields(ctx, d, 24, Math.max(172, ny + 14), 312, 34);
    const ty = drawTiles(ctx, d, y + 18, 78, 260);
    if (ty === y + 18) { seal(ctx, CX, y + 96, 54, -0.12); }   // 글자 블록이 없는 한국인 카드: 도장을 크게 가운데
    else seal(ctx, 290, 462, 40);
    ctx.font = `600 13px ${txt(d).forJa ? FONT_JA : FONT_KO}`; ctx.textAlign = 'left'; ctx.fillText(txt(d).foot, 26, ty === y + 18 ? 500 : 470); ctx.textAlign = 'center';
  }
  mrz(ctx, d, 546);
  return box;
}

// ── 4. 조각보: 테두리를 무늬 천 조각으로 이어 붙인 느낌 ──
function bojagiFrame(ctx, t = 26) {
  const kinds = ['diag', 'dots', 'check', 'vline', 'solid', 'dots', 'diag', 'check'];
  let k = 0;
  const patch = (x, y, w, h) => {
    const kind = kinds[k++ % kinds.length];
    ctx.fillStyle = kind === 'solid' ? '#000' : pattern(ctx, kind); ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.strokeRect(x, y, w, h);
  };
  ctx.save(); roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 14); ctx.clip();
  // 위·아래
  for (const yy of [6, H0 - 6 - t]) { let x = 6; for (const w of [62, 94, 48, 78, 66]) { patch(x, yy, Math.min(w, W0 - 6 - x), t); x += w; } }
  // 좌·우
  for (const xx of [6, W0 - 6 - t]) { let y = 6 + t; for (const h of [110, 70, 130, 90, 124]) { const hh = Math.min(h, H0 - 6 - t - y); if (hh > 0) patch(xx, y, t, hh); y += h; } }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#000'; roundRect(ctx, 6, 6, W0 - 12, H0 - 12, 14); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeRect(6 + t + 4, 6 + t + 4, W0 - 2 * (6 + t + 4), H0 - 2 * (6 + t + 4));   // 바느질 선 느낌의 안쪽 선
  ctx.setLineDash([4, 4]); ctx.strokeRect(6 + t + 9, 6 + t + 9, W0 - 2 * (6 + t + 9), H0 - 2 * (6 + t + 9)); ctx.setLineDash([]);
}
function knot(ctx, x, y, s = 1) {   // 매듭(동심결) 작은 장식
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#000';
  for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 5 * s, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y + 10 * s); ctx.lineTo(x - 5 * s, y + 26 * s); ctx.moveTo(x, y + 10 * s); ctx.lineTo(x, y + 28 * s); ctx.moveTo(x + 3 * s, y + 10 * s); ctx.lineTo(x + 5 * s, y + 26 * s); ctx.stroke();
}
function tplBojagi(ctx, d, kind) {
  const t = txt(d);
  bojagiFrame(ctx);
  // 천에 박음질한 이름표 느낌의 태그 (색동·배지와 구별)
  ctx.font = `800 15px ${FONT_JA}`;
  const tag = 'K-CULTURE 体験ブース', tw = ctx.measureText(tag).width + 30;
  ctx.fillStyle = '#fff'; ctx.fillRect(CX - tw / 2, 46, tw, 30);
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.strokeRect(CX - tw / 2, 46, tw, 30);
  ctx.setLineDash([3, 3]); ctx.strokeRect(CX - tw / 2 + 4, 50, tw - 8, 22); ctx.setLineDash([]);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.fillText(tag, CX, 67);
  knot(ctx, 58, 56, 0.85); knot(ctx, W0 - 58, 56, 0.85);
  if (kind === 'none') {
    ctx.font = `700 19px ${t.forJa ? FONT_KO : FONT_JA}`; ctx.textAlign = 'center'; ctx.fillText(t.greet, CX, 130);
    const ny = drawName(ctx, d, 196, W0 - 96, 70);
    drawSegs(ctx, d.segs, Math.max(segsY(ny, 22, d.segs), 288), 22);
    drawTiles(ctx, d, 312, 76, 250);
    drawMsg(ctx, d, 442, 17);
    drawDateNo(ctx, d, 496, 48, W0 - 48);
    ctx.font = `600 12px ${t.forJa ? FONT_JA : FONT_KO}`; ctx.fillText(t.foot, CX, 518);
    return null;
  }
  const wrap = willWrap(ctx, d, W0 - 96, kind === 'portrait' ? 48 : 54) ? 44 : 0;
  const box = kind === 'portrait' ? fitBox(kind, 58, 98, 244, 254 - wrap) : fitBox(kind, 58, 100, 244, 156 - wrap * 0.5);
  // 사진은 바느질 선으로 덧댄 조각처럼
  ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16); ctx.setLineDash([]);
  const ny = drawName(ctx, d, box.y + box.h + 42, W0 - 96, kind === 'portrait' ? 48 : 54);
  drawSegs(ctx, d.segs, segsY(ny, 19, d.segs), 19);
  if (kind === 'landscape') drawTiles(ctx, d, segsY(ny, 19, d.segs) + 12, 56, 240);
  drawDateNo(ctx, d, 496, 48, W0 - 48);
  ctx.font = `600 12px ${t.forJa ? FONT_JA : FONT_KO}`; ctx.fillText(t.foot, CX, 518);
  return box;
}

const TEMPLATE_DRAW = { saekdong: tplSaekdong, changsal: tplChangsal, idcard: tplIdcard, bojagi: tplBojagi };

function drawPhotocard(ctx, d) {
  const { big, segs = [], bigLang = 'ko', no, date = new Date() } = d;
  // 일본인(일본 이름 → 한글) / 한국인(한국 이름 → 가타카나)에 따라 문구를 바꾼다
  const forJa = bigLang !== 'ja';
  const greeting = forJa ? '♡ 안녕하세요! ♡' : '♡ はじめまして！ ♡';
  const message = d.message ?? (forJa ? '出会えてうれしいです！' : '만나서 반가워요!');
  const footer = forJa ? 'ハングルで書くと、こうなるよ！' : '일본어로 쓰면 이렇게 돼요!';
  const W = 360, H = 576, cx = W / 2;
  ctx.textBaseline = 'alphabetic';

  // 테두리 + 위·아래 흑백 색동 띠
  ctx.lineWidth = 4; roundRect(ctx, 6, 6, W - 12, H - 12, 26); ctx.stroke();
  ctx.save(); roundRect(ctx, 6, 6, W - 12, H - 12, 26); ctx.clip();
  const kinds = ['solid', 'diag', 'dots', 'vline', 'check'], bw = (W - 12) / kinds.length;
  kinds.forEach((k, i) => { ctx.fillStyle = pattern(ctx, k); ctx.fillRect(6 + i * bw, 6, bw + 1, 22); });
  [...kinds].reverse().forEach((k, i) => { ctx.fillStyle = pattern(ctx, k); ctx.fillRect(6 + i * bw, H - 28, bw + 1, 22); });
  ctx.fillStyle = '#000'; ctx.fillRect(6, 28, W - 12, 3); ctx.fillRect(6, H - 31, W - 12, 3);
  ctx.restore();

  // 뱃지: K-CULTURE 体験ブース (검정 알약 + 흰 글씨)
  ctx.font = `800 16px ${FONT_JA}`;
  const badge = 'K-CULTURE 体験ブース', bwid = ctx.measureText(badge).width + 34;
  ctx.fillStyle = '#000'; roundRect(ctx, cx - bwid / 2, 46, bwid, 30, 15); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(badge, cx, 67);

  // 장식
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  flower(ctx, 34, 62, 9); flower(ctx, W - 34, 62, 9);

  // 인사말
  ctx.fillStyle = '#000'; ctx.font = `700 20px ${forJa ? FONT_KO : FONT_JA}`; ctx.fillText(greeting, cx, 112);

  // 큰 이름 (영역 y 128~232, 길면 두 줄)
  const fam = bigLang === 'ja' ? FONT_JA : FONT_KO;
  const maxW = W - 84, mid = forJa ? 184 : 228;
  let size = fitFont(ctx, big, fam, 78, 30, maxW);
  const cut = Math.max(big.lastIndexOf('・'), big.lastIndexOf(' '));
  if (size < 52 && cut > 0) {
    const l1 = big.slice(0, cut + (big[cut] === '・' ? 1 : 0)).trim(), l2 = big.slice(cut + 1).trim();
    size = Math.min(fitFont(ctx, l1, fam, 60, 28, maxW), fitFont(ctx, l2, fam, 60, 28, maxW));
    ctx.font = `800 ${size}px ${fam}`;
    ctx.fillText(l1, cx, mid - 6); ctx.fillText(l2, cx, mid - 6 + size * 1.05);
  } else {
    ctx.font = `800 ${size}px ${fam}`; ctx.fillText(big, cx, mid + size * 0.36);
  }

  // 원래 이름 + 후리가나 (y 280)
  const smallY = forJa ? 292 : 360, smallSize = 26, rtSize = 16;
  ctx.font = `600 ${smallSize}px ${FONT_JA}`;
  const widths = segs.map(s => ctx.measureText(s.text).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  segs.forEach((s, i) => {
    ctx.font = `600 ${smallSize}px ${FONT_JA}`; ctx.fillText(s.text, x, smallY);
    if (s.rt) { ctx.font = `500 ${rtSize}px ${FONT_JA}`; ctx.textAlign = 'center'; ctx.fillText(s.rt, x + widths[i] / 2, smallY - smallSize - 2); ctx.textAlign = 'left'; }
    x += widths[i];
  });
  ctx.textAlign = 'center';

  // 한글 글자 블록 (y 308~388): 한 글자씩 + 로마자 발음
  const chars = forJa ? [...hangulName(d)].slice(0, 6) : [];   // 한국인 카드는 글자 블록 대신 이름을 크게
  if (chars.length) {
    const tw = chars.length > 4 ? 48 : 62, th = 78, gap = 8;
    const total = chars.length * tw + (chars.length - 1) * gap;
    let tx = cx - total / 2;
    for (const ch of chars) {
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
      roundRect(ctx, tx, 318, tw, th, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = `800 ${tw > 50 ? 38 : 32}px ${FONT_KO}`; ctx.fillText(ch, tx + tw / 2, 362);
      ctx.font = `600 13px sans-serif`; ctx.fillText(roman(ch), tx + tw / 2, 384);
      tx += tw + gap;
    }
  }

  // 메시지 (y 430) + 장식 하트
  ctx.font = `700 21px ${forJa ? FONT_JA : FONT_KO}`; ctx.fillText(message, cx, 452);
  const mw = ctx.measureText(message).width / 2;
  heart(ctx, cx - mw - 20, 436, 14, true); heart(ctx, cx + mw + 20, 436, 14, true);

  // 아래: 날짜 · 번호 (포토카드 느낌)
  const dt = new Date(date);
  const ds = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
  ctx.font = `700 16px sans-serif`;
  ctx.fillRect(30, 478, W - 60, 1.5);
  ctx.textAlign = 'left'; ctx.fillText(ds, 30, 502);
  ctx.textAlign = 'right'; ctx.fillText(no ? `No. ${String(no).padStart(3, '0')}` : '', W - 30, 502);
  ctx.textAlign = 'center'; ctx.font = `700 15px ${forJa ? FONT_JA : FONT_KO}`;
  ctx.fillText(footer, cx, 528);
}

// 1비트화: 감열 헤드는 점을 찍거나 안 찍거나 둘 중 하나
export function toMono(ctx, w, h, threshold = 150) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
