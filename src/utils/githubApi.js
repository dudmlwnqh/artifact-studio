// GitHub REST API v3 래퍼 (fetch 기반, 외부 라이브러리 없음)

const API_BASE = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
}

// 파일 읽기 — { content (decoded), sha, path, size }
export async function getFile(token, repo, path, branch = "main") {
  const url = `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub getFile failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const raw = atob(data.content.replace(/\n/g, ""));
  let content;
  try { content = decodeURIComponent(escape(raw)); } catch { content = raw; }
  return {
    content,
    sha: data.sha,
    path: data.path,
    size: data.size,
  };
}

// 파일 생성/수정 + 커밋 — { sha, commit }
export async function putFile(token, repo, path, content, message, branch = "main", sha = null) {
  const url = `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub putFile failed: ${res.status} ${err.message || res.statusText}`);
  }
  return await res.json();
}

// 디렉토리 목록 — [{ name, path, type, sha, size }]
export async function listFiles(token, repo, path = "", branch = "main") {
  const url = `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`GitHub listFiles failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [data];
  return data.map((f) => ({
    name: f.name,
    path: f.path,
    type: f.type,
    sha: f.sha,
    size: f.size,
  }));
}

// 여러 파일을 한 번에 커밋 (Trees + Commits API)
export async function commitMultipleFiles(token, repo, files, message, branch = "main") {
  const h = headers(token);

  // 1. 현재 브랜치의 최신 커밋 SHA 가져오기
  const refRes = await fetch(`${API_BASE}/repos/${repo}/git/ref/heads/${branch}`, { headers: h });
  if (!refRes.ok) throw new Error(`Failed to get ref: ${refRes.status}`);
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 2. 현재 커밋의 트리 SHA 가져오기
  const commitRes = await fetch(`${API_BASE}/repos/${repo}/git/commits/${latestCommitSha}`, { headers: h });
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. 새 트리 생성 (파일들)
  const tree = files.map((f) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    content: f.content,
  }));

  const treeRes = await fetch(`${API_BASE}/repos/${repo}/git/trees`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
  const treeData = await treeRes.json();

  // 4. 새 커밋 생성
  const newCommitRes = await fetch(`${API_BASE}/repos/${repo}/git/commits`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [latestCommitSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`);
  const newCommitData = await newCommitRes.json();

  // 5. 브랜치 ref 업데이트
  const updateRefRes = await fetch(`${API_BASE}/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error(`Failed to update ref: ${updateRefRes.status}`);

  return { sha: newCommitData.sha, message };
}

// 레포의 브랜치 목록
export async function listBranches(token, repo) {
  const res = await fetch(`${API_BASE}/repos/${repo}/branches`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to list branches: ${res.status}`);
  const data = await res.json();
  return data.map((b) => b.name);
}

// 토큰 유효성 검사 (사용자 정보 반환)
export async function validateToken(token) {
  const res = await fetch(`${API_BASE}/user`, { headers: headers(token) });
  if (!res.ok) return null;
  const data = await res.json();
  return { login: data.login, name: data.name, avatar: data.avatar_url };
}
