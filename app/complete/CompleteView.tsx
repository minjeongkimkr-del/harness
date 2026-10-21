"use client";

// 신청 완료 화면 본문: 주소의 신청 번호(?id)로 서버(Supabase)에서 신청 1건을 불러와
// 완료 표시 · 신청 내역 · '요금제 더 보기' 버튼을 그린다.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatWon, type Plan } from "@/lib/plans";
import { fetchPlan } from "@/lib/plans-db";
import { getSubscription, maskName, maskPhone, type Subscription } from "@/lib/subscription";
import Header from "../_components/Header";
import ListRow from "../_components/ListRow";
import BottomCTA from "../_components/BottomCTA";
import { ButtonLink } from "../_components/Button";
import { DoneMark } from "../_components/icons";
import StateMessage from "../_components/StateMessage";
import { SkeletonBox } from "../_components/Skeleton";
import { readPageState, UNKNOWN_MESSAGE } from "../_components/pageState";

// 서버에서 불러온 결과. 어느 신청 번호(id)의 결과인지 함께 기억한다 (찾았으면 신청한 요금제도 함께, 못 불러오면 null)
type LoadResult =
  | { id: string; status: "found"; subscription: Subscription; plan: Plan | null }
  | { id: string; status: "missing" }
  | { id: string; status: "failed" };

// 로딩 상태(?state=loading): 완료 표시 · 신청 내역 자리에 회색 상자만 보여 준다
export function CompleteLoading() {
  return (
    <div aria-busy="true" className="flex w-full flex-col items-center gap-24 p-16">
      <SkeletonBox className="size-64 rounded-full" />
      <SkeletonBox className="h-32 rounded-8" />
      <SkeletonBox className="h-80 rounded-12" />
      <SkeletonBox className="h-80 rounded-12" />
    </div>
  );
}

export default function CompleteView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readPageState(searchParams);
  // 주소의 신청 번호. 상태 확인용 주소(?state=...)에서는 불러오지 않는다
  const id = searchParams.get("id") ?? "";
  const shouldLoad = state === "default" && id !== "";

  const [result, setResult] = useState<LoadResult | null>(null);

  // 신청 번호로 서버에서 신청 1건만 불러오고, 찾으면 그 신청의 요금제(이름 표시용)를 DB에서 불러온다.
  // 요금제를 못 불러오면 이름 자리에 "확인 필요"를 둔다. 다른 번호로 바뀌면 지난 결과는 버린다
  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    getSubscription(id)
      .then(async (subscription) => {
        if (!subscription) {
          if (active) setResult({ id, status: "missing" });
          return;
        }
        const plan = await fetchPlan(subscription.plan_id).catch(() => null);
        if (active) setResult({ id, status: "found", subscription, plan });
      })
      .catch(() => {
        if (active) setResult({ id, status: "failed" });
      });
    return () => {
      active = false;
    };
  }, [id, shouldLoad]);

  // 지금 주소의 신청 번호에 맞는 결과만 쓴다. 아직 없으면 불러오는 중
  const current = shouldLoad && result && result.id === id ? result : null;
  const loading = shouldLoad && !current;
  const subscription = current && current.status === "found" ? current.subscription : null;
  const loadFailed = current?.status === "failed";
  const plan = current && current.status === "found" ? current.plan : null;

  // 신청 번호가 없거나 그 번호의 신청을 찾지 못하면 요금제 목록으로 바꿔 보낸다(뒤로가기 기록에 남지 않음).
  // 상태 확인용 주소(?state=loading · empty · error)는 보내지 않고 그대로 보여 준다
  const noSubscription = state === "default" && (id === "" || current?.status === "missing");
  useEffect(() => {
    if (noSubscription) router.replace("/plans");
  }, [noSubscription, router]);

  // 상태별 본문: 로딩(또는 불러오는 중 · 목록으로 넘어가는 중) → 스켈레톤, 오류(또는 불러오기 실패) → "확인 필요",
  // 빈 상태 → "확인 필요", 그 밖에는 완료 화면
  let body;
  if (state === "loading" || loading || noSubscription) {
    body = <CompleteLoading />;
  } else if (state === "error" || loadFailed) {
    body = <StateMessage message={UNKNOWN_MESSAGE} tone="error" />;
  } else if (state === "empty" || !subscription) {
    body = <StateMessage message={UNKNOWN_MESSAGE} />;
  } else {
    body = (
      <div className="flex w-full flex-1 flex-col items-center gap-24 p-16">
        {/* 완료 표시: 완료 아이콘 + 완료 문구 */}
        <DoneMark />
        <h2 className="w-full text-center text-heading-h3 text-text-primary">구독 신청이 완료됐어요</h2>
        {/* 신청 내역: 신청 번호 · 요금제 이름 · 매달 내는 금액 · 신청 일시 · 신청자 (번호 · 일시 표시 형식은 확인 필요) */}
        {/* 신청자는 이름 가운데 글자와 휴대폰 번호 가운데 4자리를 가려서 보여 준다: 홍*동 · 010-****-5678 */}
        <section className="flex w-full flex-col gap-12">
          <h3 className="text-subtitle-bold text-text-primary">신청 내역</h3>
          <dl data-gate="complete-summary" className="flex w-full flex-col rounded-12 bg-bg-subtle p-16">
            <ListRow label="신청 번호" value={subscription.id} />
            <ListRow label="요금제" value={plan ? plan.name : UNKNOWN_MESSAGE} />
            <ListRow label="매달 내는 금액" value={formatWon(subscription.monthly_price)} />
            <ListRow label="신청 일시" value={new Date(subscription.created_at).toLocaleString("ko-KR")} />
            <ListRow label="신청자" value={`${maskName(subscription.name)} · ${maskPhone(subscription.phone)}`} />
          </dl>
        </section>
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh w-full flex-col bg-bg-surface">
      {/* 헤더: 뒤로 아이콘(요금제 목록으로) + 제목 */}
      <Header type="default" title="신청 완료" backHref="/plans" />
      {body}
      {/* 버튼 영역: '요금제 더 보기' → 요금제 목록. 완료 화면이 보일 때만 */}
      {state === "default" && subscription && (
        <BottomCTA reserve="short">
          <ButtonLink href="/plans">요금제 더 보기</ButtonLink>
        </BottomCTA>
      )}
    </main>
  );
}
