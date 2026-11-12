// "불리고 싶은 이름" 한 칸 입력 처리 프로토타입
// - 성만 / 이름만 / 성+이름(띄어쓰기 유무 무관) / 한자·히라가나·가타카나 혼용 모두 받는다
import { convertPart } from './convert.mjs';

const isHangul = c => c >= '\uac00' && c <= '\ud7a3';
const isHira = c => c >= '\u3041' && c <= '\u309f';
const isKata = c => (c >= '\u30a1' && c <= '\u30ff') || c === 'ー';
const isKanji = c => (c >= '\u4e00' && c <= '\u9fff') || (c >= '\u3400' && c <= '\u4dbf') || c === '々';

export function detectScript(str) {
  const cs = [...str.replace(/\s/g, '')];
  if (cs.length && cs.every(isHangul)) return 'hangul';
  if (cs.length && cs.every(c => isHira(c) || isKata(c))) return 'kana';
  if (cs.some(isKanji)) return 'kanji';
  return 'other';
}
const toHira = s => s.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const tokenize = s => s.trim().split(/[\s\u3000・·]+/).filter(Boolean);

// ── 한국어: 띄어쓰기 없이 "김민준"처럼 쓰면 흔한 성씨로 자동 분리 ──
const SURNAME1 = new Set([...'김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부']);
const SURNAME2 = new Set(['남궁', '제갈', '선우', '황보', '독고', '사공', '서문']);
export function splitKorean(token) {
  const cs = [...token];
  if (cs.length === 4 && SURNAME2.has(cs.slice(0, 2).join(''))) return [{ text: cs.slice(0, 2).join(''), part: 'family' }, { text: cs.slice(2).join(''), part: 'given' }];
  if (cs.length === 3 && SURNAME1.has(cs[0])) return [{ text: cs[0], part: 'family' }, { text: cs.slice(1).join(''), part: 'given' }];
  return [{ text: token, part: 'any' }]; // 2글자는 "민준"(이름만)인지 "김준"(성+이름)인지 알 수 없으므로 한 덩어리
}

// ── 일본어 한자: 성 사전·이름 사전을 모두 찾고, 붙여 쓴 성+이름은 경계를 찾아 나눈다 ──
export function readingCandidates(token, dict, { overrides = [], limit = 6 } = {}) {
  const out = [];
  const push = (reading, part, how) => { if (!out.some(o => o.reading === reading)) out.push({ reading, part, how }); };
  for (const o of overrides) if (o.kind === 'ja_reading' && o.source === token) push(o.value, o.part, '표기 사전');
  for (const r of dict.s[token] ?? []) push(r, 'family', '성 사전');
  for (const r of dict.g[token] ?? []) push(r, 'given', '이름 사전');
  const cs = [...token];
  if (!out.length && cs.length >= 2) {
    for (let i = 1; i < cs.length; i++) {
      const a = cs.slice(0, i).join(''), b = cs.slice(i).join('');
      if (dict.s[a] && dict.g[b])
        for (const ra of dict.s[a].slice(0, 2)) for (const rb of dict.g[b].slice(0, 2))
          push(`${ra} ${rb}`, 'full', `${a}|${b} 분리`);
    }
  }
  return out.slice(0, limit);
}

// ── 한 칸 입력 → 변환 계획 ──
export function plan(input, dict, opts = {}) {
  const script = detectScript(input);
  const tokens = tokenize(input);
  if (script === 'hangul') {
    const parts = tokens.flatMap(splitKorean);
    const out = parts.map(p => convertPart({ kind: 'ko2ja', part: p.part, source: p.text, overrides: opts.overrides }).value);
    return { script, dir: 'ko2ja', parts, needsReading: false, out: out.join('・') };
  }
  if (script === 'kana') {
    const parts = tokens.map(t => ({ text: t, reading: toHira(t) }));
    const out = parts.map(p => convertPart({ kind: 'ja2ko', part: 'any', source: p.reading, overrides: opts.overrides }).value);
    return { script, dir: 'ja2ko', parts, needsReading: false, out: out.join(' ') };
  }
  if (script === 'kanji') {
    const parts = tokens.map(t => ({ text: t, candidates: readingCandidates(t, dict, opts) }));
    return { script, dir: 'ja2ko', parts, needsReading: true };
  }
  return { script, needsReading: false, out: null, note: '한글·한자·가나 외 문자 → 직접 입력 안내' };
}
