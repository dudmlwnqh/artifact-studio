/**
 * codeUtils.js
 * 코드 전처리 유틸리티
 *
 * 각 카탈로그 노드는 세 가지 코드 필드를 가진다:
 *   code        — 원본 코드 (import/export 포함, copy-paste 가능)
 *   render_code — 렌더링용 전처리 코드 (import/export 제거, JSX 래핑 완료)
 *   render_type — 'jsx' | 'html' | 'json' | 'code'
 */

/**
 * 잘린 코드에서 완전한 마지막 블록까지만 추출
 */
export function cleanTruncated(code) {
  const last = code.trimEnd();
  if (/[;}\)]$/.test(last)) return code;
  let depth = 0, lastSafe = 0;
  let inStr = false, strChar = '', i = 0;
  while (i < code.length) {
    const c = code[i];
    if (!inStr && (c === '"' || c === "'" || c === '`')) { inStr = true; strChar = c; }
    else if (inStr && c === strChar && code[i-1] !== '\\') { inStr = false; }
    else if (!inStr) {
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') {
        depth--;
        if (depth < 0) depth = 0;
        if (depth === 0 && c === '}') lastSafe = i + 1;
      }
      else if (c === ';' && depth === 0) lastSafe = i + 1;
    }
    i++;
  }
  return lastSafe > 0 ? code.slice(0, lastSafe) : code;
}

/**
 * 원본 코드 → { render_code, render_type } 반환
 *
 * render_type:
 *   'jsx'  — React 컴포넌트 (Babel + ReactDOM으로 렌더)
 *   'html' — 순수 HTML (innerHTML로 직접 렌더)
 *   'json' — JSON 데이터 (pretty-print으로 렌더)
 *   'code' — 렌더 불가 코드 (다크 pre로 표시)
 *
 * @param {string} rawCode
 * @returns {{ render_code: string, render_type: string }}
 */
export function toRenderCode(rawCode) {
  if (!rawCode?.trim()) return { render_code: '', render_type: 'code' };

  const trimmedRaw = rawCode.trim();

  // ── 1. JSON 감지 ───────────────────────────────
  if (/^[\[\{]/.test(trimmedRaw)) {
    try {
      const parsed = JSON.parse(trimmedRaw);
      return {
        render_code: JSON.stringify(parsed, null, 2),
        render_type: 'json',
      };
    } catch { /* JSON 아님 */ }
  }

  // ── 2. 순수 HTML 감지 (<!DOCTYPE 또는 <html 또는 <div class= 시작) ──
  if (/^<!DOCTYPE/i.test(trimmedRaw) || /^<html/i.test(trimmedRaw)) {
    return { render_code: trimmedRaw, render_type: 'html' };
  }

  // ── 3. JSX / JS 전처리 ─────────────────────────
  let processed = cleanTruncated(
    rawCode
      .replace(/^import\s+.*$/gm, '')
      .replace(/^const\s+\w+\s*=\s*require\s*\([^)]*\)\s*;?/gm, '')
      .replace(/^export\s+type\s+.*$/gm, '')
      .replace(/^export\s+interface\s+/gm, 'interface ')
      .replace(/^export\s+default\s+/gm, '')
      .replace(/^export\s+\{[^}]*\}\s*;?/gm, '')
      .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
  ).trim();

  if (!processed) return { render_code: '', render_type: 'code' };

  // PascalCase 컴포넌트/함수/클래스 이름 감지
  const matches = [...processed.matchAll(/(?:function|const|class)\s+([A-Z]\w*)/g)];
  const compName = matches.length > 0 ? matches[matches.length - 1][1] : null;

  if (!compName) {
    const hasClassName = /className=/.test(processed);
    const hasPascalTag = /<[A-Z]/.test(processed);
    const hasHtmlTag = /<[a-z][a-zA-Z0-9]*[\s\/>]/.test(processed);
    const hasClassAttr = /class=["']/.test(processed);

    if (hasClassName || hasPascalTag) {
      // JSX 프래그먼트 → __Preview 래핑
      const needsReturn = /^\s*</.test(processed) || /^\s*return\s*\(/.test(processed);
      processed = needsReturn
        ? `const __Preview = () => (\n${processed.replace(/^\s*return\s*/, '')}\n);`
        : `const __Preview = () => { ${processed} };`;
      return { render_code: processed, render_type: 'jsx' };
    }

    if (hasHtmlTag && !hasClassName) {
      // HTML 조각 (class= 있고 className= 없음) → HTML
      return { render_code: processed, render_type: 'html' };
    }

    if (hasClassAttr) {
      // class= 속성이 있는 HTML → HTML
      return { render_code: processed, render_type: 'html' };
    }

    // 렌더 불가 코드
    return { render_code: processed, render_type: 'code' };
  }

  return { render_code: processed, render_type: 'jsx' };
}
