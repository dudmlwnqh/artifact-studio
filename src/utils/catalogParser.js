/**
 * catalogParser.js
 * 하나의 소스(JSX/HTML/코드) → 6개 granularity 레벨에 동시 저장
 *
 * granularity_level:
 *   0 = page       (전체 — 안 쪼갠 버전)
 *   1 = section    (대형 블록 — 덜 쪼갠 버전)
 *   2 = component  (카드, 모달, 네비바 등)
 *   3 = atom       (버튼, 인풋, 뱃지 등)
 *   4 = element    (아이콘, 레이블, 구분선 등)
 *   5 = token      (컬러, 타이포, 간격 — foundation)
 *   6 = visual_asset (텍스처, 일러스트, Lottie 등)
 */
import { toRenderCode } from './codeUtils.js';

// ─────────────────────────────────────────────
// ID 생성
// ─────────────────────────────────────────────
function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────
// Pool 자동 배정 (type 기반)
// ─────────────────────────────────────────────
function assignPools(type = '', granularity = '') {
  const t = type.toLowerCase();
  const pools = ['component_pool'];
  if (/button|cta|fab|icon.?button|action/.test(t)) pools.push('button_pool');
  if (/input|textarea|select|switch|checkbox|radio|slider|toggle|field/.test(t)) pools.push('input_pool');
  if (/box|card|slot|panel|section|frame|shell|container/.test(t)) pools.push('box_pool');
  if (/nav|tab|sidebar|topbar|bottombar|breadcrumb|menu|drawer/.test(t)) pools.push('nav_pool');
  if (/modal|sheet|dialog|toast|overlay|popup|alert/.test(t)) pools.push('overlay_pool');
  if (/chart|gauge|graph|timeline|calendar|heatmap|sparkline|progress/.test(t)) pools.push('chart_pool');
  if (/timer|clock|hourglass|countdown|stopwatch|schedule/.test(t)) pools.push('timer_pool');
  if (/texture|pattern|background|gradient|noise|grid.?pattern/.test(t)) pools.push('texture_pool');
  if (/health|sleep|medication|symptom|dosage/.test(t)) pools.push('health_pool');
  if (/game|guild|quest|party|team|battle/.test(t)) pools.push('game_pool');
  if (/cart|booking|product|checkout|shop|order/.test(t)) pools.push('commerce_pool');
  if (/editor|toolbar|rich.?text|spacing.?control|align/.test(t)) pools.push('editor_pool');
  if (/audio|player|waveform|track|brainwave/.test(t)) pools.push('media_pool');
  if (granularity === 'visual_asset') pools.push('texture_pool');
  return [...new Set(pools)];
}

// ─────────────────────────────────────────────
// 노드 생성 헬퍼
// ─────────────────────────────────────────────
function makeNode({
  granularity, granularity_level,
  name = '', name_en = '', type = '', subtype = '',
  category_path = '', code = '', value = '',
  token_type = '', asset_format = '', asset_url = '',
  parent_id = null, parent_chain = [], origin_id,
  tags = [], search_keys = [], domain = '',
  reusable = false, observed = true, confidence = 0.8,
  source_refs = [], inferred = false,
}) {
  const node_id = genId('nd');
  return {
    node_id,
    origin_id,
    granularity,
    granularity_level,
    category_path,
    name,
    name_en,
    type,
    subtype,
    code: code.slice(0, 20000),  // 최대 20KB (원본 — copy-paste용)
    ...(() => { const r = toRenderCode(code.slice(0, 20000)); return { render_code: r.render_code, render_type: r.render_type }; })(),
    value,
    token_type,
    asset_format,
    asset_url,
    parent_id,
    parent_chain: [...parent_chain],
    child_ids: [],
    tags,
    search_keys,
    domain,
    reusable,
    observed,
    inferred,
    confidence,
    source_refs,
    pool_targets: assignPools(type, granularity),
    created_at: Date.now(),
  };
}

// ─────────────────────────────────────────────
// DOM 파서 (브라우저 환경 전용)
// ─────────────────────────────────────────────
function parseHTML(html) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return null;
  try {
    return new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }
}

// JSX → HTML 근사 변환 (간단 전처리)
function jsxToHtml(code) {
  return code
    .replace(/className=/g, 'class=')
    .replace(/\{\/\*.*?\*\/\}/gs, '')
    .replace(/\{[^{}]*\}/g, '"__expr__"')
    .replace(/<>/g, '<div>').replace(/<\/>/g, '</div>');
}

// ─────────────────────────────────────────────
// 1. SECTION 추출
//    기준: <section>, <nav>, <header>, <footer>, <main>,
//           aria-label, aria-region, 전체 너비 최상단 블록
// ─────────────────────────────────────────────
function extractSections(code) {
  const doc = parseHTML(jsxToHtml(code));
  if (!doc) return extractSectionsFallback(code);

  const sectionEls = doc.body.querySelectorAll(
    'section, nav, header, footer, main, [aria-label], [role="region"], [role="navigation"], [role="banner"], [role="contentinfo"]'
  );

  const results = [];
  const visited = new Set();

  sectionEls.forEach(el => {
    // 다른 섹션에 중첩된 경우 스킵
    let p = el.parentElement;
    while (p && p !== doc.body) {
      if (visited.has(p)) return;
      p = p.parentElement;
    }
    visited.add(el);

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || el.getAttribute('aria-label') || tag;
    const name = el.getAttribute('aria-label') || el.querySelector('h1,h2,h3')?.textContent?.slice(0, 40) || role;

    results.push({
      name: `${name} 섹션`,
      name_en: `${name} section`,
      type: inferSectionType(tag, role, el.innerHTML),
      subtype: role,
      code: el.outerHTML,
      tags: inferTags(el.outerHTML, 'section'),
      search_keys: [name, role, tag],
      reusable: false,
    });
  });

  // 섹션을 못 찾으면 최상위 자식들로 나눔
  if (results.length === 0) return extractSectionsFallback(code);
  return results;
}

