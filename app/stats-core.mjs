// 인쇄 기록(통계) 공통 모듈: 스태프 화면과 통계 화면이 함께 쓴다
// 기록 1건 = { id, at, dev, dir, reprint, gender, age }   ※ 방문자 이름은 없다
//   id      기기ID-일련번호 (여러 번 합쳐도 중복되지 않게)
//   at      인쇄 시각 (ms)
//   dev     인쇄 폰 ID (4자리)
//   dir     'ja2ko'(일본 이름→한글) | 'ko2ja'(한국 이름→가타카나)
//   gender  'm' | 'f' | 'unset'      age  'child' | '10s' … '60p' | 'unset'

export const GENDER = [['m', '남'], ['f', '여'], ['unset', '미입력']];
export const AGE = [['child', '어린이'], ['10s', '10대'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60p', '60대+'], ['unset', '미입력']];
const AGE_CODE = Object.fromEntries(AGE.map(([k], i) => [k, i.toString(36)]));
const AGE_FROM = Object.fromEntries(AGE.map(([k], i) => [i.toString(36), k]));
const G_CODE = { m: 'm', f: 'f', unset: '-' }, G_FROM = { m: 'm', f: 'f', '-': 'unset' };

// ── 내보내기 1: 파일(JSON) ──
export function toFile({ devId, devName, events }) {
  return JSON.stringify({ format: 'nl-stats-v1', devId, devName, exportedAt: new Date().toISOString(), events }, null, 1);
}

// ── 내보내기 2: QR 조각 ──
// NLS1:{기기ID}:{기기이름}:{조각}/{전체}:{행;행;…}   행 = 일련번호,시각(초,36진),방향,재인쇄,성별,연령
export function toQrChunks({ devId, devName, events }, maxLen = 480) {
  const rows = events.map(e => [
    e.id.split('-').pop(), Math.floor(e.at / 1000).toString(36),
    e.dir === 'ko2ja' ? 1 : 0, e.reprint ? 1 : 0, G_CODE[e.gender] ?? '-', AGE_CODE[e.age] ?? AGE_CODE.unset,
  ].join(','));
  const groups = [];
  let cur = [];
  for (const r of rows) {
    if (cur.length && (cur.join(';').length + r.length + 1) > maxLen) { groups.push(cur); cur = []; }
    cur.push(r);
  }
  if (cur.length || !groups.length) groups.push(cur);
  const name = encodeURIComponent(devName);
  return groups.map((g, i) => `NLS1:${devId}:${name}:${i + 1}/${groups.length}:${g.join(';')}`);
}

function fromQrChunk(text) {
  const m = text.match(/^NLS1:([^:]+):([^:]*):(\d+)\/(\d+):(.*)$/s);
  if (!m) throw new Error('통계 QR 형식이 아니에요');
  const [, devId, name, part, total, body] = m;
  const events = body ? body.split(';').map(row => {
    const [seq, t, dir, rep, g, a] = row.split(',');
    return { id: `${devId}-${seq}`, at: parseInt(t, 36) * 1000, dev: devId, dir: dir === '1' ? 'ko2ja' : 'ja2ko', reprint: rep === '1', gender: G_FROM[g] ?? 'unset', age: AGE_FROM[a] ?? 'unset' };
  }) : [];
  return { devId, devName: decodeURIComponent(name), part: +part, total: +total, events };
}

// ── 가져오기: 파일 JSON, 붙여 넣은 JSON, QR 텍스트(여러 줄 가능) 모두 받는다 ──
export function parseImport(text) {
  const t = text.trim();
  if (t.startsWith('{')) {
    const j = JSON.parse(t);
    if (j.format !== 'nl-stats-v1') throw new Error('인쇄 기록 파일이 아니에요');
    return [{ devId: j.devId, devName: j.devName, events: j.events }];
  }
  return t.split(/\s*\n\s*/).filter(Boolean).map(fromQrChunk);
}

// ── 합치기: id 기준 중복 제거 (같은 id면 나중 값으로) ──
export function merge(store, batches) {
  let added = 0;
  for (const b of batches) {
    store.devices[b.devId] = b.devName || store.devices[b.devId] || b.devId;
    for (const e of b.events) { if (!store.events[e.id]) added++; store.events[e.id] = e; }
  }
  return added;
}

// ── 집계 ──
const kst = at => new Date(at + 9 * 3600e3);   // 일본·한국 시간 (UTC+9)
export function aggregate(events, devices = {}) {
  const firsts = events.filter(e => !e.reprint);
  const count = (arr, key) => arr.reduce((m, e) => (m[key(e)] = (m[key(e)] ?? 0) + 1, m), {});
  return {
    total: firsts.length,
    reprints: events.length - firsts.length,
    byDay: count(firsts, e => kst(e.at).toISOString().slice(0, 10)),
    byHour: count(firsts, e => kst(e.at).getUTCHours()),
    byGender: count(firsts, e => e.gender),
    byAge: count(firsts, e => e.age),
    byDir: count(firsts, e => e.dir),
    byDevice: count(events, e => devices[e.dev] ?? e.dev),
  };
}

export function toCsv(events, devices = {}) {
  const head = 'id,printed_at_jst,device,direction,reprint,gender,age';
  const rows = events.sort((a, b) => a.at - b.at).map(e =>
    [e.id, kst(e.at).toISOString().replace('T', ' ').slice(0, 19), devices[e.dev] ?? e.dev, e.dir, e.reprint ? 1 : 0, e.gender, e.age].join(','));
  return '\ufeff' + [head, ...rows].join('\n');   // BOM: 엑셀에서 한글 깨짐 방지
}
