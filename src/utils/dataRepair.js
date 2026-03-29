/**
 * 데이터 복구 유틸리티
 *
 * 근본 원인: atob()는 Latin-1만 처리하므로 UTF-8 한글을 디코딩하면 깨짐.
 * 수정: decodeURIComponent(escape(str)) — 잘못 Latin-1로 읽힌 문자열을 UTF-8로 재해석.
 * 이 변환은 getFile()에 이미 적용된 것과 동일한 역변환이다.
 */

const CORRUPT_PATTERN = /[\xC0-\xFF][\x80-\xBF]/; // Latin-1 멀티바이트 잔재

/**
 * 손상된 문자열 복원 시도.
 * 손상되지 않은 문자열은 그대로 반환.
 */
export function repairString(str) {
  if (typeof str !== "string") return str;
  if (!CORRUPT_PATTERN.test(str)) return str; // 손상 없음
  try {
    const fixed = decodeURIComponent(escape(str));
    // 수정 후에도 여전히 손상 패턴이 있으면 원본 반환
    return CORRUPT_PATTERN.test(fixed) ? str : fixed;
  } catch {
    return str;
  }
}

/**
 * 객체의 모든 문자열 필드를 재귀적으로 복원.
 */
export function repairObject(obj) {
  if (typeof obj === "string") return repairString(obj);
  if (Array.isArray(obj)) return obj.map(repairObject);
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = repairObject(v);
    }
    return result;
  }
  return obj;
}

/**
 * 앱 전체 데이터 복원.
 * localStorage/GitHub에서 로드한 데이터에 적용.
 */
export function repairAppData(data) {
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    projects: repairObject(data.projects ?? []),
    sources: repairObject(data.sources ?? []),
    uiComponents: repairObject(data.uiComponents ?? []),
    tokenSets: repairObject(data.tokenSets ?? []),
  };
}

/**
 * 복구가 필요한지 확인 + 변경될 항목 요약 반환.
 * @returns null (손상 없음) | { count, examples: [{field, before, after}] }
 */
export function detectCorruption(data) {
  if (!data || typeof data !== "object") return null;
  const repaired = repairAppData(data);
  const examples = [];

  const compare = (field, raw, fixed) => {
    if (!Array.isArray(raw)) return;
    raw.forEach((item, i) => {
      if (item?.name && fixed[i]?.name && item.name !== fixed[i].name) {
        examples.push({ field, before: item.name, after: fixed[i].name });
      }
    });
  };

  compare("projects", data.projects, repaired.projects);
  compare("sources", data.sources, repaired.sources);
  compare("uiComponents", data.uiComponents, repaired.uiComponents);

  if (examples.length === 0) return null;
  return { count: examples.length, examples: examples.slice(0, 5) };
}
