-- 요금제 · 사용자 · 구독 신청 스키마 (docs/PRD.md 5장 데이터 기준 + 사용자 테이블 추가)
-- Supabase 대시보드 > SQL Editor에서 한 번 실행한다. 다시 실행해도 오류가 나지 않게 썼다.
-- supabase/subscriptions.sql을 대신한다. 둘 중 하나만 실행한다.
--
-- 구성
--   plans          요금제 4개 (누구나 조회)
--   users          신청한 사용자 1명 = 1행 (휴대폰 번호로 구분, 공개 키로 직접 조회 불가)
--   subscriptions  구독 신청 1건 = 1행 (users · plans를 참조)
--   create_subscription()  사용자 저장/갱신 + 신청 저장을 한 번에 (화면은 이 함수만 호출)
--   get_subscription()     신청 번호로 1건 조회 (완료 화면용)

-- ─────────────────────────────────────────────
-- 1. plans: 요금제 (PRD 5장 Plan, 4장 요금제 데이터 표)
-- ─────────────────────────────────────────────
create table if not exists public.plans (
  -- p01 ~ p04
  id                   text        primary key check (id ~ '^p[0-9]{2}$'),
  name                 text        not null,
  -- 매달 내는 금액(원)
  monthly_price        integer     not null check (monthly_price >= 0),
  -- "10GB" | "50GB" | "기본 100GB" | "무제한"
  data                 text        not null,
  -- 소진 후 속도. 제한 없으면 null
  throttle_after       text,
  -- 할인 종료 후 월 요금. 할인 없으면 null
  price_after_discount integer     check (price_after_discount >= 0),
  -- 할인 기간(개월). 할인 없으면 null
  discount_months      integer     check (discount_months > 0),
  -- 한 줄 설명
  description          text        not null,
  -- 추천 Tag 표시 여부
  recommended          boolean     not null default false,
  -- 목록에서 숨길 때 false (신청 내역이 참조하므로 행은 지우지 않는다)
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- 할인 금액과 할인 기간은 함께 있거나 함께 없다
  check ((price_after_discount is null) = (discount_months is null))
);

comment on table public.plans is '요금제 (PRD 5장 Plan)';

-- 추천 Tag는 1개만 (PRD 판정 규칙 2)
create unique index if not exists plans_one_recommended
  on public.plans (recommended) where recommended;

-- 실습용 가상 데이터 (lib/plans.ts와 같은 값)
insert into public.plans
  (id, name, monthly_price, data, throttle_after, price_after_discount, discount_months, description, recommended)
