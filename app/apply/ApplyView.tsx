"use client";

// 구독 신청 화면 본문: 신청 내용 요약 · 신청자 정보 입력 · 동의 · '신청하기' 버튼을 그린다.
import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatWon, priceAfterLabel } from "@/lib/plans";
import { saveSubscription } from "@/lib/subscription";
import Header from "../_components/Header";
import ListRow from "../_components/ListRow";
import BottomCTA from "../_components/BottomCTA";
import { Button, ButtonLink } from "../_components/Button";
import TextField from "../_components/TextField";
import Checkbox from "../_components/Checkbox";
import StateMessage from "../_components/StateMessage";
import { SkeletonBox } from "../_components/Skeleton";
import { readPageState, UNKNOWN_MESSAGE } from "../_components/pageState";
import type { PlanLoad } from "../_components/planLoad";

// 오류 안내 문구 4개 (PRD 4-3 표 그대로)
const ERROR_NAME = "이름을 입력해 주세요.";
const ERROR_PHONE = "휴대폰 번호 11자리를 숫자로 입력해 주세요.";
const ERROR_AGREE = "개인정보 수집·이용에 동의해야 신청할 수 있어요.";
const ERROR_SAVE = "신청을 저장하지 못했어요. 다시 시도해 주세요.";

// 휴대폰 번호 규칙: 숫자 11자리
const PHONE_RULE = /^\d{11}$/;

// 휴대폰 번호 입력란에는 숫자만 들어간다: 숫자가 아닌 글자는 지우고, 11자리까지만 남긴다
const PHONE_MAX = 11;
function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX);
}

// 로딩 상태(?state=loading): 요약 · 입력란 자리에 회색 상자만 보여 준다
export function ApplyLoading() {
  return (
    <div aria-busy="true" className="flex w-full flex-col gap-16 p-16">
      <SkeletonBox className="h-32 rounded-8" />
      <SkeletonBox className="h-80 rounded-12" />
      <SkeletonBox className="h-56 rounded-8" />
      <SkeletonBox className="h-56 rounded-8" />
      <SkeletonBox className="h-24 rounded-4" />
    </div>
  );
}

export default function ApplyView({ planLoad }: { planLoad: Promise<PlanLoad> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readPageState(searchParams);
  // 서버가 주소의 ?plan 값으로 DB에서 불러온 고른 요금제. 없는 요금제거나 불러오기가 실패하면 없음
  const loaded = use(planLoad);
  const plan = loaded.status === "ok" ? loaded.plan : null;
  // 요금제 불러오기 실패: 요금제 요약을 그릴 수 없어 오류 안내 문구만 보여 준다
  const loadFailed = loaded.status === "failed";
  // 뒤로 · 취소 목적지: 고른 요금제의 상세 화면 (요금제를 못 찾으면 목록). 입력값은 남기지 않는다
  const backHref = plan ? `/plans/${plan.id}` : "/plans";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 로딩 · 빈 상태, 또는 요금제를 못 찾았거나 불러오지 못했을 때: 헤더만 남기고 스켈레톤이나 "확인 필요" 문구를 보여 준다
  if (state === "loading" || state === "empty" || !plan) {
    return (
      <main className="flex min-h-dvh w-full flex-col bg-bg-surface">
        <Header type="default" title="구독 신청" backHref={backHref} />
        {state === "loading" ? (
          <ApplyLoading />
        ) : (
          <StateMessage message={UNKNOWN_MESSAGE} tone={state !== "empty" && loadFailed ? "error" : "empty"} />
        )}
      </main>
    );
  }

  // 오류 상태(?state=error)면 오류 문구 4개를 모두 각 자리에 보여 준다.
  // 평소에는 이름을 비운 채 나가면 · 번호가 숫자 11자리가 아니면 · 저장이 실패하면 해당 문구만 나온다
  const showAll = state === "error";
  const nameError = showAll || (nameTouched && name.trim() === "") ? ERROR_NAME : null;
  const phoneError = showAll || (phoneTouched && !PHONE_RULE.test(phone)) ? ERROR_PHONE : null;
  const agreeError = showAll ? ERROR_AGREE : null;
  const saveError = showAll || saveFailed ? ERROR_SAVE : null;

  // 이름 · 휴대폰 번호(숫자 11자리) · 동의가 모두 채워져야 '신청하기'가 눌린다
  const canSubmit = name.trim() !== "" && PHONE_RULE.test(phone) && agreed && !submitting;
  const after = priceAfterLabel(plan);

  // '신청하기': 신청 1건을 서버(Supabase)에 저장하고, 돌려받은 신청 번호를 들고 신청 완료 화면으로 바꿔 이동한다
  // (뒤로가기로 이 화면에 돌아오지 않게). 저장하는 동안은 버튼을 막아 두 번 눌러도 한 번만 저장된다.
  // 저장이 실패하면 화면에 남아 저장 실패 문구를 보여 준다
  async function handleSubmit() {
    if (!plan || !canSubmit) return;
    setSubmitting(true);
    setSaveFailed(false);
    try {
      const saved = await saveSubscription({ name, phone, plan_id: plan.id, agreed_privacy: agreed });
      router.replace(`/complete?id=${encodeURIComponent(saved.id)}`);
    } catch {
      setSaveFailed(true);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh w-full flex-col bg-bg-surface">
      {/* 헤더: 뒤로 아이콘(요금제 상세로) + 제목 */}
      <Header type="default" title="구독 신청" backHref={backHref} />
      <div className="flex w-full flex-1 flex-col gap-16 p-16">
        {/* 신청 내용: 요금제 이름 · 매달 내는 금액 · 할인 종료 후 금액(p03만) */}
        <section className="flex w-full flex-col gap-12">
          <h2 className="text-heading-h3 text-text-primary">신청 내용</h2>
          <dl className="flex w-full flex-col border border-border-subtle bg-bg-default p-16">
            <ListRow label="요금제" value={plan.name} />
            <ListRow label="매달 내는 금액" value={formatWon(plan.monthly_price)} />
            {after !== null && <ListRow label="할인 종료 후 금액" value={after} />}
          </dl>
        </section>
        {/* 신청자 정보: 이름 · 휴대폰 번호 입력란(처음엔 비어 있음) + 개인정보 수집·이용 동의(처음엔 체크 안 됨) */}
        <section className="flex w-full flex-col gap-16">
          <h2 className="text-heading-h3 text-text-primary">신청자 정보</h2>
          <TextField
            id="apply-name"
            label="이름"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            error={nameError}
          />
          <TextField
            id="apply-phone"
            label="휴대폰 번호"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(onlyPhoneDigits(e.target.value))}
            onBlur={() => setPhoneTouched(true)}
            error={phoneError}
          />
          <Checkbox id="apply-agree" label="개인정보 수집·이용 동의" checked={agreed} onChange={setAgreed} error={agreeError} />
        </section>
      </div>
      {/* 버튼 영역: 저장 실패 문구(버튼 위) · '신청하기' · '취소'(요금제 상세로) */}
      {/* 본문 아래 빈 공간은 오류 문구 + 버튼 2개 높이(tall)만큼 둬서 동의 줄 · 동의 오류 문구까지 보이게 한다 */}
      <BottomCTA reserve="tall">
        {saveError && (
          <p role="alert" className="text-body-small-medium text-text-error">
            {saveError}
          </p>
        )}
        <Button data-gate="apply-submit" disabled={!canSubmit} onClick={handleSubmit}>
          신청하기
        </Button>
        <ButtonLink href={backHref} variant="secondary">
          취소
        </ButtonLink>
      </BottomCTA>
    </main>
  );
}