function extractSectionsFallback(code) {
  // 최상위 div 블록들을 섹션으로 간주
  const topDivs = code.match(/<div[^>]*>[\s\S]{200,}?<\/div>/g) || [];
  return topDivs.slice(0, 6).map((html, i) => ({
    name: `섹션 ${i + 1}`,
    name_en: `Section ${i + 1}`,
    type: inferSectionType('div', '', html),
    subtype: '',
    code: html,
    tags: inferTags(html, 'section'),
    search_keys: [`section ${i + 1}`],
    reusable: false,
  }));
}

function inferSectionType(tag, role, html) {
  const h = html.toLowerCase();
  if (tag === 'nav' || role === 'navigation') return 'navbar';
  if (tag === 'header' || role === 'banner') return 'header';
  if (tag === 'footer' || role === 'contentinfo') return 'footer';
  if (/hero|banner|splash/.test(h)) return 'hero';
  if (/price|pricing|plan|subscription/.test(h)) return 'pricing';
  if (/card.*grid|grid.*card|gallery/.test(h)) return 'card_grid';
  if (/cta|call.?to.?action|sign.?up|get.?started/.test(h)) return 'cta';
  if (/login|signin|auth|email.*password/.test(h)) return 'auth_form';
  if (/search|filter|sort/.test(h)) return 'search_filter';
  if (/profile|avatar|user/.test(h)) return 'profile';
  if (/list|feed|timeline/.test(h)) return 'list';
  return 'section';
}

// ─────────────────────────────────────────────
// 2. COMPONENT 추출
//    기준: 카드 패턴(border-radius+shadow), 폼 그룹,
//           모달, 네비바, 독립 기능 블록
// ─────────────────────────────────────────────
function extractComponents(code) {
  const doc = parseHTML(jsxToHtml(code));
  if (!doc) return [];

  const results = [];
  const visited = new Set();

  // 카드 패턴: border-radius + (box-shadow or border) 가진 div
  doc.body.querySelectorAll('div, article, aside').forEach(el => {
    if (visited.has(el)) return;
    const style = el.getAttribute('style') || '';
    const cls = el.getAttribute('class') || '';
    const combined = (style + cls).toLowerCase();
    if (!isComponentCandidate(combined, el)) return;

    // 너무 작거나 너무 크면 제외
    const innerLen = el.innerHTML.length;
    if (innerLen < 50 || innerLen > 20000) return;

    visited.add(el);
    // 자식 카드 후보들도 visited 처리
    el.querySelectorAll('div, article').forEach(c => visited.add(c));

    const type = inferComponentType(combined, el.innerHTML);
    const name = el.querySelector('h1,h2,h3,h4,.title,.name')?.textContent?.slice(0, 40)
               || el.getAttribute('aria-label')
               || type;

    results.push({
      name: `${name} 컴포넌트`,
      name_en: `${name} component`,
      type,
      subtype: '',
      code: el.outerHTML,
      tags: inferTags(el.outerHTML, 'component'),
      search_keys: [name, type],
      reusable: true,
    });
  });

  return results.slice(0, 12); // 최대 12개
}

function isComponentCandidate(styleAndClass, el) {
  const hasCard = /border-radius|border-radius|rounded|card|modal|panel|dialog/.test(styleAndClass);
  const hasShadow = /box-shadow|shadow/.test(styleAndClass);
  const hasForm = el.querySelectorAll('input, select, textarea, button').length >= 2;
  const isNav = /nav|navigation|menu|tabs?/.test(styleAndClass);
  return hasCard || hasShadow || hasForm || isNav;
}

function inferComponentType(combined, html) {
  const h = (combined + html).toLowerCase();
  if (/modal|dialog/.test(h)) return 'modal';
  if (/drawer|bottom.?sheet/.test(h)) return 'bottom_sheet';
  if (/nav|topbar|appbar|header/.test(h)) return 'top_navbar';
  if (/tab.*bar|bottom.*nav/.test(h)) return 'bottom_tabbar';
  if (/sidebar/.test(h)) return 'sidebar';
  if (/form.*group|form.*card|login.*card|signup.*card/.test(h)) return 'form_group';
  if (/product|item.*price|price.*item/.test(h)) return 'product_card';
  if (/profile.*card|user.*card|avatar.*card/.test(h)) return 'profile_card';
  if (/notification|alert.*card|toast/.test(h)) return 'notification_card';
  if (/list.*item|list.*row|feed.*item/.test(h)) return 'list_item';
  if (/chart|graph|gauge/.test(h)) return 'chart_card';
  if (/stat|metric|kpi|score/.test(h)) return 'stat_card';
  if (/media.*card|image.*card/.test(h)) return 'media_card';
  if (/box-shadow|border-radius/.test(combined)) return 'card';
  return 'component';
}

