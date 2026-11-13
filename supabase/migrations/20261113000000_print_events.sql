-- 이름 라벨 부스: 인쇄 기록 (방문자 이름은 저장하지 않는다)
-- 프로젝트 리전: Tokyo (ap-northeast-1)
create table if not exists public.print_events (
  client_id    text primary key,                       -- 기기ID-일련번호 (중복 업로드 방지)
  printed_at   timestamptz not null,
  device_id    text not null,
  device_name  text,
  direction    text not null check (direction in ('ja2ko', 'ko2ja')),
  reprint      boolean not null default false,
  staff_gender text not null default 'unset' check (staff_gender in ('m', 'f', 'unset')),
  staff_age    text not null default 'unset' check (staff_age in ('child', '10s', '20s', '30s', '40s', '50s', '60p', 'unset')),
  created_at   timestamptz not null default now()
);

create index if not exists print_events_printed_at_idx on public.print_events (printed_at);

alter table public.print_events enable row level security;

-- 넣기와 읽기만 허용 (수정·삭제는 대시보드에서만)
drop policy if exists "anon insert print_events" on public.print_events;
create policy "anon insert print_events" on public.print_events
  for insert to anon with check (true);

drop policy if exists "anon read print_events" on public.print_events;
create policy "anon read print_events" on public.print_events
  for select to anon using (true);

grant insert, select on public.print_events to anon;
