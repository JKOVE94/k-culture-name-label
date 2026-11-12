// 한자 덩어리의 읽기 결정: "키보드에서 잡은 히라가나"는 힌트로만 쓰고,
// 실제 후보는 이름 사전에서 가져와 힌트와 앞부분이 맞는 것을 위로 올린다.
//   たな(잡힌 힌트, 끝 글자 누락) + 田中 → 사전의 たなか 가 1위
//   だいしょう(다른 읽기로 쳐서 만든 경우) + 大翔 → だいしょう 1위, はると 등은 칩으로 제안
import { rank } from './rank.mjs';

export function createReader({ loadShard, kanji }) {
  // hintDisplay: 성과 이름을 따로 변환한 경우 'たなか しょう'처럼 띄어 쓴 힌트
  return async function candidatesFor(run, hint = '', hintDisplay = hint) {
    const cs = [...run];
    const out = [];
    const add = (reading, how) => { if (reading && !out.some(o => o.reading === reading)) out.push({ reading, how }); };

    const first = await loadShard(cs[0]);
    for (const r of first.s[run] ?? []) add(r, '성');
    for (const r of first.g[run] ?? []) add(r, '이름');

    // 붙여 쓴 성+이름 (田中翔 → 田中|翔). 통째로 사전에 있는 2글자(田中)를 田|中으로 쪼개지 않도록
    // 3글자 이상이거나 통째 후보가 없을 때만 나눈다
    if (cs.length >= 3 || (cs.length === 2 && !out.length)) {
      for (let i = 1; i < cs.length; i++) {
        const a = cs.slice(0, i).join(''), b = cs.slice(i).join('');
        if (!first.s[a]) continue;
        const sb = await loadShard(cs[i]);
        if (!sb.g[b]) continue;
        const ra = rank(a, first.s[a].map(r => ({ reading: r })), kanji).slice(0, 3);
        const rb = rank(b, sb.g[b].map(r => ({ reading: r })), kanji).slice(0, 3);
        for (const x of ra) for (const y of rb) add(`${x.reading} ${y.reading}`, '성+이름');
      }
    }
    // 키보드에서 잡은 읽기 자체도 후보 (사전에 없는 이름 대비)
    if (hint && !out.some(o => o.reading.replace(/ /g, '').startsWith(hint))) add(hintDisplay, '키보드');

    return rank(run, out, kanji, { imeHint: hint });
  };
}
