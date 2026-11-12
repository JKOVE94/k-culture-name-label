// 읽기 후보 정렬: "한자 한 글자씩의 정규 읽기(KANJIDIC2)로 설명되는 읽기"를 위로 올린다
// JMnedict에는 빈도 정보가 없어서, 田中=ぬなか 같은 희귀 읽기가 섞여 나오는 문제를 줄이기 위함
const DAKU = { か:'が',き:'ぎ',く:'ぐ',け:'げ',こ:'ご',さ:'ざ',し:'じ',す:'ず',せ:'ぜ',そ:'ぞ',た:'だ',ち:'ぢ',つ:'づ',て:'で',と:'ど',は:'ば',ひ:'び',ふ:'ぶ',へ:'べ',ほ:'ぼ' };
const HANDAKU = { は:'ぱ',ひ:'ぴ',ふ:'ぷ',へ:'ぺ',ほ:'ぽ' };

function variants(kanji, ch, notFirst) {
  const k = kanji[ch]; if (!k) return [];
  const base = [...k.kun.map(r => [r, 3]), ...k.nan.map(r => [r, 3]), ...k.on.map(r => [r, 2])];
  const out = [];
  for (const [r, w] of base) {
    if (!r) continue;
    out.push([r, w]);
    if (notFirst && DAKU[r[0]]) out.push([DAKU[r[0]] + r.slice(1), w - 0.5]);   // 연탁: 中島 なかじま
    if (notFirst && HANDAKU[r[0]]) out.push([HANDAKU[r[0]] + r.slice(1), w - 0.5]);
    if (/[つくちき]$/.test(r) && r.length > 1) out.push([r.slice(0, -1) + 'っ', w - 0.5]); // 촉음: 服部 はっとり
  }
  return out;
}

// 한자열을 읽기로 나눠 설명할 수 있으면 글자당 평균 점수(2~3), 못 하면 0
export function segScore(token, reading, kanji) {
  const cs = [...token].map((c, i, a) => (c === '々' ? a[i - 1] : c));
  const memo = new Map();
  const go = (i, j) => {
    if (i === cs.length) return j === reading.length ? 0 : -Infinity;
    const key = i * 100 + j; if (memo.has(key)) return memo.get(key);
    let best = -Infinity;
    for (const [r, w] of variants(kanji, cs[i], i > 0))
      if (reading.startsWith(r, j)) best = Math.max(best, w + go(i + 1, j + r.length));
    memo.set(key, best); return best;
  };
  const s = go(0, 0);
  return s === -Infinity ? 0 : s / cs.length;
}

// candidates: [{reading, how}] → 점수순 정렬
export function rank(token, candidates, kanji, { imeHint = '', common = {} } = {}) {
  return candidates
    .map(c => {
      let score = segScore(token, c.reading.replace(/ /g, ''), kanji);
      if (c.how === '표기 사전') score += 100;
      if (imeHint && c.reading.replace(/ /g, '').startsWith(imeHint)) score += 10;
      score += common[`${token}:${c.reading}`] ?? 0;
      return { ...c, score: +score.toFixed(2) };
    })
    .sort((a, b) => b.score - a.score);
}
