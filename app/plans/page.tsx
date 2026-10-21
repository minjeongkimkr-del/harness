// 요금제 목록 화면(/plans): 요금제 카드 4개와 필터 칩을 보여 준다.
import { Suspense } from "react";
import { loadPlans } from "../_components/planLoad";
import PlansView, { PlansLoading } from "./PlansView";

export default function PlansPage() {
  // DB에서 요금제 목록을 불러온다. 기다리지 않고 결과(Promise)만 화면에 넘긴다
  const plansLoad = loadPlans();
  // 요금제를 불러오고 주소의 ?state 값을 읽는 동안에는 스켈레톤을 먼저 보여 준다
  return (
    <Suspense fallback={<PlansLoading />}>
      <PlansView plansLoad={plansLoad} />
    </Suspense>
  );
}
