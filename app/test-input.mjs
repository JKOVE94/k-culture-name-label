import fs from 'node:fs';
import { plan } from './input.mjs';
import { convertPart } from './convert.mjs';
const dict = JSON.parse(fs.readFileSync('/tmp/names.json', 'utf8'));

console.log('── 한국어 (불리고 싶은 이름) ──');
for (const s of ['김', '민준', '김민준', '김 민준', '남궁민수', '이서연']) {
  const p = plan(s, dict); console.log(`${s.padEnd(6)} → ${p.out}   [${p.parts.map(x => `${x.text}:${x.part}`).join(', ')}]`);
}
console.log('── 일본어 가나 (읽기 단계 생략) ──');
for (const s of ['タナカ', 'たなか', 'さくら', 'ユーキ', 'マツモト', 'ジェシカ', 'ウィリアム', 'ヴィヴィアン', 'シェリー', 'タナカ ショウ']) {
  console.log(`${s} → ${plan(s, dict).out}`);
}
console.log('── 일본어 한자 (읽기 후보) ──');
for (const s of ['田中', '翔', '田中 翔', '田中翔', '佐藤健太', '陽菜']) {
  const p = plan(s, dict);
  for (const part of p.parts) {
    const c = part.candidates.map(x => `${x.reading}(${x.how})`).join(', ');
    console.log(`${s} / ${part.text} → ${c || '후보 없음 → 직접 입력'}`);
  }
}
// 후보 선택 후 한글 변환 예시
console.log('선택 예: 田中翔 → たなか しょう →', 'たなか しょう'.split(' ').map(r => convertPart({ kind: 'ja2ko', part: 'any', source: r }).value).join(' '));