// ─────────────────────────────────────────────
// 3. ATOM 추출
//    기준: 단일 기능 요소 — button, input, badge,
//           toggle, chip, avatar, icon-button 등
// ─────────────────────────────────────────────
function extractAtoms(code) {
  const doc = parseHTML(jsxToHtml(code));
  if (!doc) return [];

  const results = [];
  const atomSelectors = [
    { sel: 'button:not([disabled])', type: 'button' },
    { sel: '[role="button"]', type: 'button' },
    { sel: 'input', type: 'input' },
    { sel: 'textarea', type: 'textarea' },
    { sel: 'select', type: 'select' },
    { sel: '[role="switch"]', type: 'toggle' },
    { sel: '[role="checkbox"], input[type="checkbox"]', type: 'checkbox' },
    { sel: '[role="radio"], input[type="radio"]', type: 'radio' },
    { sel: 'input[type="range"]', type: 'slider' },
  ];

  atomSelectors.forEach(({ sel, type }) => {
    doc.body.querySelectorAll(sel).forEach(el => {
      const label = el.getAttribute('aria-label') || el.textContent?.slice(0, 30) || el.getAttribute('placeholder') || type;
      const style = el.getAttribute('style') || '';
      const subtype = inferAtomSubtype(type, style, (el.className || ''), label);

      results.push({
        name: `${label.trim() || type}`,
        name_en: label.trim() || type,
        type,
        subtype,
        code: el.outerHTML,
        tags: inferTags(el.outerHTML, 'atom'),
        search_keys: [type, subtype, label.trim()].filter(Boolean),
        reusable: true,
      });
    });
  });

  // badge / chip 패턴: border-radius:99px 또는 pill 모양의 span/div
  doc.body.querySelectorAll('span, div').forEach(el => {
    const style = (el.getAttribute('style') || '').toLowerCase();
    const cls = (el.getAttribute('class') || '').toLowerCase();
    if (/border-radius:\s*(99|999|9999|100)px|border-radius:\s*\d+rem|pill|badge|chip|tag/.test(style + cls)) {
      const text = el.textContent?.slice(0, 20) || '';
      const type = /badge/.test(cls) ? 'badge' : /chip|tag/.test(cls) ? 'chip' : 'badge';
      results.push({
        name: text || type,
        name_en: text || type,
        type,
        subtype: inferAtomSubtype(type, style, cls, text),
        code: el.outerHTML,
        tags: inferTags(el.outerHTML, 'atom'),
        search_keys: [type, text],
        reusable: true,
      });
    }
  });

  return dedupeAtoms(results).slice(0, 20);
}

function inferAtomSubtype(type, style, cls, label) {
  const combined = (style + cls + label).toLowerCase();
  if (type === 'button') {
    if (/primary|submit|confirm|완료|저장|시작|sign.?in|log.?in/.test(combined)) return 'primary_cta';
    if (/secondary|cancel|취소/.test(combined)) return 'secondary';
    if (/ghost|outlined|border/.test(combined)) return 'ghost';
    if (/icon|svg/.test(combined)) return 'icon_button';
    if (/danger|delete|삭제/.test(combined)) return 'danger';
    return 'default';
  }
  if (type === 'input') {
    if (/email/.test(combined)) return 'email_input';
    if (/password/.test(combined)) return 'password_input';
    if (/search|검색/.test(combined)) return 'search_input';
    if (/tel|phone/.test(combined)) return 'phone_input';
    return 'text_input';
  }
  if (type === 'badge') {
    if (/success|green|완료/.test(combined)) return 'success_badge';
    if (/warning|orange|주의/.test(combined)) return 'warning_badge';
    if (/error|red|danger/.test(combined)) return 'error_badge';
    if (/info|blue/.test(combined)) return 'info_badge';
    return 'status_badge';
  }
  return type;
}

