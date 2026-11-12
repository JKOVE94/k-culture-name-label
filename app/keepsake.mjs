// 방문자 개인 보관용 컬러 이름 카드 (1080×1350, 인스타 세로 비율)
const FONT_KO = '"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';
const FONT_JA = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';
const INK = '#3b2f3a', PINK = '#ff8fb1', PINK_D = '#f0628f', SUB = '#8a7b86';
const STRIPES = ['#ff6f91', '#ffc75f', '#7fd8c3', '#8ec5ff', '#c3a6ff'];
const TILE_BG = ['#fff4d1', '#e2f7f1', '#ffe3ec'];

const RC = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const RV = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const RF = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
const roman = ch => { const c = ch.charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return ''; return RC[Math.floor(c / 588)] + RV[Math.floor((c % 588) / 28)] + RF[c % 28]; };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fit(ctx, text, weight, family, max, min, width) {
  for (let s = max; s >= min; s -= 4) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= width) return s; }
  return min;
}

/** @param d { big, segs:[{text, rt}], bigLang, tilesText } */
export function renderKeepsake(canvas, { big, segs = [], bigLang = 'ko', tilesText = '' }) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경: 크림 + 분홍 물방울
  ctx.fillStyle = '#fff6ee'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd9e4';
  for (let y = 20; y < H; y += 44) for (let x = 20; x < W; x += 44) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  // 색동
  STRIPES.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * W / 5, 0, W / 5 + 1, 26); });

  // 떠다니는 자모
  ctx.globalAlpha = 0.18; ctx.font = `800 120px ${FONT_KO}`; ctx.textAlign = 'center';
  [['ㅎ', 110, 230, '#ff6f91'], ['한', 960, 330, '#8ec5ff'], ['글', 120, 1220, '#c3a6ff'], ['ㅇ', 960, 1190, '#ff6f91']]
    .forEach(([t, x, y, c]) => { ctx.fillStyle = c; ctx.fillText(t, x, y); });
  ctx.globalAlpha = 1;

  // 뱃지
  ctx.font = `800 34px ${FONT_JA}`;
  const badge = 'K-CULTURE 体験ブース', bw = ctx.measureText(badge).width + 90;
  ctx.fillStyle = INK; rr(ctx, (W - bw) / 2 + 6, 96, bw, 70, 35); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 5; rr(ctx, (W - bw) / 2, 90, bw, 70, 35); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc((W - bw) / 2 + 40, 125, 10, 0, 7); ctx.fill();
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(badge, W / 2 + 14, 127);

  // 스티커 카드
  const cx = 90, cy = 230, cw = W - 180, ch = 880;
  ctx.fillStyle = PINK; rr(ctx, cx + 18, cy + 18, cw, ch, 64); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, cx, cy, cw, ch, 64); ctx.fill();
  ctx.save(); rr(ctx, cx, cy, cw, ch, 64); ctx.clip();
  STRIPES.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx + i * cw / 5, cy, cw / 5 + 1, 22); });
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = INK; rr(ctx, cx, cy, cw, ch, 64); ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.font = `60px sans-serif`; ctx.fillText('🌸', cx + 80, cy + 120); ctx.fillText('💖', cx + cw - 80, cy + ch - 50);
  ctx.fillStyle = PINK_D; ctx.font = `800 44px ${FONT_KO}`; ctx.fillText('안녕하세요!', W / 2, cy + 140);

  // 큰 이름
  const fam = bigLang === 'ja' ? FONT_JA : FONT_KO;
  const size = fit(ctx, big, 800, fam, 150, 60, cw - 120);
  ctx.fillStyle = INK; ctx.font = `800 ${size}px ${fam}`; ctx.fillText(big, W / 2, cy + 300 + size * 0.35);

  // 원래 이름 + 후리가나
  const sy = cy + 520, ss = 58, rs = 30;
  ctx.font = `600 ${ss}px ${FONT_JA}`;
  const ws = segs.map(s => ctx.measureText(s.text).width);
  let x = W / 2 - ws.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  segs.forEach((s, i) => {
    ctx.fillStyle = INK; ctx.font = `600 ${ss}px ${FONT_JA}`; ctx.fillText(s.text, x, sy);
    if (s.rt) { ctx.fillStyle = SUB; ctx.font = `500 ${rs}px ${FONT_JA}`; ctx.textAlign = 'center'; ctx.fillText(s.rt, x + ws[i] / 2, sy - ss - 6); ctx.textAlign = 'left'; }
    x += ws[i];
  });
  ctx.textAlign = 'center';

  // 한글 블록 타일
  const chars = [...tilesText].filter(c => /[\uac00-\ud7a3]/.test(c)).slice(0, 8);
  const tw = 128, th = 150, gap = 18, total = chars.length * tw + (chars.length - 1) * gap;
  let tx = (W - total) / 2; const ty = cy + 610;
  chars.forEach((c, i) => {
    ctx.fillStyle = TILE_BG[i % 3]; rr(ctx, tx, ty, tw, th, 28); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; rr(ctx, tx, ty, tw, th, 28); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `800 70px ${FONT_KO}`; ctx.fillText(c, tx + tw / 2, ty + 88);
    ctx.fillStyle = SUB; ctx.font = `600 28px sans-serif`; ctx.fillText(roman(c), tx + tw / 2, ty + 130);
    tx += tw + gap;
  });

  // 아래 문구
  ctx.fillStyle = INK; ctx.font = `800 46px ${FONT_JA}`;
  ctx.fillText('ハングルで書くと、こうなるよ！', W / 2, 1210);
  ctx.fillStyle = SUB; ctx.font = `500 30px ${FONT_JA}`;
  const d = new Date();
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}  ·  出会えてうれしいです 💕`, W / 2, 1270);
  return canvas;
}

// iPhone: 공유 시트(写真に保存) → 안 되면 이미지를 띄워서 길게 눌러 저장
export async function saveCanvas(canvas, filename, showFallback) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const url = URL.createObjectURL(blob);
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { showFallback(url); return 'fallback'; }
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  return 'download';
}
