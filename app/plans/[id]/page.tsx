// 요금제 상세 화면(/plans/[id]): 고른 요금제의 금액 · 데이터 · 소진 후 속도를 보여 주고 신청으로 넘긴다.
import { Suspense } from "react";
import { plans } from "@/lib/plans";
import { loadPlan } from "../../_components/planLoad";
import PlanDetailView, { PlanDetailLoading } from "./PlanDetailView";

// p01~p04 상세 화면을 미리 만들어 둔다
export function generateStaticParams() {
  return plans.map((plan) => ({ id: plan.id }));
}

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // 주소의 id로 DB에서 요금제 1개를 불러온다. 기다리지 않고 결과(Promise)만 화면에 넘긴다
  const planLoad = params.then(({ id }) => loadPlan(id));
  // 요금제를 불러오고 주소의 ?state 값을 읽는 동안에는 스켈레톤을 먼저 보여 준다
  return (
    <Suspense fallback={<PlanDetailLoading />}>
      <PlanDetailView planLoad={planLoad} />
    </Suspense>
  );
}
