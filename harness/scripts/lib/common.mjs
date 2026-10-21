// 하네스 스크립트가 함께 쓰는 경로 · 단계 · 소스 읽기 도구.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const abs = (p) => path.join(ROOT, p);
export const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join("/");
export const exists = (p) => fs.existsSync(abs(p));
export const read = (p) => fs.readFileSync(abs(p), "utf8");

// 단계와 단계별 편집 허용 범위 ("/"로 끝나면 폴더)
export const STAGES = ["1", "2", "3", "4-1", "4-2", "5"];
export const STAGE_NAMES = {
  "1": "맥락 정리",
  "2": "페이지 나누기",
  "3": "토큰 적용",
  "4-1": "데이터 구현",
  "4-2": "화면 구현",
  "5": "검증",
};
export const SCOPES = {
  "1": ["harness/01-context.md"],
  "2": ["harness/02-pages.md"],
  "3": [],
  "4-1": ["lib/"],
  "4-2": ["app/"],
  "5": ["harness/review/"],
};
// 스크립트만 쓰는 파일 (에이전트 · 메인 대화가 Write/Edit으로 쓰면 훅이 막는다)
export const SCRIPT_ONLY = ["app/tokens.css", "harness/state.json", "harness/05-report.md"];
// 단계 통과 시 범위 검사에서 늘 허용하는 변경 (스크립트 · Next.js가 만드는 파일)
export const ALWAYS_OK = ["harness/state.json", "harness/05-report.md", "next-env.d.ts", "AGENTS.md"];
export const STAGE_SCRIPT_OUTPUTS = { "3": ["app/tokens.css"] };
// 어느 단계에서도 쓰면 안 되는 원본
export const PROTECTED = ["docs/", "reference/", ".claude/agents/page-splitter.md", ".claude/skills/code-comments/"];
// 단계가 없을 때 메인 대화가 쓰면 안 되는 구현 영역
export const MANAGED = ["app/", "lib/", "components/", "harness/01-context.md", "harness/02-pages.md", "harness/review/"];

export const inList = (p, list) => list.some((s) => (s.endsWith("/") ? p.startsWith(s) : p === s));

// 파일 목록 (node_modules · .next 제외), exts: [".ts", ".tsx"]
export function walk(dir, exts) {
  const out = [];
  const base = abs(dir);
  if (!fs.existsSync(base)) return out;
  const stack = [base];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (!exts || exts.includes(path.extname(ent.name))) out.push(rel(full));
    }
  }
  return out.sort();
}

export const CODE_DIRS = ["app", "lib", "components"];
export const codeFiles = (exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"]) =>
  CODE_DIRS.flatMap((d) => walk(d, exts));

// 주석을 지운 소스와 문자열 리터럴 목록을 함께 돌려준다 (따옴표 · 템플릿 안의 // 는 주석으로 보지 않음)
export function scanSource(src) {
  let code = "";
  const strings = [];
  let i = 0;
  const braceStack = [];
  let mode = "code";
  let buf = "";
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && n === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end === -1 ? src.length : end + 2;
        code += " ";
        continue;
      }
      if (c === '"' || c === "'") {
        mode = c;
        buf = "";
        code += c;
        i++;
        continue;
      }
      if (c === "`") {
        mode = "`";
        buf = "";
        code += c;
        i++;
        continue;
      }
      if (c === "{" && braceStack.length) braceStack[braceStack.length - 1]++;
      if (c === "}" && braceStack.length) {
        if (braceStack[braceStack.length - 1] === 0) {
          braceStack.pop();
          mode = "`";
          buf = "";
          code += c;
          i++;
          continue;
        }
        braceStack[braceStack.length - 1]--;
      }
      code += c;
      i++;
      continue;
    }
    // 문자열 안
    if (c === "\\") {
      buf += c + (n ?? "");
      code += c + (n ?? "");
      i += 2;
      continue;
    }
    if (mode === "`" && c === "$" && n === "{") {
      strings.push(buf);
      buf = "";
      braceStack.push(0);
      mode = "code";
      code += "${";
      i += 2;
      continue;
    }
    if (c === mode) {
      strings.push(buf);
      mode = "code";
      code += c;
      i++;
      continue;
    }
    if (mode !== "`" && c === "\n") {
      // 닫히지 않은 따옴표(JSX 텍스트의 ' 등)는 줄 끝에서 끊는다
      strings.push(buf);
      mode = "code";
    }
    buf += c;
    code += c;
    i++;
  }
  return { code, strings };
}

export const stripComments = (src) => scanSource(src).code;

// PRD에서 라우트 목록과 요금제 표를 읽는다 (docs가 바뀌면 게이트도 따라 바뀐다)
export function prdRoutes() {
  const prd = read("docs/PRD.md");
  const sec = prd.split("### 화면 구조")[1]?.split("###")[0] ?? "";
  return [...sec.matchAll(/^\|\s*\d+\s*\|[^|]*\|\s*`([^`]+)`/gm)].map((m) => m[1]);
}

export function prdPlans() {
  const prd = read("docs/PRD.md");
  const sec = prd.split("### 요금제 데이터")[1]?.split("\n---")[0] ?? "";
  const won = (s) => {
    const m = s.match(/([\d,]+)원/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  return [...sec.matchAll(/^\|\s*(p\d+)\s*\|([^\n]+)$/gm)].map((m) => {
    const cols = m[2].split("|").map((s) => s.trim());
    const [name, price, data, speed, after] = cols;
    return { id: m[1], name, monthly_price: won(price), data, speed, price_after_discount: won(after), discountMonths: Number(price.match(/(\d+)개월/)?.[1] ?? 0) || null };
  });
}

export function prdPlanKeys() {
  const prd = read("docs/PRD.md");
  const block = prd.split(/^Plan:/m)[1]?.split("```")[0] ?? "";
  return [...block.matchAll(/^\s{2,}([a-z_]+):/gm)].map((m) => m[1]);
}

export const screensHeadingCount = () => (read("docs/screens.md").match(/^## /gm) ?? []).length;

export function sh(cmd, args, opts = {}) {
  // Windows에서는 npm이 npm.cmd라서 셸을 거쳐야 실행된다 (인자에 공백이 있는 git 등은 셸 없이)
  const shell = process.platform === "win32" && cmd === "npm";
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell, ...opts });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// 진행 상태
const STATE = "harness/state.json";
export function readState() {
  if (!exists(STATE)) {
    return { current: null, approved: false, stages: Object.fromEntries(STAGES.map((s) => [s, { status: "pending", retries: 0 }])) };
  }
  return JSON.parse(read(STATE));
}
export function writeState(state) {
  fs.mkdirSync(abs("harness"), { recursive: true });
  fs.writeFileSync(abs(STATE), JSON.stringify(state, null, 2) + "\n");
}