function dedupeAtoms(atoms) {
  const seen = new Set();
  return atoms.filter(a => {
    const key = `${a.type}_${a.subtype}_${a.name.slice(0, 15)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// 4. ELEMENT 추출 (atom보다 세밀한 단위)
//    기준: 아이콘, 레이블, 구분선, 아바타, 썸네일
// ─────────────────────────────────────────────
function extractElements(code) {
  const doc = parseHTML(jsxToHtml(code));
  if (!doc) return [];

  const results = [];

  // SVG 아이콘
  doc.body.querySelectorAll('svg').forEach((el, i) => {
    results.push({
      name: el.getAttribute('aria-label') || `아이콘 ${i + 1}`,
      name_en: el.getAttribute('aria-label') || `icon ${i + 1}`,
      type: 'icon',
      subtype: 'svg_icon',
      code: el.outerHTML.slice(0, 500),
      tags: ['icon', 'svg'],
      search_keys: ['icon', 'svg_icon'],
      reusable: true,
    });
  });

  // 이미지/아바타
  doc.body.querySelectorAll('img').forEach(el => {
    const alt = el.getAttribute('alt') || 'image';
    const src = el.getAttribute('src') || '';
    const isAvatar = /avatar|profile|user/.test((el.getAttribute('class') || '') + alt);
    results.push({
      name: alt,
      name_en: alt,
      type: isAvatar ? 'avatar' : 'image',
      subtype: isAvatar ? 'user_avatar' : 'content_image',
      code: el.outerHTML,
      asset_url: src,
      tags: [isAvatar ? 'avatar' : 'image'],
      search_keys: [alt, isAvatar ? 'avatar' : 'image'],
      reusable: isAvatar,
    });
  });

  // 구분선
  doc.body.querySelectorAll('hr, [role="separator"]').forEach(() => {
    results.push({
      name: '구분선',
      name_en: 'divider',
      type: 'divider',
      subtype: 'horizontal_divider',
      code: '<hr/>',
      tags: ['divider', 'separator'],
      search_keys: ['divider', '구분선'],
      reusable: true,
    });
  });

  return results.slice(0, 15);
}

// ─────────────────────────────────────────────
// 5. TOKEN 추출 (foundation layer)
//    기준: CSS 변수, 반복 색상, 반복 간격값, 폰트
// ─────────────────────────────────────────────
export function extractTokens(code) {
  const tokens = [];

  // ① CSS 변수 (--)
  const cssVarPattern = /--([\w-]+)\s*:\s*([^;}"']+)/g;
  let m;
  while ((m = cssVarPattern.exec(code)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    tokens.push({
      name: `--${name}`,
      name_en: `--${name}`,
      type: 'token',
      subtype: '',
      token_type: inferTokenType(name, value),
      value,
      code: `--${name}: ${value}`,
      tags: ['css_variable', inferTokenType(name, value)],
      search_keys: [name, value, inferTokenType(name, value)],
      reusable: true,
      observed: true,
      confidence: 0.95,
    });
  }

  // ② 반복 hex 컬러 (2번 이상 등장)
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  const hexCounts = {};
  while ((m = hexPattern.exec(code)) !== null) {
    const hex = m[0];
    hexCounts[hex] = (hexCounts[hex] || 0) + 1;
  }
  Object.entries(hexCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .forEach(([hex]) => {
      if (tokens.some(t => t.value === hex)) return; // CSS 변수로 이미 추출됨
      tokens.push({
        name: hex,
        name_en: hex,
        type: 'token',
        subtype: '',
        token_type: 'color',
        value: hex,
        code: hex,
        tags: ['color', 'inferred'],
        search_keys: [hex, 'color'],
        reusable: true,
        observed: false,
        confidence: 0.7,
        inferred: true,
      });
    });

  // ③ 반복 spacing (px 값)
  const pxPattern = /\b(\d+)px\b/g;
  const pxCounts = {};
  while ((m = pxPattern.exec(code)) !== null) {
    const v = parseInt(m[1]);
    if (v > 0 && v <= 64) pxCounts[v] = (pxCounts[v] || 0) + 1;
  }
  const spacingCandidates = Object.entries(pxCounts)
    .filter(([, c]) => c >= 3)
    .map(([v]) => parseInt(v))
    .sort((a, b) => a - b)
    .slice(0, 8);
  spacingCandidates.forEach(v => {
    tokens.push({
      name: `spacing-${v}`,
      name_en: `spacing-${v}`,
      type: 'token',
      subtype: '',
      token_type: 'spacing',
      value: `${v}px`,
      code: `${v}px`,
      tags: ['spacing', 'inferred'],
      search_keys: [`${v}px`, 'spacing'],
      reusable: true,
      observed: false,
      confidence: 0.65,
      inferred: true,
    });
  });

  // ④ 반복 border-radius
  const radiusPattern = /border-radius:\s*(\d+)px/g;
  const rCounts = {};
  while ((m = radiusPattern.exec(code)) !== null) {
    const v = m[1];
    rCounts[v] = (rCounts[v] || 0) + 1;
  }
  Object.entries(rCounts)
    .filter(([, c]) => c >= 2)
    .slice(0, 5)
    .forEach(([v]) => {
      tokens.push({
        name: `radius-${v}`,
        name_en: `radius-${v}`,
        type: 'token',
        subtype: '',
        token_type: 'radius',
        value: `${v}px`,
        code: `border-radius: ${v}px`,
        tags: ['radius', 'inferred'],
        search_keys: [`${v}px`, 'border-radius', 'radius'],
        reusable: true,
        observed: false,
        confidence: 0.7,
        inferred: true,
      });
    });

  // ⑤ 반복 font-size
  const fsPattern = /font-size:\s*(\d+)px/g;
  const fsCounts = {};
  while ((m = fsPattern.exec(code)) !== null) {
    const v = m[1];
    fsCounts[v] = (fsCounts[v] || 0) + 1;
  }
  Object.entries(fsCounts)
    .filter(([, c]) => c >= 2)
    .slice(0, 6)
    .forEach(([v]) => {
      tokens.push({
        name: `font-size-${v}`,
        name_en: `font-size-${v}`,
        type: 'token',
        subtype: '',
        token_type: 'typography',
        value: `${v}px`,
        code: `font-size: ${v}px`,
        tags: ['typography', 'font-size', 'inferred'],
        search_keys: [`${v}px`, 'font-size', 'typography'],
        reusable: true,
        observed: false,
        confidence: 0.65,
        inferred: true,
      });
    });

  // ⑥ font-family
  const ffPattern = /font-family:\s*([^;}"']+)/g;
  const families = new Set();
  while ((m = ffPattern.exec(code)) !== null) {
    const ff = m[1].trim().split(',')[0].replace(/['"]/g, '').trim();
    if (ff && !families.has(ff)) {
      families.add(ff);
      tokens.push({
        name: `font-${ff.replace(/\s+/g, '-').toLowerCase()}`,
        name_en: ff,
        type: 'token',
        subtype: '',
        token_type: 'typography',
        value: ff,
        code: `font-family: ${ff}`,
        tags: ['typography', 'font-family', 'inferred'],
        search_keys: [ff, 'font-family', 'typography'],
        reusable: true,
        observed: false,
        confidence: 0.8,
        inferred: true,
      });
    }
  }

  return dedupeTokens(tokens);
}

function inferTokenType(name, value) {
  const n = name.toLowerCase();
  const v = (value || '').toLowerCase();
  if (/color|colour|bg|background|text|fill|stroke|border|primary|secondary|accent|success|warning|danger|error|info/.test(n)) return 'color';
  if (/font|type|text.?size|heading|body|caption/.test(n)) return 'typography';
  if (/space|gap|margin|padding|indent|offset/.test(n)) return 'spacing';
  if (/radius|round|corner/.test(n)) return 'radius';
  if (/shadow|elevation/.test(n)) return 'shadow';
  if (/transition|duration|delay|ease|animation/.test(n)) return 'transition';
  if (/#[0-9a-f]{3,8}/.test(v) || /rgb|hsl/.test(v)) return 'color';
  if (/px|rem|em/.test(v) && /^\d/.test(v.trim())) return 'spacing';
  return 'misc';
}

function dedupeTokens(tokens) {
  const seen = new Set();
  return tokens.filter(t => {
    const key = `${t.token_type}_${t.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// 6. VISUAL ASSET 추출
//    기준: background-image, SVG 독립 블록,
//           Lottie JSON 참조, 그라데이션
// ─────────────────────────────────────────────
// ─── visual_asset subtype 분류 ───────────────
// texture      : 반복 가능한 배경 패턴 (노이즈, 그레인, 도트, 메시 그라데이션, CSS 생성)
// illustration : 고유 장면 이미지 (히어로, 배경 사진, 스톡, 목업, 제품 사진)
// icon_illust  : 일러스트 아이콘
// brand_mark   : 로고, 워드마크, 브랜드 마크
// character    : 마스코트, 감정시트, 아바타 세트, 온보딩 일러스트
// lottie       : Lottie / 모션
function inferAssetSubtype(url = '', code = '') {
  const u = url.toLowerCase();
  const c = code.toLowerCase();
  if (/lottie|\.json|animationdata|motion/i.test(c + u)) return 'lottie';
  if (/logo|brand|wordmark|mark|emblem/i.test(u)) return 'brand_mark';
  if (/character|mascot|avatar|emoji|face|pose|emotion/i.test(u)) return 'character';
  if (/icon|icn|ic_|_ic\.|_icon/i.test(u)) return 'icon_illust';
  if (/texture|noise|grain|pattern|tile|dot|mesh|repeat/i.test(u)) return 'texture';
  if (/illust|illustration|scene|hero|banner|onboard/i.test(u)) return 'illustration';
  // CSS gradient → texture (타일 가능한 패턴)
  if (/repeating-|noise|grain/i.test(c)) return 'texture';
  return 'illustration'; // 기본: 고유 이미지
}

function extractVisualAssets(code) {
  const assets = [];
  let m;

  // CSS 배경 그라데이션 → texture
  const gradPattern = /background(?:-image)?:\s*((?:linear|radial|conic|repeating-linear|repeating-radial)-gradient[^;}"']{10,})/g;
  while ((m = gradPattern.exec(code)) !== null) {
    const isRepeating = /repeating-/.test(m[1]);
    assets.push({
      name: isRepeating ? '반복 패턴 배경' : '그라데이션 배경',
      name_en: isRepeating ? 'repeating pattern' : 'gradient background',
      type: 'visual_asset',
      subtype: 'texture',
      asset_format: 'CSS',
      value: m[1].slice(0, 200),
      tags: ['texture', 'background', isRepeating ? 'pattern' : 'gradient'],
      search_keys: ['gradient', '그라데이션', 'texture', 'background'],
      reusable: true,
    });
  }

  // CSS noise / grain / dot pattern → texture
  if (/noise|grain|dot.?pattern|mesh.?gradient|backdrop.?filter.*blur/i.test(code)) {
    assets.push({
      name: 'CSS 텍스처 패턴',
      name_en: 'CSS texture pattern',
      type: 'visual_asset',
      subtype: 'texture',
      asset_format: 'CSS',
      tags: ['texture', 'pattern', 'noise'],
      search_keys: ['texture', '텍스처', 'noise', 'grain'],
      reusable: true,
    });
  }

  // url() 이미지
  const urlPattern = /url\(['"]?([^'")\s]+\.(png|jpg|jpeg|gif|webp|svg))['"]?\)/gi;
  while ((m = urlPattern.exec(code)) !== null) {
    const url = m[1];
    const ext = m[2].toLowerCase();
    const subtype = inferAssetSubtype(url, code);
    const nameMap = { texture:'텍스처', illustration:'일러스트', icon_illust:'일러스트 아이콘', brand_mark:'브랜드 마크', character:'캐릭터', lottie:'모션' };
    assets.push({
      name: nameMap[subtype] || url.split('/').pop(),
      name_en: url.split('/').pop(),
      type: 'visual_asset',
      subtype,
      asset_format: ext.toUpperCase(),
      asset_url: url,
      value: url,
      tags: [subtype, ext, 'visual_asset'],
      search_keys: [subtype, ext, url.split('/').pop()],
      reusable: subtype === 'texture' || subtype === 'icon_illust' || subtype === 'brand_mark',
    });
  }

  // Lottie / 모션
  if (/lottie|animationData|\.json.*motion|<lottie/i.test(code)) {
    assets.push({
      name: '모션 에셋',
      name_en: 'motion asset',
      type: 'visual_asset',
      subtype: 'lottie',
      asset_format: 'Lottie',
      tags: ['lottie', 'motion', 'animation'],
      search_keys: ['lottie', 'motion', '모션', 'animation'],
      reusable: true,
    });
  }

  // SVG 인라인 — 아이콘/브랜드 마크/캐릭터 구분
  const svgPattern = /<svg[^>]*>([\s\S]{0,600}?)<\/svg>/gi;
  while ((m = svgPattern.exec(code)) !== null) {
    const inner = m[1];
    const subtype = /viewBox|path.*d=|polygon|circle.*r=/.test(inner)
      ? (/text|brand|logo/i.test(inner) ? 'brand_mark' : /face|smile|emotion|char/i.test(inner) ? 'character' : 'icon_illust')
      : 'illustration';
    const nameMap = { icon_illust:'일러스트 아이콘', brand_mark:'브랜드 마크', character:'캐릭터', illustration:'SVG 일러스트' };
    assets.push({
      name: nameMap[subtype],
      name_en: subtype,
      type: 'visual_asset',
      subtype,
      asset_format: 'SVG',
      code: m[0].slice(0, 400),
      tags: [subtype, 'svg', 'visual_asset'],
      search_keys: ['svg', subtype],
      reusable: true,
      confidence: 0.65,
    });
  }

  // 중복 제거 (같은 subtype+value)
  const seen = new Set();
  return assets.filter(a => {
    const key = a.subtype + '|' + (a.value || a.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// 공통 태그 추론
// ─────────────────────────────────────────────
function inferTags(code, level) {
  const c = code.toLowerCase();
  const tags = [level];
  const domainMap = {
    auth: ['login', 'signin', 'signup', 'password', 'email', '로그인', '회원가입'],
    health: ['health', 'sleep', 'medication', 'dosage', 'symptom', '건강', '수면', '복약'],
    ecommerce: ['product', 'cart', 'shop', 'price', 'buy', '상품', '장바구니', '구매'],
    game: ['game', 'guild', 'quest', 'battle', 'score', '게임', '퀘스트'],
    dashboard: ['dashboard', 'stat', 'metric', 'kpi', 'chart', '대시보드'],
    social: ['profile', 'user', 'avatar', 'follow', 'feed', '프로필', '피드'],
  };
  Object.entries(domainMap).forEach(([domain, keywords]) => {
    if (keywords.some(k => c.includes(k))) tags.push(domain);
  });
  if (/dark|다크/.test(c)) tags.push('dark');
  if (/glass|backdrop|blur/.test(c)) tags.push('glassmorphism');
  if (/neumorphism|neu/.test(c)) tags.push('neumorphism');
  return [...new Set(tags)];
}

function inferDomain(code) {
  const c = code.toLowerCase();
  if (/login|signin|password|auth/.test(c)) return 'auth';
  if (/health|sleep|medication|symptom/.test(c)) return 'health';
  if (/product|cart|shop|checkout/.test(c)) return 'ecommerce';
  if (/game|guild|quest|battle/.test(c)) return 'game';
  if (/dashboard|metric|chart|stat/.test(c)) return 'dashboard';
  if (/profile|feed|social/.test(c)) return 'social';
  return 'misc';
}

// ─────────────────────────────────────────────
// 메인 — parseAndDecompose
// ─────────────────────────────────────────────
/**
 * 소스 코드 1개 → 6개 레벨 nodes 동시 생성
 *
 * @param {string} sourceCode   JSX / HTML / CSS 코드
 * @param {object} meta         { name, domain, source_url, source_kind }
 * @returns {{ originId, nodes, pool_indexes }}
 */
export function parseAndDecompose(sourceCode, meta = {}) {
  const originId = genId('org');
  const nodes = [];
  const domain = meta.domain || inferDomain(sourceCode);
  const sourceRef = meta.source_url
    ? [{ url: meta.source_url, kind: meta.source_kind || 'url', evidence: 'imported' }]
    : [];

  // ── 0. PAGE (전체 보존) ──────────────────
  const pageNode = makeNode({
    granularity: 'page',
    granularity_level: 0,
    name: meta.name || `페이지_${Date.now()}`,
    name_en: meta.name || `page_${Date.now()}`,
    type: 'page',
    subtype: domain,
    category_path: `pages/${domain}/${(meta.name || 'unnamed').replace(/\s/g, '_').toLowerCase()}`,
    code: sourceCode,
    origin_id: originId,
    parent_id: null,
    parent_chain: [],
    domain,
    reusable: false,
    observed: true,
    tags: inferTags(sourceCode, 'page'),
    search_keys: [meta.name || 'page', domain, 'page'],
    source_refs: sourceRef,
  });
  nodes.push(pageNode);

  // ── 1. SECTIONS ─────────────────────────
  const sections = extractSections(sourceCode);
  const sectionNodes = sections.map(s => {
    const node = makeNode({
      granularity: 'section',
      granularity_level: 1,
      ...s,
      category_path: `sections/${domain}/${s.type}`,
      origin_id: originId,
      parent_id: pageNode.node_id,
      parent_chain: [pageNode.node_id],
      domain,
      source_refs: sourceRef,
    });
    pageNode.child_ids.push(node.node_id);
    return node;
  });
  nodes.push(...sectionNodes);

  // ── 2. COMPONENTS (섹션 각각에서) ────────
  sectionNodes.forEach(secNode => {
    const comps = extractComponents(secNode.code);
    comps.forEach(c => {
      const compNode = makeNode({
        granularity: 'component',
        granularity_level: 2,
        ...c,
        category_path: `components/${domain}/${c.type}`,
        origin_id: originId,
        parent_id: secNode.node_id,
        parent_chain: [...secNode.parent_chain, secNode.node_id],
        domain,
        source_refs: sourceRef,
      });
      secNode.child_ids.push(compNode.node_id);
      nodes.push(compNode);

      // ── 3. ATOMS (컴포넌트 각각에서) ──────
      const atoms = extractAtoms(compNode.code);
      atoms.forEach(a => {
        const atomNode = makeNode({
          granularity: 'atom',
          granularity_level: 3,
          ...a,
          category_path: `atoms/${a.type}/${a.subtype || a.type}`,
          origin_id: originId,
          parent_id: compNode.node_id,
          parent_chain: [...compNode.parent_chain, compNode.node_id],
          domain,
          source_refs: sourceRef,
        });
        compNode.child_ids.push(atomNode.node_id);
        nodes.push(atomNode);

        // ── 4. ELEMENTS (원자 각각에서) ───────
        const els = extractElements(atomNode.code);
        els.forEach(e => {
          const elNode = makeNode({
            granularity: 'element',
            granularity_level: 4,
            ...e,
            category_path: `elements/${e.type}/${e.subtype || e.type}`,
            origin_id: originId,
            parent_id: atomNode.node_id,
            parent_chain: [...atomNode.parent_chain, atomNode.node_id],
            domain,
            source_refs: sourceRef,
          });
          atomNode.child_ids.push(elNode.node_id);
          nodes.push(elNode);
        });
      });
    });
  });

  // ── 5. TOKENS (전체 소스에서) ─────────────
  const tokenDefs = extractTokens(sourceCode);
  tokenDefs.forEach(t => {
    const tokNode = makeNode({
      granularity: 'token',
      granularity_level: 5,
      ...t,
      category_path: `foundation/${t.token_type}`,
      origin_id: originId,
      parent_id: pageNode.node_id,
      parent_chain: [pageNode.node_id],
      domain,
      source_refs: sourceRef,
    });
    pageNode.child_ids.push(tokNode.node_id);
    nodes.push(tokNode);
  });

  // ── 6. VISUAL ASSETS (전체 소스에서) ──────
  const assetDefs = extractVisualAssets(sourceCode);
  assetDefs.forEach(a => {
    const assetNode = makeNode({
      granularity: 'visual_asset',
      granularity_level: 6,
      ...a,
      category_path: `visual_asset/${a.subtype || 'misc'}`,
      origin_id: originId,
      parent_id: pageNode.node_id,
      parent_chain: [pageNode.node_id],
      domain,
      source_refs: sourceRef,
    });
    pageNode.child_ids.push(assetNode.node_id);
    nodes.push(assetNode);
  });

  // ── pool_indexes ──────────────────────────
  const pool_indexes = buildPoolIndexes(nodes);

  return { originId, nodes, pool_indexes };
}

function buildPoolIndexes(nodes) {
  const indexes = [];
  nodes.forEach(n => {
    (n.pool_targets || []).forEach(pool => {
      indexes.push({
        pool_name: pool,
        item_id: n.node_id,
        item_type: n.type,
        granularity: n.granularity,
        origin_id: n.origin_id,
        name: n.name,
      });
    });
  });
  return indexes;
}

// ─────────────────────────────────────────────
// Handoff JSON (웹 에이전트 출력) → nodes 변환
// ─────────────────────────────────────────────
export function normalizeHandoff(handoffJSON) {
  const meta = {
    name: handoffJSON.topic || 'handoff',
    domain: handoffJSON.domain_hint || inferDomain(JSON.stringify(handoffJSON)),
    source_url: handoffJSON.sources?.[0]?.url || '',
    source_kind: handoffJSON.platform || 'handoff',
  };

  // component_candidates → component nodes (granularity=2)
  // element_candidates   → atom nodes (granularity=3)
  // token_candidates     → token nodes (granularity=5)
  // state_candidates     → token/state 메타

  const originId = genId('org');
  const nodes = [];
  const domain = meta.domain;
  const sourceRef = meta.source_url
    ? [{ url: meta.source_url, kind: meta.source_kind, evidence: 'handoff' }]
    : [];

  // candidate_id → node_id 매핑 (element의 from_candidate_id 연결용)
  const candidateIdMap = {};

  // ── component_candidates → component nodes ──
  (handoffJSON.component_candidates || []).forEach(c => {
    const compNode = makeNode({
      granularity: 'component',
      granularity_level: 2,
      name: c.name_ko || c.name_en || '',
      name_en: c.name_en || '',
      type: c.component_type || 'component',
      subtype: c.subtype || '',
      category_path: `components/${domain}/${c.component_type || 'misc'}`,
      origin_id: originId,
      parent_id: null,
      parent_chain: [],
      domain,
      tags: c.tags || [],
      search_keys: [...(c.search_keys || []), c.name_en, c.name_ko].filter(Boolean),
      reusable: true,
      observed: !c.inferred,
      inferred: c.inferred || false,
      confidence: c.confidence || 0.8,
      source_refs: c.source_url ? [{ url: c.source_url, kind: c.source_kind, evidence: c.evidence }] : sourceRef,
    });
    nodes.push(compNode);
    if (c.candidate_id) candidateIdMap[c.candidate_id] = compNode.node_id;

    // observed_elements (문자열 배열) → atom nodes
    (c.observed_elements || []).forEach(el => {
      const elStr = typeof el === 'string' ? el : (el.name || '');
      const atomNode = makeNode({
        granularity: 'atom', granularity_level: 3,
        name: elStr, name_en: elStr,
        type: elStr.split('_')[0] || 'atom',
        category_path: `atoms/${elStr.split('_')[0] || 'misc'}/${elStr}`,
        origin_id: originId,
        parent_id: compNode.node_id,
        parent_chain: [compNode.node_id],
        domain, reusable: true, source_refs: sourceRef,
      });
      compNode.child_ids.push(atomNode.node_id);
      nodes.push(atomNode);
    });

    // observed_tokens → token nodes
    (c.observed_tokens || []).forEach(t => {
      const tStr = typeof t === 'string' ? t : (t.name || '');
      const tokNode = makeNode({
        granularity: 'token', granularity_level: 5,
        name: tStr, name_en: tStr, type: 'token',
        token_type: inferTokenType(tStr),
        category_path: `foundation/${inferTokenType(tStr)}`,
        origin_id: originId,
        parent_id: compNode.node_id,
        parent_chain: [compNode.node_id],
        domain, reusable: true, source_refs: sourceRef,
      });
      compNode.child_ids.push(tokNode.node_id);
      nodes.push(tokNode);
    });
  });

  // ── element_candidates → atom/element nodes ──
  (handoffJSON.element_candidates || []).forEach(e => {
    const parentNodeId = e.from_candidate_id ? candidateIdMap[e.from_candidate_id] || null : null;
    const parentNode = parentNodeId ? nodes.find(n => n.node_id === parentNodeId) : null;
    const atomNode = makeNode({
      granularity: 'atom', granularity_level: 3,
      name: e.name_ko || e.name_en || '',
      name_en: e.name_en || '',
      type: e.element_type || 'atom',
      subtype: e.subtype || '',
      category_path: `atoms/${e.element_type || 'misc'}/${e.subtype || e.element_type || 'misc'}`,
      origin_id: originId,
      parent_id: parentNodeId,
      parent_chain: parentNodeId ? [parentNodeId] : [],
      domain,
      tags: [...(e.tags || []), e.role].filter(Boolean),
      search_keys: [...(e.search_keys || []), e.name_en, e.name_ko, e.role].filter(Boolean),
      reusable: e.reusable_hint !== false,
      observed: !e.inferred,
      inferred: e.inferred || false,
      confidence: e.confidence || 0.8,
      source_refs: e.source_url ? [{ url: e.source_url, kind: e.source_kind, evidence: e.evidence }] : sourceRef,
    });
    if (e.element_id) candidateIdMap[e.element_id] = atomNode.node_id;
    if (parentNode) parentNode.child_ids.push(atomNode.node_id);
    nodes.push(atomNode);
  });

  // ── token_candidates → token nodes ──
  (handoffJSON.token_candidates || []).forEach(t => {
    const parentNodeId = t.from_candidate_id ? candidateIdMap[t.from_candidate_id] || null : null;
    const tokNode = makeNode({
      granularity: 'token', granularity_level: 5,
      name: t.name_ko || t.name_en || '',
      name_en: t.name_en || '',
      type: 'token',
      token_type: t.token_type || 'misc',
      value: t.description || '',
      category_path: `foundation/${t.token_type || 'misc'}`,
      origin_id: originId,
      parent_id: parentNodeId,
      parent_chain: parentNodeId ? [parentNodeId] : [],
      domain,
      tags: t.tags || [],
      search_keys: [t.name_en || '', t.name_ko || ''].filter(Boolean),
      reusable: true,
      observed: !t.inferred,
      inferred: t.inferred || false,
      confidence: t.confidence || 0.8,
      source_refs: t.source_url ? [{ url: t.source_url, kind: t.source_kind }] : sourceRef,
    });
    nodes.push(tokNode);
  });

  // ── state_candidates → element nodes (granularity=4, subtype=state) ──
  (handoffJSON.state_candidates || []).forEach(s => {
    const parentNodeId = s.from_candidate_id ? candidateIdMap[s.from_candidate_id] || null : null;
    const stateNode = makeNode({
      granularity: 'element', granularity_level: 4,
      name: `${s.state_name || s.trigger || 'state'} 상태`,
      name_en: s.state_name || s.trigger || 'state',
      type: 'state',
      subtype: s.state_name || '',
      value: s.visual_change || s.trigger || '',
      category_path: `elements/state/${s.state_name || 'misc'}`,
      origin_id: originId,
      parent_id: parentNodeId,
      parent_chain: parentNodeId ? [parentNodeId] : [],
      domain,
      tags: ['state', s.state_name || ''].filter(Boolean),
      search_keys: [s.state_name || '', s.trigger || ''].filter(Boolean),
      reusable: false,
      observed: true,
      confidence: s.confidence || 0.75,
      source_refs: s.source_url ? [{ url: s.source_url, kind: s.source_kind }] : sourceRef,
    });
    const parentNode = parentNodeId ? nodes.find(n => n.node_id === parentNodeId) : null;
    if (parentNode) parentNode.child_ids.push(stateNode.node_id);
    nodes.push(stateNode);
  });

  const pool_indexes = buildPoolIndexes(nodes);
  return { originId, nodes, pool_indexes };
}

// ─────────────────────────────────────────────
// catalog state에 merge (기존 + 신규)
// ─────────────────────────────────────────────
export function mergeToCatalog(prevCatalog, parsed) {
  // origins: { [origin_id]: node_id[] }
  const prevOrigins = prevCatalog.origins || {};
  const newOrigins = { ...prevOrigins, [parsed.originId]: parsed.nodes.map(n => n.node_id) };

  // pool_indexes: { [pool_name]: node_id[] }
  const prevPools = prevCatalog.pool_indexes || {};
  const newPools = { ...prevPools };
  for (const node of parsed.nodes) {
    for (const pool of (node.pool_targets || [])) {
      if (!newPools[pool]) newPools[pool] = [];
      newPools[pool].push(node.node_id);
    }
  }

  return {
    nodes: [...(prevCatalog.nodes || []), ...parsed.nodes],
    origins: newOrigins,
    pool_indexes: newPools,
  };
}

// ─────────────────────────────────────────────
// 분해 미리보기 (저장 전 확인용)
// ─────────────────────────────────────────────
export function previewDecomposition(parsed) {
  const countByLevel = {};
  parsed.nodes.forEach(n => {
    countByLevel[n.granularity] = (countByLevel[n.granularity] || 0) + 1;
  });
  return {
    total: parsed.nodes.length,
    page: countByLevel.page || 0,
    section: countByLevel.section || 0,
    component: countByLevel.component || 0,
    atom: countByLevel.atom || 0,
    element: countByLevel.element || 0,
    token: countByLevel.token || 0,
    visual_asset: countByLevel.visual_asset || 0,
  };
}
