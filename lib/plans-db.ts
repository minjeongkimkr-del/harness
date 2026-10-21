// 요금제 조회 (Supabase의 public.plans 테이블, supabase/schema.sql)
// 목록에 보이는 요금제(is_active)만 읽어 lib/plans.ts의 Plan 모양으로 돌려준다.
// 추천 요금제를 맨 위에 두는 정렬은 화면이 한다. 여기서는 매달 내는 금액 낮은 순으로만 준다.

import type { Plan } from "./plans";
import { getClient } from "./supabase";

const TABLE = "plans";
const LOAD_FAILED = "요금제를 불러오지 못했어요. 다시 시도해 주세요.";

// Plan 키만 고른다 (is_active · created_at · updated_at은 화면에 넘기지 않는다)
const COLUMNS =
  "id, name, monthly_price, data, throttle_after, price_after_discount, discount_months, description, recommended";

type PlanRow = {
  id: string;
  name: string;
  monthly_price: number;
  data: string;
  throttle_after: string | null;
  price_after_discount: number | null;
  discount_months: number | null;
  description: string;
  recommended: boolean;
};

// DB 행 → Plan. 키 순서와 null 처리를 lib/plans.ts와 똑같이 맞춘다.
function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    monthly_price: Number(row.monthly_price),
    data: row.data,
    throttle_after: row.throttle_after ?? null,
    price_after_discount: row.price_after_discount === null ? null : Number(row.price_after_discount),
    discount_months: row.discount_months === null ? null : Number(row.discount_months),
    description: row.description,
    recommended: row.recommended === true,
  };
}

// 보이는 요금제 전체. 매달 내는 금액 낮은 순 (같으면 id 순)
export async function fetchPlans(): Promise<Plan[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("is_active", true)
    .order("monthly_price", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) {
    throw new Error(LOAD_FAILED);
  }
  return (data as PlanRow[]).map(toPlan);
}

// 요금제 1개. 없거나 숨긴 요금제면 null
export async function fetchPlan(id: string): Promise<Plan | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    throw new Error(LOAD_FAILED);
  }
  return data ? toPlan(data as PlanRow) : null;
}
