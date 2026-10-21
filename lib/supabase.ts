// Supabase 연결 (lib/ 안에서만 쓴다)
// 요금제 조회(lib/plans-db.ts)와 신청 저장·조회(lib/subscription.ts)가 같은 연결을 함께 쓴다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// 처음 쓸 때 한 번만 연결을 만든다. 로그인을 쓰지 않으므로 브라우저에 아무것도 남기지 않는다.
export function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 연결 정보(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 없어요.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
