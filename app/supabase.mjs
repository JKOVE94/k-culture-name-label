// Supabase 연동 (A: 인터넷이 되면 인쇄 기록을 자동으로 모은다)
// 아직 프로젝트가 없으므로 비활성. 준비되면 아래 두 값만 채우고
//   - 스태프 화면: npm run build:staff 로 print.html 다시 만들기
//   - supabase/migrations/ 의 SQL 실행
// anon key는 원래 공개되는 키다. 권한은 RLS로 "기록 넣기 + 읽기"만 허용한다.
export const SUPABASE_URL = '';        // 예: https://xxxx.supabase.co  (리전: Tokyo ap-northeast-1)
export const SUPABASE_ANON_KEY = '';

export const enabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const headers = () => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' });

// 같은 id는 무시(ignore-duplicates)하므로 여러 번 보내도 안전
export async function uploadEvents(events, deviceName) {
  if (!enabled() || !events.length) return 0;
  const rows = events.map(e => ({
    client_id: e.id, printed_at: new Date(e.at).toISOString(), device_id: e.dev, device_name: deviceName,
    direction: e.dir, reprint: !!e.reprint, staff_gender: e.gender, staff_age: e.age,
  }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/print_events?on_conflict=client_id`, {
    method: 'POST', headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`업로드 실패 HTTP ${r.status}`);
  return rows.length;
}

export async function fetchEvents() {
  if (!enabled()) return [];
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/print_events?select=*&order=printed_at`, { headers: { ...headers(), Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`불러오기 실패 HTTP ${r.status}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out.map(x => ({
    id: x.client_id, at: Date.parse(x.printed_at), dev: x.device_id, devName: x.device_name,
    dir: x.direction, reprint: x.reprint, gender: x.staff_gender, age: x.staff_age,
  }));
}