values
  ('p01', '슬림 10GB',     39000, '10GB',       '1Mbps', null,  null, '출퇴근 영상 시청이 적은 고객용 기본 요금제',            false),
  ('p02', '데일리 50GB',   52000, '50GB',       '1Mbps', null,  null, '출퇴근길 영상을 월말까지 보고 싶은 고객용',             false),
  ('p03', '무제한 라이트', 59000, '기본 100GB', '5Mbps', 69000, 24,   '이름은 무제한이지만 기본 데이터 소진 후 속도가 제한됨', true),
  ('p04', '무제한 프리',   75000, '무제한',     null,    null,  null, '데이터를 다 써도 속도 제한이 없는 요금제',              false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 2. users: 사용자 (휴대폰 번호 1개 = 사용자 1명)
-- ─────────────────────────────────────────────
create table if not exists public.users (
  -- 사용자 id. 저장 시 생성
  id                 uuid        primary key default gen_random_uuid(),
  -- 사용자명. 빈 값 불가
  name               text        not null check (char_length(btrim(name)) between 1 and 50),
  -- 휴대폰 번호. 숫자 11자리, 중복 불가
  phone              text        not null unique check (phone ~ '^01[0-9]{9}$'),
  -- 개인정보 수집·이용 동의 시각 · 동의한 약관 버전 (동의 증빙)
  privacy_agreed_at  timestamptz not null,
  privacy_version    text        not null default 'v1',
  -- 마케팅 수신 동의 (선택). 화면에 항목이 생기면 사용
  marketing_agreed   boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.users is '사용자. 이름·휴대폰 번호는 개인정보이므로 공개 키로 직접 조회하지 않는다';

-- ─────────────────────────────────────────────
-- 3. subscriptions: 구독 신청 (PRD 5장 Subscription)
-- ─────────────────────────────────────────────
create table if not exists public.subscriptions (
  -- 신청 번호. 저장 시 생성
  id             text        primary key default gen_random_uuid()::text,
  -- 신청한 사용자
  user_id        uuid        not null references public.users (id) on delete restrict,
  -- 요금제 id
  plan_id        text        not null references public.plans (id) on delete restrict,
  -- 신청 시점의 매달 내는 금액(원). 요금제 금액이 바뀌어도 신청 당시 값을 남긴다
  monthly_price  integer     not null check (monthly_price >= 0),
  -- 개인정보 수집·이용 동의. true일 때만 저장
  agreed_privacy boolean     not null check (agreed_privacy = true),
  -- 처리 상태: 접수됨 → 완료 / 취소
  status         text        not null default 'requested'
                             check (status in ('requested', 'completed', 'cancelled')),
  -- 신청 일시. 저장 시 생성
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.subscriptions is '구독 신청 1건 (PRD 5장 Subscription)';

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);

-- ─────────────────────────────────────────────
-- 4. updated_at 자동 갱신
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- 5. 접근 권한 (RLS)
--    plans: 누구나 조회만
--    users · subscriptions: 공개 키로 직접 읽기·쓰기 불가. 아래 함수로만 접근
-- ─────────────────────────────────────────────
alter table public.plans         enable row level security;
alter table public.users         enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "anyone can read active plans" on public.plans;
create policy "anyone can read active plans"
  on public.plans for select to anon, authenticated
  using (is_active);

-- 예전 subscriptions.sql의 전체 공개 정책이 남아 있으면 지운다
drop policy if exists "anon can insert subscriptions" on public.subscriptions;
drop policy if exists "anon can select subscriptions" on public.subscriptions;

revoke insert, update, delete, truncate on public.plans from anon, authenticated;
revoke all on public.users         from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;

-- ─────────────────────────────────────────────
-- 6. 함수: 신청 저장 · 조회
-- ─────────────────────────────────────────────

-- 신청 저장. 같은 휴대폰 번호면 기존 사용자를 쓰고 이름·동의 시각을 갱신한다.
-- 금액은 화면이 보낸 값이 아니라 plans 테이블 값으로 저장한다.
create or replace function public.create_subscription(
  p_name           text,
  p_phone          text,
  p_plan_id        text,
  p_agreed_privacy boolean
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_price   integer;
  v_row     public.subscriptions;
begin
  if p_agreed_privacy is distinct from true then
    raise exception '개인정보 수집·이용에 동의해야 신청할 수 있어요.';
  end if;

  select monthly_price into v_price
    from public.plans
   where id = p_plan_id and is_active;
  if v_price is null then
    raise exception '요금제를 찾을 수 없어요.';
  end if;

  insert into public.users (name, phone, privacy_agreed_at)
  values (btrim(p_name), p_phone, now())
  on conflict (phone) do update
    set name = excluded.name,
        privacy_agreed_at = excluded.privacy_agreed_at
  returning id into v_user_id;

  insert into public.subscriptions (user_id, plan_id, monthly_price, agreed_privacy)
  values (v_user_id, p_plan_id, v_price, true)
  returning * into v_row;

  return v_row;
end;
$$;

-- 신청 번호로 1건 조회 (완료 화면: 신청 번호 · 요금제 · 금액 · 일시 · 신청자 이름 · 번호)
-- 신청 번호(uuid)를 아는 사람만 그 1건을 볼 수 있다. 목록 조회는 없다.
create or replace function public.get_subscription(p_id text)
returns table (
  id             text,
  name           text,
  phone          text,
  plan_id        text,
  monthly_price  integer,
  agreed_privacy boolean,
  status         text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, u.name, u.phone, s.plan_id, s.monthly_price, s.agreed_privacy, s.status, s.created_at
    from public.subscriptions s
    join public.users u on u.id = s.user_id
   where s.id = p_id;
$$;

revoke all on function public.create_subscription(text, text, text, boolean) from public;
revoke all on function public.get_subscription(text) from public;
grant execute on function public.create_subscription(text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_subscription(text) to anon, authenticated;
