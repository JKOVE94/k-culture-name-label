import { hangulToKatakana as k, hiraganaToHangul as h, convertPart } from './convert.mjs';
const ko = ['김','이','박','최','정','강','권','황','곽','민준','서연','지훈','하은','수빈','예준','철수','영희'];
console.log(ko.map(n => `${n}→${k(n)}`).join('  '));
const ja = ['たなか','さとう','たかはし','おおの','きょうこ','しょうた','ゆうき','けいこ','かっぺい','ちひろ'];
console.log(ja.map(n => `${n}→${h(n)}`).join('  '));
console.log('つ auto:', ['つき','つばさ','まつや','まつもと','なつき','てつや'].map(n => `${n}→${h(n)}`).join('  '));

// 표기 사전: 규칙과 다르게 굳어진 표기를 저장해 두면 규칙보다 먼저 적용
const overrides = [
  { kind: 'ja2ko', part: 'given',  source: 'なつき',   value: '나츠키' },
  { kind: 'ja2ko', part: 'family', source: 'まつもと', value: '마츠모토' },
  { kind: 'ko2ja', part: 'family', source: '이',       value: 'リ' },
];
for (const [kind, part, source] of [['ja2ko','given','なつき'],['ja2ko','given','つき'],['ja2ko','family','まつもと'],['ja2ko','family','まつや'],['ko2ja','family','이'],['ko2ja','given','이']]) {
  const r = convertPart({ kind, part, source, overrides });
  console.log(`${kind} ${part.padEnd(6)} ${source} → ${r.value} (${r.from === 'dictionary' ? '사전' : '규칙'})`);
}
