/**
 * githubCodeFetch.js
 * GitHub public repo에서 컴포넌트 코드 파일 자동 수집
 * 인증 없이 public repo 가능 (rate limit: 60req/h)
 * token 있으면 5000req/h
 */

import { toRenderCode } from './codeUtils.js';

const GITHUB_API = 'https://api.github.com';

// 수집할 파일 확장자
const TARGET_EXTS = /\.(js|jsx|ts|tsx|vue|svelte|css|scss|html)$/i;
// 스킵할 경로
const SKIP_PATHS = /node_modules|\.test\.|\.spec\.|__tests__|dist\/|build\/|\.storybook|jest\.config|babel\.config|vite\.config|webpack\.config|rollup\.config|\.d\.ts$|\.min\.|index\.d\.|tsconfig|\.eslint|prettier/i;
// 컴포넌트일 가능성 높은 경로
const COMPONENT_PATHS = /components?|ui|atoms?|molecules?|organisms?|blocks?|widgets?|pages?|views?|layouts?/i;

/**
 * GitHub URL → { owner, repo, branch?, subPath? } 파싱
 */
export function parseGithubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/?\s#]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ''), branch: m[3] || null, subPath: m[4] || '' };
}

/**
 * repo 기본 브랜치 조회
 */
async function getDefaultBranch(owner, repo, token) {
  const r = await ghFetch(`/repos/${owner}/${repo}`, token);
  return r.default_branch || 'main';
}

/**
 * GitHub API fetch 헬퍼
 */
async function ghFetch(path, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      const resetEpoch = res.headers.get('x-ratelimit-reset');
      const resetTime = resetEpoch ? new Date(Number(resetEpoch) * 1000).toLocaleTimeString() : '잠시 후';
      throw new Error(`GitHub API 한도 초과 (60req/h). ${resetTime}에 초기화됩니다. PAT 토큰을 입력하면 5000req/h로 늘어납니다.`);
    }
    throw new Error(`GitHub API ${res.status}: ${path}`);
  }
  return res.json();
}

/**
 * 파일 내용 fetch (base64 디코딩)
 */
async function fetchFileContent(owner, repo, filePath, token) {
  const data = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`, token);
  if (data.encoding === 'base64') {
    return atob(data.content.replace(/\n/g, ''));
  }
  return data.content || '';
}

/**
 * Git Trees API로 파일 목록 수집 (요청 1번, rate limit 절약)
 * recursive=1 → 전체 트리 flat list
 */
async function listFilesViaTree(owner, repo, branch, token, subPath = '') {
  const tree = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
  if (!tree?.tree) return [];
  return tree.tree
    .filter(item =>
      item.type === 'blob' &&
      TARGET_EXTS.test(item.path) &&
      !SKIP_PATHS.test(item.path) &&
      (!subPath || item.path.startsWith(subPath))
    )
    .map(item => ({ path: item.path, name: item.path.split('/').pop(), sha: item.sha }));
}

/**
 * GitHub repo에서 컴포넌트 코드 수집
 * @param {string} repoUrl - GitHub URL
 * @param {string} [token] - GitHub PAT (선택)
 * @param {object} opts
 * @param {number} opts.maxFiles - 최대 파일 수 (기본 20)
 * @param {number} opts.maxCharsPerFile - 파일당 최대 글자 (기본 3000)
 * @returns {Promise<{files: {path, content}[], repoInfo: string}>}
 */
export async function fetchGithubComponents(repoUrl, token = null, opts = {}) {
  const { maxFiles = 20, maxCharsPerFile = 20000 } = opts;

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) throw new Error(`GitHub URL 파싱 실패: ${repoUrl}`);
  const { owner, repo, subPath } = parsed;

  // 브랜치 조회
  const branch = await getDefaultBranch(owner, repo, token);

  // Git Trees API로 파일 목록 1번에 수집
  let allFiles = await listFilesViaTree(owner, repo, branch, token, subPath || '');

  // 컴포넌트 경로 우선 정렬
  allFiles.sort((a, b) => (COMPONENT_PATHS.test(a.path) ? 0 : 1) - (COMPONENT_PATHS.test(b.path) ? 0 : 1));

  // 최대 파일 수 제한
  const targetFiles = allFiles.slice(0, maxFiles);

  // 파일 내용 fetch (병렬, 최대 8개씩)
  const results = [];
  for (let i = 0; i < targetFiles.length; i += 8) {
    const batch = targetFiles.slice(i, i + 8);
    const contents = await Promise.all(
      batch.map(async f => {
        try {
          const content = await fetchFileContent(owner, repo, f.path, token);
          return { path: f.path, content: content.slice(0, maxCharsPerFile) };
        } catch {
          return null;
        }
      })
    );
    results.push(...contents.filter(Boolean));
  }

  const repoInfo = `GitHub: ${owner}/${repo} (${results.length}개 파일)`;
  return { files: results, repoInfo };
}

/**
 * URL이 GitHub URL인지 판별
 */
export function isGithubUrl(url) {
  return /github\.com\/[^/]+\/[^/?\s#]+/.test(url);
}

/**
 * CodePen URL인지 판별
 */
export function isCodepenUrl(url) {
  return /codepen\.io\/[^/]+\/(pen|full|details)\//.test(url);
}

/**
 * CodeSandbox URL인지 판별
 */
export function isCodesandboxUrl(url) {
  return /codesandbox\.io\/(s|embed|p\/sandbox)\//.test(url);
}

/**
 * Reddit/HackerNews URL인지 판별
 */
export function isCommunityUrl(url) {
  return /reddit\.com\/|news\.ycombinator\.com\/|news\.hada\.io\//.test(url);
}

/**
 * CodePen에서 코드 추출
 * Jina로 페이지 읽어 코드 블록 추출
 */
async function fetchCodepen(url) {
  // codepen.io/{user}/pen/{id} → normalize
  const m = url.match(/codepen\.io\/([^/]+)\/(pen|full|details)\/([^/?#]+)/);
  if (!m) return null;
  const [, user, , id] = m;

  // Jina로 CodePen 페이지 읽기 (HTML embed도 텍스트 추출 가능)
  const jinaUrl = `https://r.jina.ai/https://codepen.io/${user}/pen/${id}`;
  const r = await fetch(jinaUrl, { headers: { Accept: 'text/plain' } });
  if (!r.ok) return null;
  const txt = await r.text();

  // 코드 블록 추출
  const blocks = extractCodeBlocks(txt);
  if (blocks.length === 0) return { path: `codepen/${user}/${id}`, content: txt.slice(0, 2000) };

  return blocks.map((b, i) => ({
    path: `codepen/${user}/${id}/${b.lang || 'code'}_${i + 1}.${langToExt(b.lang)}`,
    content: b.code.slice(0, 3000),
  }));
}

