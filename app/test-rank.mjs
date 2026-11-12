import fs from 'node:fs';
import { rank } from './rank.mjs';
const dict = JSON.parse(fs.readFileSync('/tmp/names.json', 'utf8'));
const kanji = JSON.parse(fs.readFileSync('/tmp/kanji.json', 'utf8'));
const all = t => [...new Set([...(dict.s[t] ?? []), ...(dict.g[t] ?? [])])].map(reading => ({ reading, how: '사전' }));

const names = ['田中','佐藤','鈴木','高橋','渡辺','伊藤','山本','中村','小林','加藤','吉田','山田','佐々木','服部','中島','東','翔','陽菜','健太','大翔','結衣','蓮','美咲','さくら'];
for (const n of names) {
  const r = rank(n, all(n), kanji);
  const top = r.slice(0, 4).map(x => `${x.reading}(${x.score})`).join(' ');
  console.log(`${n.padEnd(4, '　')} 후보 ${String(r.length).padStart(2)}개 → ${top}`);
}
console.log('\n키보드 힌트 "かけ" 입력 시 翔 →', rank('翔', all('翔'), kanji, { imeHint: 'かけ' }).slice(0, 3).map(x => x.reading).join(', '));
