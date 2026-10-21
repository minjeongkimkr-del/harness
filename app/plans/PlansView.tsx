"use client";

// 요금제 목록 화면 본문: 헤더 · 필터 칩 · 안내 문구 · 요금제 카드 4개를 그린다.
import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Plan } from "@/lib/plans";
import type { PlansLoad } from "../_components/planLoad";
import Header from "../_components/Header";
import FilterChip from "../_components/FilterChip";
import PlanCard from "../_components/PlanCard";
import StateMessage from "../_components/StateMessage";
import { SkeletonBox, SkeletonList } from "../_components/Skeleton";
import { readPageState, UNKNOWN_MESSAGE } from "../_components/pageState";

// 필터 칩 4개 (화면 링크 기준). 누르면 선택 표시만 바뀌고 카드는 걸러지지 않는다
const CHIPS = ["전체", "베이직", "스탠다드", "프리미엄"];

// 카드 보여 주는 순서: 추천 요금제를 맨 위에, 나머지는 매달 내는 금액 낮은 순
function sortPlans(plans: Plan[]) {
  return [...plans].sort(
    (a, b) => Number(b.recommended) - Number(a.recommended) || a.monthly_price - b.monthly_price,
  );
}

// 로딩 상태(?state=loading): 칩 · 제목 · 카드 자리에 회색 상자만 보여 준다
export function PlansLoading() {
  return (
    <div className="flex w-full flex-col gap-16 px-24 py-16">
      <SkeletonBox className="h-40 rounded-full" />
      <SkeletonBox className="h-32 rounded-8" />
      <SkeletonList count={4} className="h-80 rounded-16" />
    </div>
  );
}

export default function PlansView({ plansLoad }: { plansLoad: Promise<PlansLoad> }) {
  // 주소의 ?state 값 (없으면 기본 화면)
  const state = readPageState(useSearchParams());
  // 지금 선택된 칩. 처음에는 '전체'
  const [selected, setSelected] = useState(CHIPS[0]);
  // 서버가 DB에서 불러온 요금제 목록 (불러오는 동안은 page.tsx의 스켈레톤이 보인다)
  const loaded = use(plansLoad);
  const sortedPlans = loaded.status === "ok" ? sortPlans(loaded.plans) : [];
  // 기본 화면에서 불러오기가 실패하면 오류 상태, 보이는 요금제가 0개면 빈 상태와 같은 화면을 보여 준다
  const loadFailed = state === "default" && loaded.status === "failed";
  const noPlans = state === "default" && loaded.status === "ok" && sortedPlans.length === 0;

  return (
    <main className="flex min-h-dvh w-full flex-col bg-bg-default">
      {/* 헤더: 화면 제목 + 오른쪽 로고 */}
      <Header type="root" title="요금제 목록" />
      {/* 로딩 · 빈 · 오류 상태: ?state 값(또는 불러오기 결과)에 따라 바뀐다. 빈 · 오류 문구는 정해지지 않아 "확인 필요" */}
      {state === "loading" && <PlansLoading />}
      {(state === "empty" || noPlans) && <StateMessage message={UNKNOWN_MESSAGE} />}
      {(state === "error" || loadFailed) && <StateMessage message={UNKNOWN_MESSAGE} tone="error" />}
      {state === "default" && !loadFailed && !noPlans && (
        <div className="flex w-full flex-col gap-16 px-24 py-16">
          {/* 필터 칩 4개: 한 번에 1개만 선택 */}
          <div className="flex w-full gap-8 overflow-x-auto">
            {CHIPS.map((label) => (
              <FilterChip key={label} label={label} selected={selected === label} onSelect={() => setSelected(label)} />
            ))}
          </div>
          {/* 목록 안내 문구 (screens.md) */}
          <h2 className="text-heading-h3 text-text-primary">나에게 맞는<br />요금제를 골라보세요</h2>
          {/* 요금제 카드 4개: 추천 요금제 먼저, 나머지는 매달 내는 금액 낮은 순 */}
          <div className="flex w-full flex-col gap-8">
            {sortedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
