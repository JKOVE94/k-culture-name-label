import fs from 'node:fs';
import { createReader } from './reading.mjs';
const kanji = JSON.parse(fs.readFileSync('dict/kanji.json', 'utf8'));
const loadShard = async ch => {
  const p = `dict/shard/${ch.codePointAt(0).toString(16)}.json`;
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { s: {}, g: {} };
};
const read = createReader({ loadShard, kanji });
const cases = [
  ['田中', 'たな', '', '끝 글자 누락된 힌트'],
  ['田中', '', '', '힌트 없음 (붙여넣기 등)'],
  ['桜', 'さく', '', '끝 글자 누락'],
  ['佐藤', 'さと', '', '끝 글자 누락'],
  ['吉田', 'よしだ', '', '힌트로 순서 보정'],
  ['小林', 'こば', '', '힌트로 순서 보정'],
  ['大翔', 'はると', '', '요즘 이름'],
  ['大翔', 'だいしょう', '', '다른 읽기로 쳐서 만든 경우'],
  ['田中翔', 'たなかしょう', 'たなか しょう', '성·이름 따로 변환'],
];
for (const [run, hint, disp, note] of cases) {
  const c = await read(run, hint, disp || hint);
  console.log(`${run} 힌트="${hint}" (${note}) → 1위 ${c[0]?.reading}   | 칩: ${c.slice(1, 5).map(x => x.reading).join(', ')}`);
}
