/**
 * claude CLI 의 /usage 출력을 UsageSnapshot 으로 옮긴다.
 *
 * 취득 경로가 바뀌어도 이 폴더만 갈아끼우면 되도록 파싱을 여기 몰아둔다.
 * 프로세스 실행은 아직 붙이지 않았다. 이 파일은 문자열만 받는 순수 함수다.
 *
 * 다루는 출력은 이런 모양이다.
 *
 *   You are currently using your subscription to power your Claude Code usage
 *   Current session: 51% used · resets Aug 27, 1pm (Asia/Seoul)
 *   Current week (all models): 5% used · resets Sep 2, 8pm (Asia/Seoul)
 *   Current week (Fable): 0% used
 *
 * 주의할 점
 *   - CLI 는 **사용률**을 주는데 화면은 **잔여율**만 본다. 여기서 뒤집는다
 *   - 가운데점(·)이 구분자다
 *   - 색상 코드가 섞여 들어올 수 있어 지우고 시작한다
 *   - 날짜에 연도가 없다. 유예 구간보다 더 지난 시각이면 내년으로 본다
 *   - 모델별 주간 한도(Fable 등)는 v0.1 에서 무시한다
 */

import type { UsageSnapshot } from "../snapshot";

/** 구분자. CLI 가 항목을 이걸로 나눈다. */
const SEPARATOR = "·";

/**
 * 색상 · 커서 제어 문자.
 *
 * 제어 문자를 소스에 그대로 두면 편집기나 도구를 거치며 깨지기 쉬워서
 * 코드값으로 만들어 붙인다.
 */
const ESC = String.fromCharCode(0x1b);
const CSI = String.fromCharCode(0x9b);

/**
 * 색을 입히는 CSI 시퀀스. "ESC [ 숫자들 글자" 또는 CSI 한 글자로 시작한다.
 *
 * 패턴에 역슬래시를 쓰지 않았다. "[[]" 는 여는 대괄호 하나를 담은 문자 클래스다.
 * 역슬래시가 문자열을 거치며 한 번 더 벗겨지면 패턴이 조용히 망가지는데,
 * 그때 아무것도 못 지우면서 예외도 안 나서 알아채기 어렵다.
 */
const ANSI = new RegExp("(?:" + ESC + "[[]|" + CSI + ")[0-9;?]*[A-Za-z]", "g");

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "51% used" 또는 "51.5 % used" */
const PERCENT = /(\d+(?:\.\d+)?)\s*%\s*used/i;

/** "resets Aug 27, 1pm (Asia/Seoul)" · 분과 지역명은 없을 수도 있다. */
const RESET =
  /^resets\s+([A-Za-z]{3,9})\s+(\d{1,2})\s*,\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b\s*(?:\(([^)]+)\))?/i;

const SESSION_LABEL = /^current\s+session\s*:/i;
/** 모델별 줄("Current week (Fable)")과 구분해야 하므로 all models 를 못박는다. */
const WEEKLY_LABEL = /^current\s+week\s*\(\s*all\s+models\s*\)\s*:/i;

/**
 * 연도 추정의 유예 구간.
 *
 * 출력에 연도가 없어서 지난 시각이면 내년으로 보는데, 조금이라도 과거면
 * 미는 식이면 곤란하다. CLI 를 부르고 결과를 받아 파싱하기까지 시간이 걸리고
 * 시계도 조금씩 어긋나서, 방금 지난 리셋 시각이 1년 뒤로 튈 수 있다.
 * 이만큼 지난 것까지는 올해로 본다.
 */
const YEAR_GUESS_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * /usage 출력을 UsageSnapshot 으로 옮긴다.
 *
 * 읽어내지 못하면 예외를 던지지 않고 null 을 돌려준다. 호출부는 그때
 * 직전 값을 그대로 두고 stale 만 세우면 된다.
 *
 * 잔여율 두 개를 모두 얻지 못하면 쓸모가 없으므로 null 이다.
 * 리셋 시각만 못 읽은 경우는 그 필드만 null 로 두고 나머지를 살린다.
 * 화면은 remainingPct 로만 움직이므로 그것까지 버릴 이유가 없다.
 *
 * now 를 인자로 받는 것은 연도 추정과 fetchedAt 때문이다. 넘기면 순수 함수라
 * 같은 입력에 늘 같은 결과가 나온다.
 */
