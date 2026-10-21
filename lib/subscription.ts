// 구독 신청 저장소 (docs/PRD.md 5장 Subscription)
// Supabase의 함수 create_subscription · get_subscription으로 저장하고 조회한다 (supabase/schema.sql).
// users · subscriptions 테이블은 공개 키로 직접 읽거나 쓸 수 없어서, 이 두 함수만 부른다.
// 화면 코드는 아래 함수만 쓰고, 저장 위치는 알지 못한다.

import { getPlan } from "./plans";
import { getClient } from "./supabase";

export type Subscription = {
  id: string; // 신청 번호. DB가 저장 시 생성
  name: string; // 신청자 이름. 빈 값 불가
  phone: string; // 휴대폰 번호. 숫자 11자리
  plan_id: string; // p01 | p02 | p03 | p04
  monthly_price: number; // 신청 시점의 매달 내는 금액(원). DB가 plans 테이블 값으로 저장
  agreed_privacy: boolean; // 개인정보 수집·이용 동의. true일 때만 저장
  status: "requested" | "completed" | "cancelled"; // 처리 상태. 저장 직후는 requested
  created_at: string; // 신청 일시(ISO 문자열). DB가 저장 시 생성
};

// create_subscription이 돌려주는 subscriptions 행 (이름·번호는 users 테이블에 있어서 들어 있지 않다)
type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  monthly_price: number;
  agreed_privacy: boolean;
  status: Subscription["status"];
  created_at: string;
  updated_at: string;
};

// get_subscription이 돌려주는 행 (0개 또는 1개)
type SubscriptionView = Omit<Subscription, "monthly_price"> & { monthly_price: number | string };

const SAVE_FAILED = "신청을 저장하지 못했어요. 다시 시도해 주세요.";
const LOAD_FAILED = "신청 내역을 불러오지 못했어요. 다시 시도해 주세요.";

export async function saveSubscription(input: {
  name: string;
  phone: string;
  plan_id: string;
  agreed_privacy: boolean;
}): Promise<Subscription> {
  if (input.agreed_privacy !== true) {
    throw new Error("개인정보 수집·이용에 동의해야 신청할 수 있어요.");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") {
    throw new Error("이름을 입력해 주세요.");
  }
  const phone = typeof input.phone === "string" ? input.phone : "";
  if (!/^\d{11}$/.test(phone)) {
    throw new Error("휴대폰 번호 11자리를 숫자로 입력해 주세요.");
  }
  const plan = getPlan(input.plan_id);
  if (!plan) {
    throw new Error(SAVE_FAILED);
  }

  const supabase = getClient();
  // 금액 · id · created_at은 보내지 않는다. DB 함수가 plans 테이블 금액으로 저장하고 나머지를 만든다.
  const { data, error } = await supabase
    .rpc("create_subscription", {
      p_name: name,
      p_phone: phone,
      p_plan_id: plan.id,
      p_agreed_privacy: true,
    })
    .single<SubscriptionRow>();

  if (error || !data) {
    throw new Error(SAVE_FAILED);
  }
  // 돌려받은 행에는 이름·번호가 없으므로 방금 확인한 입력값으로 채운다.
  return {
    id: data.id,
    name,
    phone,
    plan_id: data.plan_id,
    monthly_price: Number(data.monthly_price),
    agreed_privacy: data.agreed_privacy,
    status: data.status,
    created_at: data.created_at,
  };
}

// 신청 번호로 1건만 조회한다. 없으면 null
export async function getSubscription(id: string): Promise<Subscription | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .rpc("get_subscription", { p_id: id })
    .maybeSingle<SubscriptionView>();
  if (error) {
    throw new Error(LOAD_FAILED);
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    plan_id: data.plan_id,
    monthly_price: Number(data.monthly_price),
    agreed_privacy: data.agreed_privacy,
    status: data.status,
    created_at: data.created_at,
  };
}
// 이름 가운데를 *로 가린다. 홍 → 홍, 김철 → 김*, 홍길동 → 홍*동, 남궁민수 → 남**수
export function maskName(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length <= 1) return chars.join("");
  if (chars.length === 2) return `${chars[0]}*`;
  return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
}

// 휴대폰 번호 가운데 4자리를 가린다. 01012345678 → 010-****-5678
// 11자리가 아니면 숫자 가운데 4자리만 *로 바꿔 원번호가 다 보이지 않게 한다.
export function maskPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length <= 4) return "*".repeat(digits.length);
  const start = Math.floor((digits.length - 4) / 2);
  return digits.slice(0, start) + "****" + digits.slice(start + 4);
}
