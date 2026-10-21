// 구독 신청 화면(/apply?plan=<id>): 고른 요금제를 확인하고 이름 · 휴대폰 번호 · 동의를 받아 신청을 저장한다.
import { Suspense } from "react";
import { loadPlan } from "../_components/planLoad";
import ApplyView, { ApplyLoading } from "./ApplyView";

export default function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 주소의 ?plan 값으로 DB에서 고른 요금제를 불러온다 (값이 여러 개면 첫 번째). 기다리지 않고 결과(Promise)만 화면에 넘긴다
  const planLoad = searchParams.then((query) => {
    const value = query.plan;
    return loadPlan((Array.isArray(value) ? value[0] : value) ?? "");
  });
  // 요금제를 불러오고 주소의 ?state 값을 읽는 동안에는 스켈레톤을 먼저 보여 준다
  return (
    <Suspense fallback={<ApplyLoading />}>
      <ApplyView planLoad={planLoad} />
    </Suspense>
  );
}