/**
 * CodeSandbox에서 파일 추출 (공개 API)
 */
async function fetchCodesandbox(url) {
  const m = url.match(/codesandbox\.io\/(?:s|embed|p\/sandbox)\/([^/?#]+)/);
  if (!m) return null;
  const id = m[1];

  try {
    const res = await fetch(`https://codesandbox.io/api/v1/sandboxes/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const modules = data?.data?.modules || data?.modules || [];
    return modules
      .filter(mod => /\.(jsx?|tsx?|css|html|vue|svelte)$/.test(mod.title || ''))
      .slice(0, 15)
      .map(mod => ({
        path: `codesandbox/${id}/${mod.title}`,
        content: (mod.code || '').slice(0, 3000),
      }));
  } catch {
    // API 실패 시 Jina fallback
    const r = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } });
    if (!r.ok) return null;
    const txt = await r.text();
    const blocks = extractCodeBlocks(txt);
    return blocks.length > 0
      ? blocks.slice(0, 8).map((b, i) => ({
          path: `codesandbox/${id}/${b.lang || 'code'}_${i + 1}.${langToExt(b.lang)}`,
          content: b.code.slice(0, 3000),
        }))
      : [{ path: `codesandbox/${id}/page.txt`, content: txt.slice(0, 2000) }];
  }
}

/**
 * Reddit/HN/HaDA 페이지에서 코드 블록 추출
 * Jina로 본문 읽어 ``` 블록 파싱
 */
async function fetchCommunityCode(url) {
  const r = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } });
  if (!r.ok) return null;
  const txt = await r.text();
  const blocks = extractCodeBlocks(txt);
  if (blocks.length === 0) {
    // 코드 블록 없으면 전체 텍스트 (요약 목적)
    return [{ path: 'community/page.txt', content: txt.slice(0, 3000) }];
  }
  const site = url.includes('reddit') ? 'reddit' : url.includes('ycombinator') ? 'hn' : 'community';
  return blocks.slice(0, 10).map((b, i) => ({
    path: `${site}/${b.lang || 'code'}_${i + 1}.${langToExt(b.lang)}`,
    content: b.code.slice(0, 3000),
  }));
}

/**
 * 마크다운 텍스트에서 ``` 코드 블록 추출
 */
function extractCodeBlocks(text) {
  const blocks = [];
  const re = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const lang = m[1].toLowerCase() || 'text';
    const code = m[2].trim();
    if (code.length > 30) blocks.push({ lang, code });
  }
  return blocks;
}

/**
 * 언어 → 파일 확장자
 */
function langToExt(lang) {
  const map = { javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx',
    css: 'css', scss: 'scss', html: 'html', vue: 'vue', svelte: 'svelte', python: 'py', bash: 'sh', text: 'txt' };
  return map[lang] || lang || 'txt';
}

/**
 * 여러 URL 처리 — 소스별 라우팅
 * GitHub → GitHub API 코드 파일 수집
 * CodePen → Jina 페이지 + 코드 블록 추출
 * CodeSandbox → 공개 API or Jina fallback
 * Reddit/HN/HaDA → Jina 본문 + 코드 블록 추출
 * 기타 → Jina Reader 텍스트
 * @returns {Promise<string>} 합쳐진 소스 컨텐츠 (max 20000자)
 */
export async function fetchAllSources(urls, githubToken = null) {
  const parts = [];

  for (const url of urls.slice(0, 8)) {
    try {
      if (isGithubUrl(url)) {
        // GitHub API로 코드 파일 직접 수집
        const { files, repoInfo } = await fetchGithubComponents(url, githubToken, { maxFiles: 15 });
        parts.push(`\n\n=== ${repoInfo} ===`);
        for (const f of files) {
          parts.push(`\n--- ${f.path} ---\n${f.content}`);
        }

      } else if (isCodepenUrl(url)) {
        // CodePen 코드 추출
        const result = await fetchCodepen(url);
        if (result) {
          const files = Array.isArray(result) ? result : [result];
          parts.push(`\n\n=== CodePen: ${url} (${files.length}개 파일) ===`);
          for (const f of files) {
            parts.push(`\n--- ${f.path} ---\n${f.content}`);
          }
        }

      } else if (isCodesandboxUrl(url)) {
        // CodeSandbox 파일 추출
        const files = await fetchCodesandbox(url);
        if (files && files.length > 0) {
          parts.push(`\n\n=== CodeSandbox: ${url} (${files.length}개 파일) ===`);
          for (const f of files) {
            parts.push(`\n--- ${f.path} ---\n${f.content}`);
          }
        }

      } else if (isCommunityUrl(url)) {
        // Reddit/HN/HaDA: Jina + 코드 블록 파싱
        const files = await fetchCommunityCode(url);
        if (files && files.length > 0) {
          const hasCode = files.some(f => !f.path.endsWith('.txt'));
          parts.push(`\n\n=== 커뮤니티: ${url} (${hasCode ? `코드 ${files.length}개` : '텍스트'}) ===`);
          for (const f of files) {
            parts.push(`\n--- ${f.path} ---\n${f.content}`);
          }
        }

      } else {
        // 일반 URL → Jina Reader 텍스트
        const r = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } });
        if (r.ok) {
          const txt = await r.text();
          // 텍스트 내 코드 블록도 추출
          const blocks = extractCodeBlocks(txt);
          if (blocks.length > 0) {
            parts.push(`\n\n=== ${url} (코드 블록 ${blocks.length}개) ===`);
            for (const b of blocks.slice(0, 6)) {
              parts.push(`\n\`\`\`${b.lang}\n${b.code.slice(0, 2000)}\n\`\`\``);
            }
          } else {
            parts.push(`\n\n=== ${url} ===\n${txt.slice(0, 3000)}`);
          }
        }
      }
    } catch (e) {
      parts.push(`\n\n=== ${url} (수집 실패: ${e.message}) ===`);
    }
  }

  return parts.join('').slice(0, 20000);
}

