// Supabase REST API 래퍼 (fetch 기반, 외부 라이브러리 없음)
//
// ── 필요한 SQL (Supabase SQL Editor에서 실행) ──
//
// -- 테이블 생성 (처음 한 번만)
// create table public.snapshots (
//   id uuid default gen_random_uuid() primary key,
//   created_at timestamptz default now() not null,
//   label text not null,
//   project_tag text not null default '전체',
//   data jsonb not null
// );
// alter table public.snapshots enable row level security;
// create policy "anon_all" on public.snapshots
//   for all to anon using (true) with check (true);
//
// -- 기존 테이블에 project_tag 컬럼 추가 (이미 만들었으면 이것만)
// alter table public.snapshots
//   add column if not exists project_tag text not null default '전체';

const PROTECTED_TAG = "다른 프로젝트"; // 자동 삭제 제외 태그
const MAX_PER_PROJECT = 30;

function h(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

// 연결 테스트
export async function testConnection(url, key) {
  const res = await fetch(`${url}/rest/v1/snapshots?select=id&limit=1`, {
    headers: h(key),
  });
  if (res.status === 401) throw new Error("인증 실패 — anon key를 확인하세요");
  if (res.status === 404) throw new Error("snapshots 테이블이 없습니다 — SQL을 실행해주세요");
  if (!res.ok) throw new Error(`연결 실패: ${res.status}`);
  return true;
}

// 스냅샷 목록 (최신순, 데이터 제외) — projectTag 없으면 전체
export async function listSnapshots(url, key, projectTag = null) {
  let q = `${url}/rest/v1/snapshots?select=id,label,created_at,project_tag&order=created_at.desc&limit=200`;
  if (projectTag) q += `&project_tag=eq.${encodeURIComponent(projectTag)}`;
  const res = await fetch(q, { headers: h(key) });
  if (!res.ok) throw new Error(`목록 조회 실패: ${res.status}`);
  return await res.json();
}

// 프로젝트별 통계 — [{ project_tag, count, last_at }]
export async function getProjectStats(url, key) {
  // 전체 목록에서 클라이언트 집계 (PostgREST GROUP BY 미지원)
  const res = await fetch(
    `${url}/rest/v1/snapshots?select=project_tag,created_at&order=created_at.desc&limit=500`,
    { headers: h(key) }
  );
  if (!res.ok) return [];
  const rows = await res.json();
  const map = {};
  for (const r of rows) {
    if (!map[r.project_tag]) map[r.project_tag] = { project_tag: r.project_tag, count: 0, last_at: null };
    map[r.project_tag].count++;
    if (!map[r.project_tag].last_at) map[r.project_tag].last_at = r.created_at;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// 자동 pruning — "다른 프로젝트" 태그는 제외, 나머지 MAX_PER_PROJECT 유지
async function pruneProjectSnapshots(url, key, projectTag) {
  if (projectTag === PROTECTED_TAG) return;
  const res = await fetch(
    `${url}/rest/v1/snapshots?project_tag=eq.${encodeURIComponent(projectTag)}&select=id,created_at&order=created_at.asc`,
    { headers: h(key) }
  );
  if (!res.ok) return;
  const all = await res.json();
  if (all.length < MAX_PER_PROJECT) return;
  // 새 항목 추가 후 MAX_PER_PROJECT 유지 → 초과분 삭제
  const toDelete = all.slice(0, all.length - MAX_PER_PROJECT + 1);
  await Promise.all(
    toDelete.map((s) =>
      fetch(`${url}/rest/v1/snapshots?id=eq.${s.id}`, { method: "DELETE", headers: h(key) })
    )
  );
}

// 스냅샷 저장 (자동 prune 포함)
export async function saveSnapshot(url, key, label, data, projectTag = "전체") {
  await pruneProjectSnapshots(url, key, projectTag);
  const res = await fetch(`${url}/rest/v1/snapshots`, {
    method: "POST",
    headers: h(key),
    body: JSON.stringify({ label, data, project_tag: projectTag }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`저장 실패: ${res.status} ${err.message || ""}`);
  }
  const rows = await res.json();
  return rows[0] ?? null;
}

// 스냅샷 불러오기 (data 포함)
export async function loadSnapshot(url, key, id) {
  const res = await fetch(
    `${url}/rest/v1/snapshots?id=eq.${id}&select=*`,
    { headers: h(key) }
  );
  if (!res.ok) throw new Error(`불러오기 실패: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

// 스냅샷 삭제
export async function deleteSnapshot(url, key, id) {
  const res = await fetch(`${url}/rest/v1/snapshots?id=eq.${id}`, {
    method: "DELETE",
    headers: h(key),
  });
  if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
}

export { PROTECTED_TAG, MAX_PER_PROJECT };
