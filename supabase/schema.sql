-- 받아쓰기 공부 · Supabase 스키마
-- 보호자 계정(auth.users) 하나에 아이 프로필 여러 개. 모든 행은 owner = 로그인한 보호자만 읽고 쓸 수 있다.

create table public.children (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  birth_year  int  check (birth_year between 2000 and 2100),
  grade       int  check (grade between 1 and 6),
  created_at  timestamptz not null default now()
);

-- 급수(주차별 문장 묶음). items = [{t: 문장, s: 표준 발음, w: [{w, s, r, why}]}]
create table public.word_sets (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  level       text,
  title       text,
  items       jsonb not null default '[]'::jsonb,
  test_date   date,
  real_score  int check (real_score between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 연습 한 번(단계 1~4, 0 = 자유 연습)
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  set_id      uuid references public.word_sets(id) on delete set null,
  stage       int  not null check (stage between 0 and 4),
  mode        text check (mode in ('each','all','learn')),
  write_on    text check (write_on in ('paper','screen')),
  total       int,
  correct     int,
  score       int check (score between 0 and 100),
  created_at  timestamptz not null default now()
);

-- 문장·낱말 한 문제의 결과
create table public.item_results (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  set_id      uuid references public.word_sets(id) on delete set null,
  item_type   text not null check (item_type in ('sent','word')),
  text        text not null,
  ok          boolean not null,
  tags        text[] not null default '{}',   -- space, punct, other
  typed       text,                            -- 화면 입력일 때만
  created_at  timestamptz not null default now()
);

-- 받침 낱말 하나의 결과 (분석의 기본 단위)
create table public.word_results (
  id          bigint generated always as identity primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  set_id      uuid references public.word_sets(id) on delete set null,
  word        text not null,
  sound       text,
  rule        text,                            -- link, change, double, rough, tense, vowel
  ok          boolean not null,
  how         text,                            -- sound(소리대로), jong(받침만), miss, mark(종이 채점)
  created_at  timestamptz not null default now()
);

create index on public.children (owner);
create index on public.word_sets (child_id, created_at);
create index on public.sessions (child_id, created_at);
create index on public.item_results (child_id, created_at);
create index on public.item_results (session_id);
create index on public.word_results (child_id, created_at);
create index on public.word_results (session_id);

-- RLS: 자기 행만. 자식 테이블은 child_id도 자기 아이여야 함.
alter table public.children     enable row level security;
alter table public.word_sets    enable row level security;
alter table public.sessions     enable row level security;
alter table public.item_results enable row level security;
alter table public.word_results enable row level security;

create policy "own children" on public.children for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

create or replace function public.owns_child(cid uuid) returns boolean
  language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.children c where c.id = cid and c.owner = (select auth.uid()))
$$;
revoke execute on function public.owns_child(uuid) from public, anon;
grant execute on function public.owns_child(uuid) to authenticated;

create policy "own sets" on public.word_sets for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and public.owns_child(child_id));
create policy "own sessions" on public.sessions for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and public.owns_child(child_id));
create policy "own item results" on public.item_results for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and public.owns_child(child_id));
create policy "own word results" on public.word_results for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and public.owns_child(child_id));