// ─── 코드 기반 직접 분류 (Claude API 불필요) ──────────────────────────────

const EXT_LEVEL = { jsx: 2, tsx: 2, vue: 2, svelte: 2, js: 2, ts: 2, css: 5, scss: 5, html: 2 };
const PATH_LEVEL = {
  atom: 3, atoms: 3, primitive: 3, primitives: 3,
  token: 5, tokens: 5, theme: 5, variables: 5,
  component: 2, components: 2, ui: 2,
  section: 1, sections: 1, layout: 1, layouts: 1,
  page: 0, pages: 0, view: 0, views: 0,
};

/**
 * 파일 경로 + 코드 내용으로 granularity_level 결정
 */
function inferLevel(filePath, code) {
  const parts = filePath.toLowerCase().split('/');
  for (const part of parts) {
    if (PATH_LEVEL[part] !== undefined) return PATH_LEVEL[part];
  }
  const ext = filePath.match(/\.(\w+)$/)?.[1]?.toLowerCase();
  if (ext === 'css' || ext === 'scss') {
    // CSS 변수가 많으면 token
    if ((code.match(/--[\w-]+:/g) || []).length >= 3) return 5;
  }
  if (ext === 'js' || ext === 'ts') {
    // export const colors/spacing/typography 패턴 → token
    if (/export\s+(const|default)\s+(colors|spacing|typography|tokens|theme|radius|shadows)/i.test(code)) return 5;
  }
  return EXT_LEVEL[ext] || 2;
}

