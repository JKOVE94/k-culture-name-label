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

// 사진형 포카의 사진 칸 (기준 좌표 360×576). 방문자 화면의 자르기 비율도 이 값을 쓴다 (10:9)
export const PHOTO_BOX = { x: 30, y: 84, w: 300, h: 270 };
export const PHOTO_ASPECT = PHOTO_BOX.w / PHOTO_BOX.h;
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
  const withPhoto = !!data.photo && size !== '50x30';
  (size === '50x30' ? drawCompact : withPhoto ? drawPhotoCard : drawPhotocard)(ctx, data);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  toMono(ctx, w, h);
  if (withPhoto) {
    // 사진 칸은 글자와 따로 처리한다 (글자는 선명한 흑백, 사진은 회색조 또는 디더링)
    const ox = (w - BW * s) / 2, oy = (h - BH * s) / 2;
    const bx = Math.round(ox + PHOTO_BOX.x * s), by = Math.round(oy + PHOTO_BOX.y * s);
    const bw = Math.round(PHOTO_BOX.w * s), bh = Math.round(PHOTO_BOX.h * s);
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

// ── 사진형 포카 (기준 360×576): 위 사진, 아래 이름 ──
function drawPhotoCard(ctx, d) {
  const { big, segs = [], bigLang = 'ko', no, date = new Date() } = d;
  const W = 360, H = 576, cx = W / 2, forJa = bigLang !== 'ja';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 4; roundRect(ctx, 6, 6, W - 12, H - 12, 26); ctx.stroke();
  ctx.save(); roundRect(ctx, 6, 6, W - 12, H - 12, 26); ctx.clip();
  const kinds = ['solid', 'diag', 'dots', 'vline', 'check'], bwid = (W - 12) / kinds.length;
  kinds.forEach((k, i) => { ctx.fillStyle = pattern(ctx, k); ctx.fillRect(6 + i * bwid, 6, bwid + 1, 18); });
  [...kinds].reverse().forEach((k, i) => { ctx.fillStyle = pattern(ctx, k); ctx.fillRect(6 + i * bwid, H - 24, bwid + 1, 18); });
  ctx.fillStyle = '#000'; ctx.fillRect(6, 24, W - 12, 3); ctx.fillRect(6, H - 27, W - 12, 3);
  ctx.restore();

  // 뱃지 (사진 위)
  ctx.font = `800 14px ${FONT_JA}`;
  const badge = 'K-CULTURE 体験ブース', bw = ctx.measureText(badge).width + 28;
  ctx.fillStyle = '#000'; roundRect(ctx, cx - bw / 2, 42, bw, 26, 13); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(badge, cx, 60);
  ctx.fillStyle = '#000'; flower(ctx, 34, 55, 8); flower(ctx, W - 34, 55, 8);
  // (사진 칸 PHOTO_BOX: y 84~354는 renderLabel에서 채운다)

  // 큰 이름 (y 372~428)
  const fam = bigLang === 'ja' ? FONT_JA : FONT_KO, maxW = W - 70;
  let size = fitFont(ctx, big, fam, 60, 26, maxW), twoLine = false;
  const cut = Math.max(big.lastIndexOf('・'), big.lastIndexOf(' '));
  if (size < 40 && cut > 0) {
    const l1 = big.slice(0, cut + (big[cut] === '・' ? 1 : 0)).trim(), l2 = big.slice(cut + 1).trim();
    size = Math.min(fitFont(ctx, l1, fam, 38, 24, maxW), fitFont(ctx, l2, fam, 38, 24, maxW));
    ctx.font = `800 ${size}px ${fam}`; ctx.fillText(l1, cx, 398); ctx.fillText(l2, cx, 398 + size * 1.08);
    twoLine = true;
  } else {
    ctx.font = `800 ${size}px ${fam}`; ctx.fillText(big, cx, 404 + size * 0.36);
  }

  // 원래 이름 + 후리가나 (y 470)
  const smallY = twoLine ? 480 : 474, smallSize = twoLine ? 20 : 22, rtSize = 14;
  ctx.font = `600 ${smallSize}px ${FONT_JA}`;
  const widths = segs.map(x => ctx.measureText(x.text).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  segs.forEach((sg, i) => {
    ctx.font = `600 ${smallSize}px ${FONT_JA}`; ctx.fillText(sg.text, x, smallY);
    if (sg.rt) { ctx.font = `500 ${rtSize}px ${FONT_JA}`; ctx.textAlign = 'center'; ctx.fillText(sg.rt, x + widths[i] / 2, smallY - smallSize - 2); ctx.textAlign = 'left'; }
    x += widths[i];
  });

  // 날짜 · 번호 · 하단 문구
  const dt = new Date(date);
  const ds = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
  ctx.fillRect(30, 492, W - 60, 1.5);
  ctx.font = `700 15px sans-serif`;
  ctx.textAlign = 'left'; ctx.fillText(ds, 30, 514);
  ctx.textAlign = 'right'; ctx.fillText(no ? `No. ${String(no).padStart(3, '0')}` : '', W - 30, 514);
  ctx.textAlign = 'center'; ctx.font = `700 14px ${forJa ? FONT_JA : FONT_KO}`;
  ctx.fillText(forJa ? '♥ 出会えてうれしいです！ ♥' : '♥ 만나서 반가워요! ♥', cx, 538);
}

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