export function parseUsage(
  output: string,
  now: Date = new Date(),
): UsageSnapshot | null {
  if (typeof output !== "string" || output.trim() === "") return null;

  let sessionUsed: number | null = null;
  let weeklyUsed: number | null = null;
  let resetAt: string | null = null;
  let weeklyResetAt: string | null = null;

  for (const raw of stripAnsi(output).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;

    const isSession = SESSION_LABEL.test(line);
    const isWeekly = WEEKLY_LABEL.test(line);
    if (!isSession && !isWeekly) continue;

    const parts = line.split(SEPARATOR).map((part) => part.trim()).filter(Boolean);

    const used = findPercent(parts);
    if (used === null) continue;

    if (isSession) {
      sessionUsed = used;
      resetAt = findResetAt(parts, now);
    } else {
      weeklyUsed = used;
      weeklyResetAt = findResetAt(parts, now);
    }
  }

  if (sessionUsed === null || weeklyUsed === null) return null;

  return {
    remainingPct: toRemaining(sessionUsed),
    weeklyRemainingPct: toRemaining(weeklyUsed),
    resetAt,
    weeklyResetAt,
    // 이 출력에는 모델 이름이 없다.
    model: null,
    fetchedAt: now.toISOString(),
    stale: false,
  };
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/** 사용률을 잔여율로 뒤집는다. */
function toRemaining(usedPct: number): number {
  const remaining = 100 - usedPct;
  return remaining < 0 ? 0 : remaining > 100 ? 100 : remaining;
}

function findPercent(parts: readonly string[]): number | null {
  for (const part of parts) {
    const match = PERCENT.exec(part);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function findResetAt(parts: readonly string[], now: Date): string | null {
  const segment = parts.find((part) => /^resets\b/i.test(part));
  if (!segment) return null;

  const match = RESET.exec(segment);
  if (!match) return null;

  const [, monthName, dayText, hourText, minuteText, meridiem, zoneName] = match;

  const month = MONTHS[monthName.slice(0, 3).toLowerCase()];
  if (!month) return null;

  const day = Number(dayText);
  const minute = minuteText ? Number(minuteText) : 0;
  const rawHour = Number(hourText);
  if (rawHour < 1 || rawHour > 12 || minute > 59 || day < 1) return null;

  // 12am 은 0시, 12pm 은 12시.
  const hour = (rawHour % 12) + (/pm/i.test(meridiem) ? 12 : 0);
  const timeZone = zoneName?.trim() || undefined;

  // 연도가 없다. 올해로 잡아보고 유예 구간보다 더 지났으면 내년으로 본다.
  const earliest = now.getTime() - YEAR_GUESS_GRACE_MS;

  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    if (day > daysInMonth(year, month)) continue;

    const instant = zonedToInstant(year, month, day, hour, minute, timeZone);
    if (instant === null) return null;
    if (instant.getTime() >= earliest) return instant.toISOString();
  }

  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 어느 지역의 벽시계 시각을 실제 시점으로 옮긴다.
 *
 * 지역명이 IANA 이름("Asia/Seoul")이라 오프셋을 상수로 둘 수 없다.
 * Intl 에게 "이 시점에 그 지역은 몇 시인가"를 물어 차이를 되돌리는 식으로 구한다.
 * 서머타임 경계에서 한 번의 보정으로는 어긋날 수 있어 두 번 돈다.
 */
function zonedToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone?: string,
): Date | null {
  // 지역명이 없으면 이 PC 의 시간대로 읽는 수밖에 없다.
  if (!timeZone) return new Date(year, month - 1, day, hour, minute);

  const wall = Date.UTC(year, month - 1, day, hour, minute);

  try {
    let instant = wall - zoneOffsetMs(wall, timeZone);
    instant = wall - zoneOffsetMs(instant, timeZone);
    return new Date(instant);
  } catch {
    // 알 수 없는 지역명. 억지로 추측하지 않는다.
    return null;
  }
}

/** 주어진 시점에서 그 지역이 UTC 보다 얼마나 앞서 있는지(ms). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));

  const at: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") at[part.type] = Number(part.value);
  }

  // hour12:false 인데도 24 를 돌려주는 환경이 있어 접어준다.
  const asUtc = Date.UTC(
    at.year,
    at.month - 1,
    at.day,
    at.hour % 24,
    at.minute,
    at.second,
  );

  return asUtc - instantMs;
}
