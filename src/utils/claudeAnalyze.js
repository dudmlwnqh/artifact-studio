/**
 * claudeAnalyze.js
 * Claude API로 HTML/JSX 코드 분석 → 카탈로그 노드 배열 반환
 * 브라우저에서 직접 호출 (로컬 개발 도구 전용)
 */

import { toRenderCode } from './codeUtils.js';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `당신은 UI 컴포넌트 분석 전문가입니다.
주어진 HTML/JSX 코드를 분석하여 컴포넌트, 원자, 토큰, 에셋을 추출하고 JSON으로 반환하세요.

반환 형식 (JSON만 반환, 설명 없음):
{
  "nodes": [
    {
      "granularity": "page|section|component|atom|element|token|visual_asset",
      "granularity_level": 0~6,
      "name": "한글 이름",
      "name_en": "English name",
      "type": "button|input|card|nav|modal|section|token|...",
      "subtype": "세부 타입",
      "category_path": "atoms/button/primary",
      "code": "해당 컴포넌트 코드 (최대 500자)",
      "value": "토큰값 (토큰일 경우)",
      "token_type": "color|typography|spacing|radius|shadow|transition (토큰일 경우)",
      "asset_format": "CSS|SVG|PNG|Lottie (에셋일 경우)",
      "subtype": "texture|illustration|icon_illust|brand_mark|character|lottie (에셋일 경우)",
      "tags": ["태그1", "태그2"],
      "reusable": true|false,
      "confidence": 0.0~1.0,
      "domain": "game|health|commerce|social|dashboard|..."
    }
  ]
}

granularity_level 기준:
- 0=page (전체 화면)
- 1=section (헤더, 히어로, 푸터 등 대형 블록)
- 2=component (카드, 모달, 네비바 등)
- 3=atom (버튼, 인풋, 뱃지 등 최소 UI)
- 4=element (아이콘, 레이블, 구분선)
- 5=token (컬러값, 폰트크기, 간격, border-radius 등 디자인 변수)
- 6=visual_asset (텍스처, 일러스트, SVG, Lottie)

규칙:
- 모든 granularity 레벨에서 동시에 추출 (page도, atom도, token도 한번에)
- 같은 코드에서 여러 레벨 노드 생성 가능
- 반복되는 색상값, 간격값은 token으로 추출
- confidence는 확실하면 0.9, 추론이면 0.6~0.7
- JSON 외 어떤 텍스트도 출력하지 말 것`;

/**
 * HTML/JSX 코드를 Claude API로 분석
 * @param {string} code - 분석할 코드
 * @param {string} apiKey - Anthropic API key
 * @param {object} meta - { name, domain, source }
 * @returns {Promise<{nodes: Node[]}>}
 */
export async function analyzeWithClaude(code, apiKey, meta = {}) {
  if (!apiKey?.trim()) throw new Error('API 키가 없습니다');
  if (!code?.trim()) throw new Error('코드가 비어있습니다');

  const userMessage = [
    meta.name && `컴포넌트 이름: ${meta.name}`,
    meta.domain && `도메인: ${meta.domain}`,
    `\n코드:\n\`\`\`\n${code.slice(0, 12000)}\n\`\`\``,
  ].filter(Boolean).join('\n');

  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-client': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API 오류 ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // JSON 파싱 — 코드블록 제거 후 파싱
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // JSON 부분만 추출 시도
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude 응답을 파싱할 수 없습니다');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.nodes)) throw new Error('nodes 배열이 없습니다');
  return parsed;
}

/**
 * LLM으로 주제/스타일 → 유사 주제어·컨셉 확장
 * GitHub Code Search 검색어로 활용
 * @param {string[]} domains
 * @param {string[]} styles
 * @param {string} apiKey
 * @returns {Promise<string[]>} 영어 검색어 배열
 */
export async function expandTopicsWithLLM(domains, styles, apiKey) {
  if (!apiKey?.trim()) return [];
  const prompt = `다음 UI 도메인과 스타일에 어울리는 GitHub 코드 검색어를 생성해줘.
도메인: ${domains.join(', ') || '(없음)'}
스타일: ${styles.join(', ') || '(없음)'}

조건:
- 영어로만
- 유사 주제어, 관련 컨셉, 세부 UI 요소 포함
- GitHub Code Search에서 실제 JSX/CSS 파일을 찾기 좋은 키워드
- 최대 12개, 짧게 (2~3단어)
- JSON 배열만 반환, 설명 없음

예: ["game inventory", "health tracker card", "glassmorphism button", "rpg hud component"]`;

  try {
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-client': 'true' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || '[]');
  } catch {
    return [];
  }
}

/**
 * Claude 분석 결과 → catalogParser 형식으로 변환
 */
export function claudeResultToParsed(result, meta = {}) {
  const originId = `org_claude_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const genId = () => `nd_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  const nodes = (result.nodes || []).map(n => {
    const node_id = genId();
    return {
      node_id,
      origin_id: originId,
      granularity: n.granularity || 'component',
      granularity_level: n.granularity_level ?? 2,
      category_path: n.category_path || '',
      name: n.name || '',
      name_en: n.name_en || '',
      type: n.type || '',
      subtype: n.subtype || '',
      code: (n.code || '').slice(0, 20000),
      ...(() => { const r = toRenderCode((n.code || '').slice(0, 20000)); return { render_code: r.render_code, render_type: r.render_type }; })(),
      value: n.value || '',
      token_type: n.token_type || '',
      asset_format: n.asset_format || '',
      asset_url: n.asset_url || '',
      parent_id: null,
      parent_chain: [],
      child_ids: [],
      tags: n.tags || [],
      search_keys: [n.name, n.name_en, n.type, ...(n.tags || [])].filter(Boolean),
      domain: n.domain || meta.domain || '',
      reusable: n.reusable ?? true,
      observed: true,
      inferred: (n.confidence ?? 0.8) < 0.7,
      confidence: n.confidence ?? 0.8,
      source_refs: [],
      pool_targets: ['component_pool'],
      created_at: Date.now(),
    };
  });

  return { originId, nodes };
}
