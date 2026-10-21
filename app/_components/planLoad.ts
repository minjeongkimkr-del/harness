// 서버(page.tsx)에서 DB(Supabase) 요금제를 불러와 화면에 넘길 결과로 바꾼다.
// 불러오기가 실패해도 화면이 오류 문구를 그릴 수 있게, 던지지 않고 "failed" 결과로 돌려준다.
import type { Plan } from "@/lib/plans";
import { fetchPlan, fetchPlans } from "@/lib/plans-db";

// 요금제 목록을 불러온 결과: 성공(요금제들) 또는 실패
export type PlansLoad = { status: "ok"; plans: Plan[] } | { status: "failed" };

// 요금제 1개를 불러온 결과: 성공(요금제, 없으면 null) 또는 실패
export type PlanLoad = { status: "ok"; plan: Plan | null } | { status: "failed" };

// 보이는 요금제 전체를 불러온다 (매달 내는 금액 낮은 순)
export function loadPlans(): Promise<PlansLoad> {
  return fetchPlans().then(
    (plans): PlansLoad => ({ status: "ok", plans }),
    (): PlansLoad => ({ status: "failed" }),
  );
}

// 요금제 1개를 불러온다. id가 비어 있으면 DB에 묻지 않고 '없음'으로 둔다
export function loadPlan(id: string): Promise<PlanLoad> {
  if (id === "") return Promise.resolve({ status: "ok", plan: null });
  return fetchPlan(id).then(
    (plan): PlanLoad => ({ status: "ok", plan }),
    (): PlanLoad => ({ status: "failed" }),
  );
}
