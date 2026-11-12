import { labelLines, HONORIFICS } from './honorific.mjs';
const cases = [
  { dir: 'ja2ko', src: ['田中'], read: ['たなか'], out: ['다나카'] },
  { dir: 'ja2ko', src: ['さくら'], read: [], out: ['사쿠라'] },
  { dir: 'ko2ja', src: ['김'], out: ['キム'] },
  { dir: 'ko2ja', src: ['민준'], out: ['ミンジュン'] },
];
for (const c of cases)
  for (const h of HONORIFICS) {
    const l = labelLines({ ...c, h: h.id });
    console.log(`${c.src.join(' ')} [${h.labelJa}] → ${l.big}  /  ${l.small}`);
  }
