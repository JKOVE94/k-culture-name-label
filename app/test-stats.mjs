// 통계 모듈 테스트: QR 조각 왕복, 파일 왕복, 중복 제거, 집계
import { toQrChunks, toFile, parseImport, merge, aggregate, toCsv } from './stats-core.mjs';
const G = ['m', 'f', 'unset'], A = ['child', '10s', '20s', '30s', '40s', '50s', '60p', 'unset'];
const mk = (dev, n, t0) => Array.from({ length: n }, (_, i) => ({
  id: `${dev}-${(i + 1).toString(36)}`, at: t0 + i * 61000, dev, dir: i % 4 ? 'ja2ko' : 'ko2ja', reprint: i % 10 === 9, gender: G[i % 3], age: A[i % 8],
}));
const t0 = Date.parse('2027-01-10T01:00:00Z');   // 일본 시간 10:00
const a = { devId: 'ab12', devName: '인쇄폰1:메인', events: mk('ab12', 230, t0) };
const b = { devId: 'cd34', devName: '인쇄폰2', events: mk('cd34', 120, t0 + 3600e3) };

const chunks = toQrChunks(a);
const back = chunks.flatMap(c => parseImport(c));
const evBack = back.flatMap(x => x.events);
const same = JSON.stringify(evBack.map(e => [e.id, Math.floor(e.at / 1000), e.dir, e.reprint, e.gender, e.age])) ===
             JSON.stringify(a.events.map(e => [e.id, Math.floor(e.at / 1000), e.dir, e.reprint, e.gender, e.age]));
console.log(`QR 조각 ${chunks.length}개 (최대 ${Math.max(...chunks.map(c => new TextEncoder().encode(c).length))}바이트), 왕복 ${same ? 'OK' : 'NG'}, 이름 "${back[0].devName}"`);

const store = { devices: {}, events: {} };
const n1 = merge(store, back), n2 = merge(store, parseImport(toFile(b))), n3 = merge(store, parseImport(toFile(a)));
console.log(`합치기: +${n1}, +${n2}, 같은 기록 다시 +${n3} → 총 ${Object.keys(store.events).length}건`);
const s = aggregate(Object.values(store.events), store.devices);
console.log('방문', s.total, '재인쇄', s.reprints, '시간대', JSON.stringify(s.byHour), '폰별', JSON.stringify(s.byDevice));
console.log('CSV 첫 줄들:\n' + toCsv(Object.values(store.events), store.devices).split('\n').slice(0, 3).join('\n'));
