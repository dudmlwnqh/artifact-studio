// GitHub를 앱 데이터베이스로 사용 — 전체 앱 상태를 단일 JSON 파일로 관리
import { getFile, putFile } from "./githubApi.js";
import { repairAppData } from "./dataRepair.js";

const DATA_FILE = "artifact-studio-data.json";

/**
 * GitHub에서 앱 데이터 불러오기
 * @returns { raw, data, sha } — raw: 원본, data: repair 적용본
 */
export async function loadFromGitHub(token, repo, branch = "main") {
  const file = await getFile(token, repo, DATA_FILE, branch);
  if (!file) return null;
  try {
    const raw = JSON.parse(file.content);
    const data = repairAppData(raw);
    return { raw, data, sha: file.sha };
  } catch {
    return null;
  }
}

/**
 * 앱 데이터를 GitHub에 저장 (자동 커밋)
 * push 전 자동 복구 적용 → 손상 데이터가 절대 올라가지 않음
 * @param appData { projects, sources, uiComponents, tokenSets }
 * @param sha 이전 파일의 SHA (업데이트 시 필요)
 * @returns 새 SHA
 */
export async function saveToGitHub(token, repo, branch = "main", appData, sha = null) {
  // 차단이 아닌 자동 복구 — push 전에 손상 문자열을 한글로 재변환
  const clean = repairAppData(appData);

  const content = JSON.stringify(clean, null, 2);
  const now = new Date().toLocaleString("ko-KR");
  const message = `[Artifact Studio] 자동 저장 — ${now}`;
  try {
    const result = await putFile(token, repo, DATA_FILE, content, message, branch, sha);
    return result?.content?.sha ?? null;
  } catch (e) {
    // 빈 레포(브랜치 없음) → sha 없이 재시도
    if (sha && (e.message.includes("409") || e.message.includes("422") || e.message.includes("404"))) {
      const result = await putFile(token, repo, DATA_FILE, content, message, branch, null);
      return result?.content?.sha ?? null;
    }
    throw e;
  }
}