/**
 * granularity_level → 문자열
 */
function levelToGranularity(level) {
  return ['page', 'section', 'component', 'atom', 'element', 'token', 'visual_asset'][level] || 'component';
}

/**
 * 코드에서 토큰 타입 추정 (level=5일 때)
 */
function inferTokenType(filePath, code) {
  const f = filePath.toLowerCase();
  if (/color|colour|palette/.test(f) || /#[0-9a-f]{3,6}/i.test(code)) return 'color';
  if (/typo|font|text/.test(f) || /font-size|font-weight|font-family/.test(code)) return 'typography';
  if (/spacing|gap|margin|padding/.test(f)) return 'spacing';
  if (/radius|round/.test(f) || /border-radius/.test(code)) return 'radius';
  if (/shadow/.test(f) || /box-shadow/.test(code)) return 'shadow';
  return 'css';
}

/**
 * 파일 목록 → 카탈로그 노드 배열 (AI 불필요)
 * @param {{path, content}[]} files
 * @param {string} sourceUrl
 * @returns {{originId: string, nodes: object[]}}
 */
export function filesToCatalogNodes(files, sourceUrl) {
  const now = Date.now();
  const originId = `org_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const nodes = files.map((f) => {
    const level = inferLevel(f.path, f.content);
    const granularity = levelToGranularity(level);
    const ext = f.path.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
    const name = f.path.split('/').pop().replace(/\.\w+$/, '');
    const node = {
      node_id: `nd_${now}_${Math.random().toString(36).slice(2, 7)}`,
      origin_id: originId,
      granularity,
      granularity_level: level,
      category_path: `${granularity}/${ext}`,
      name,
      name_en: name,
      type: granularity,
      subtype: ext,
      code: f.content,
      ...(() => { const r = toRenderCode(f.content); return { render_code: r.render_code, render_type: r.render_type }; })(),
      value: null,
      token_type: level === 5 ? inferTokenType(f.path, f.content) : null,
      asset_format: null,
      parent_id: null,
      parent_chain: [],
      child_ids: [],
      tags: [ext, ...f.path.split('/').slice(0, -1)].filter(Boolean),
      pool_targets: level === 5 ? ['token_pool'] : level === 3 ? ['atom_pool'] : ['component_pool'],
      confidence: 0.75,
      inferred: false,
      source_url: sourceUrl,
      source_kind: 'github',
    };
    return node;
  });
  return { originId, nodes };
}

/**
 * URL 목록에서 파일 수집 → 카탈로그 노드 변환 (AI 없이)
 * @param {string[]} urls
 * @param {string|null} githubToken
 * @param {(msg: string) => void} onProgress
 * @returns {Promise<{originId, nodes}[]>}
 */
export async function collectDirectly(urls, githubToken = null, onProgress = () => {}) {
  const results = [];

  for (const url of urls.slice(0, 8)) {
    try {
      let files = [];

      if (isGithubUrl(url)) {
        onProgress(`📡 GitHub 수집 중: ${url.split('/').slice(-2).join('/')}`);
        const { files: f } = await fetchGithubComponents(url, githubToken, { maxFiles: 30 });
        files = f;

      } else if (isCodepenUrl(url)) {
        onProgress(`📡 CodePen 수집 중...`);
        const r = await fetchCodepen(url);
        files = r ? (Array.isArray(r) ? r : [r]) : [];

      } else if (isCodesandboxUrl(url)) {
        onProgress(`📡 CodeSandbox 수집 중...`);
        const r = await fetchCodesandbox(url);
        files = r || [];

      } else if (isCommunityUrl(url)) {
        onProgress(`📡 커뮤니티 페이지 수집 중...`);
        const r = await fetchCommunityCode(url);
        files = (r || []).filter(f => !f.path.endsWith('.txt'));

      } else {
        onProgress(`📡 페이지 수집 중: ${url.slice(0, 40)}`);
        const r = await fetchCommunityCode(url);
        files = (r || []).filter(f => !f.path.endsWith('.txt'));
      }

      if (files.length > 0) {
        results.push(filesToCatalogNodes(files, url));
      }
    } catch (e) {
      console.warn('수집 실패:', url, e.message);
    }
  }

  return results;
}

// ─── 주제 기반 GitHub Code Search ─────────────────────────────────────────

// 도메인 → 영어 검색어 매핑
const DOMAIN_EN = {
  '게임': 'game',      '헬스': 'health',    '피트니스': 'fitness',
  '쇼핑': 'shop',      '커머스': 'commerce', '소셜': 'social',
  '대시보드': 'dashboard','음악': 'music',   '미디어': 'media',
  '금융': 'finance',   '핀테크': 'fintech',  '여행': 'travel',
  '음식': 'food',      '교육': 'education',  '의료': 'medical',
  '채팅': 'chat',      '뉴스': 'news',       '날씨': 'weather',
};

const STYLE_TERMS = {
  '글래스모피즘': 'glassmorphism glass blur',
  '뉴모피즘': 'neumorphism soft shadow',
  '다크 모던': 'dark modern',
  '미니멀': 'minimal clean',
  '라이트 클린': 'light clean',
};

/**
 * 주제/도메인/스타일로 GitHub Code Search → 파일 수집 → 카탈로그 노드
 * @param {object} opts
 * @param {string[]} opts.domains  - 도메인 배열 (한국어)
 * @param {string[]} opts.styles   - 스타일 배열
 * @param {string[]} opts.materials - 수집 재료 배열
 * @param {string|null} githubToken
 * @param {(msg: string) => void} onProgress
 * @returns {Promise<{originId, nodes}[]>}
 */
export async function collectByTopic({ domains = [], styles = [], materials = [], expandedTerms = [] }, githubToken = null, onProgress = () => {}) {
  const results = [];

  // 검색어 조합
  const domainTerms = domains.map(d => DOMAIN_EN[d] || d).filter(Boolean);
  const styleTerms = styles.flatMap(s => (STYLE_TERMS[s] || s).split(' ')).filter(Boolean);
  const allTerms = [...new Set([...domainTerms, ...styleTerms.slice(0, 2), ...expandedTerms.slice(0, 4)])];
  if (allTerms.length === 0) return results;

  // 검색 쿼리 세트 구성
  const baseQ = allTerms.slice(0, 4).join('+');
  const queries = [
    `${baseQ}+react+ui+component`,
    `${domainTerms.join('+')}+ui+react`,
    ...(expandedTerms.slice(0, 2).map(t => `${t.replace(/ /g, '+')}+react`)),
  ];

  const seenRepos = new Set();

  for (const q of queries.slice(0, 3)) {
    try {
      onProgress(`🔍 "${allTerms.slice(0, 3).join(', ')}" 관련 레포 검색 중...`);
      // /search/repositories 는 인증 없이 사용 가능
      const encoded = encodeURIComponent(q);
      const data = await ghFetch(`/search/repositories?q=${encoded}&sort=stars&per_page=5`, githubToken);
      const repos = (data?.items || []).filter(r => !seenRepos.has(r.full_name));

      for (const repo of repos.slice(0, 3)) {
        seenRepos.add(repo.full_name);
        try {
          onProgress(`📦 ${repo.full_name} 파일 수집 중...`);
          const branch = repo.default_branch || 'main';
          const tree = await ghFetch(`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`, githubToken);
          const fileItems = (tree?.tree || [])
            .filter(f => f.type === 'blob' && TARGET_EXTS.test(f.path) && !SKIP_PATHS.test(f.path) && COMPONENT_PATHS.test(f.path))
            .slice(0, 8);

          const files = [];
          for (const f of fileItems) {
            try {
              const [owner, repoName] = repo.full_name.split('/');
              const content = await fetchFileContent(owner, repoName, f.path, githubToken);
              files.push({ path: `${repo.full_name}/${f.path}`, content: content.slice(0, 20000) });
            } catch { /* 스킵 */ }
          }

          if (files.length > 0) {
            const batch = filesToCatalogNodes(files, `github-topic:${repo.full_name}`);
            for (const node of batch.nodes) {
              node.tags = [...(node.tags || []), ...domains];
              node.domain = domains[0] || '';
            }
            results.push(batch);
          }
        } catch (e) {
          if (e.message.includes('한도 초과')) throw e;
          console.warn(`레포 수집 실패 ${repo.full_name}:`, e.message);
        }
      }
    } catch (e) {
      if (e.message.includes('한도 초과')) throw e;
      console.warn('레포 검색 실패:', e.message);
    }
  }

  return results;
}
