"use client";

// 요금제 상세 화면 본문: 헤더 · 추천 Tag · 월 요금 상자 · 기본 제공 항목 · 신청 버튼 영역을 그린다.
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { formatWon, priceAfterLabel, speedLabel } from "@/lib/plans";
import type { PlanLoad } from "../../_components/planLoad";
import Header from "../../_components/Header";
import RecommendTag from "../../_components/RecommendTag";
import ListRow from "../../_components/ListRow";
import BottomCTA from "../../_components/BottomCTA";
import { ButtonLink } from "../../_components/Button";
import StateMessage from "../../_components/StateMessage";
import { SkeletonBox } from "../../_components/Skeleton";
import { readPageState, UNKNOWN_MESSAGE } from "../../_components/pageState";

// 로딩 상태(?state=loading): 금액 상자 · 행 · 버튼 자리에 회색 상자만 보여 준다
export function PlanDetailLoading() {
  return (
    <div aria-busy="true" className="flex w-full flex-col gap-24 p-24">
      <SkeletonBox className="h-80 rounded-12" />
      <SkeletonBox className="h-32 rounded-8" />
      <SkeletonBox className="h-48 rounded-8" />
      <SkeletonBox className="h-48 rounded-8" />
      <SkeletonBox className="h-56 rounded-8" />
    </div>
  );
}

export default function PlanDetailView({ planLoad }: { planLoad: Promise<PlanLoad> }) {
  const state = readPageState(useSearchParams());
  // 서버가 주소의 id로 DB에서 불러온 요금제. 없는 id면 없음, 불러오기가 실패해도 없음
  const loaded = use(planLoad);
  const plan = loaded.status === "ok" ? loaded.plan : null;
  // 기본 화면에서 불러오기가 실패하면 오류 상태와 같은 화면을 보여 준다
  const loadFailed = state === "default" && loaded.status === "failed";
  const title = plan ? plan.name : UNKNOWN_MESSAGE;

  // 로딩 · 빈 · 오류 상태, 불러오기 실패, 또는 없는 요금제 id일 때: 헤더만 남기고 스켈레톤이나 "확인 필요" 문구를 보여 준다
  if (state !== "default" || !plan) {
    return (
      <main className="flex min-h-dvh w-full flex-col bg-bg-surface">
        <Header type="default" title={title} backHref="/plans" />
        {state === "loading" ? (
          <PlanDetailLoading />
        ) : (
          <StateMessage message={UNKNOWN_MESSAGE} tone={state === "error" || loadFailed ? "error" : "empty"} />
        )}
      </main>
    );
  }

  // 할인 종료 후 금액 문구. 24개월 할인이 있는 요금제(p03)만 있고, 나머지는 줄을 그리지 않는다
  const after = priceAfterLabel(plan);

  return (
    <main className="flex min-h-dvh w-full flex-col bg-bg-surface">
      {/* 헤더: 뒤로 아이콘(요금제 목록으로) + 요금제 이름 */}
      <Header type="default" title={plan.name} backHref="/plans" />
      <div data-gate="plan-detail" data-plan={plan.id} className="flex w-full flex-1 flex-col gap-24 p-24">
        {/* 추천 Tag: 추천 요금제(p03)일 때만 */}
        <RecommendTag plan={plan} />
        {/* 월 요금 상자: 매달 내는 금액 1개 + 할인 종료 후 금액(있을 때만) */}
        <section className="flex w-full flex-col gap-4 rounded-12 bg-bg-default p-20">
          <p className="text-caption-medium text-text-tertiary">매달 내는 금액</p>
          <p className="text-heading-h2 text-text-primary">{formatWon(plan.monthly_price)}</p>
          {after !== null && <p className="text-caption-medium text-text-tertiary">{after}</p>}
        </section>
        {/* 기본 제공 항목: 데이터량 · 소진 후 속도 2줄 */}
        <section className="flex w-full flex-col gap-12">
          <h2 className="text-heading-h3 text-text-primary">기본 제공 항목</h2>
          <dl className="flex w-full flex-col">
            <ListRow label="데이터" value={plan.data} />
            <ListRow label="소진 후 속도" value={speedLabel(plan)} />
          </dl>
        </section>
      </div>
      {/* 신청 영역: 매달 내는 금액 + '구독 신청하기' 버튼(이 요금제 id를 들고 구독 신청 화면으로) */}
      {/* 본문 아래 빈 공간은 금액 줄 + 버튼 1개 높이(medium)만큼 둔다 */}
      <BottomCTA reserve="medium">
        <div className="flex w-full items-center gap-12 pb-4">
          <p className="flex-1 text-body-small-medium text-text-secondary">매달 내는 금액</p>
          <p className="text-subtitle-bold text-text-primary">{formatWon(plan.monthly_price)}</p>
        </div>
        <ButtonLink href={`/apply?plan=${plan.id}`}>구독 신청하기</ButtonLink>
      </BottomCTA>
    </main>
  );
}
