// Niimbot 라벨 렌더러 (50×30mm, 흑백 1비트)
//   B1 Pro: 300dpi, 인쇄 헤드 567px → 567×354px (기본)
//   B1    : 203dpi, 인쇄 헤드 384px → 384×240px
// 디자인은 384×240 좌표로 그리고, 프린터 해상도에 맞게 통째로 확대한다 (글자는 벡터라 깨끗하게 커짐)
// 감열 프린터는 검정 한 가지 색만 찍을 수 있으므로, 화면의 파스텔 디자인을
// "검정 선·패턴" 디자인으로 다시 그린다. 이모지(컬러 글꼴)는 쓰지 않고 도형으로 그린다.
export const LABEL_W = 384, LABEL_H = 240;   // 디자인 기준 좌표
export const PRINTERS = {
  B1_PRO: { name: 'B1 Pro', dpi: 300, headPx: 567 },
  B1:     { name: 'B1',     dpi: 203, headPx: 384 },
};
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
export function renderLabel(canvas, { big, segs = [], bigLang = 'ko', footer = 'K-CULTURE 体験ブース' }, printer = PRINTERS.B1_PRO) {
  const { w, h } = labelPixels(printer);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / LABEL_W, h / LABEL_H);
  ctx.setTransform(s, 0, 0, s, (w - LABEL_W * s) / 2, (h - LABEL_H * s) / 2);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';

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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  toMono(ctx, w, h);
  return canvas;
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
