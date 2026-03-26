import { useState, useEffect, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Babel from "@babel/standalone";

// JSX/HTML 코드를 런타임에서 컴파일+렌더링하는 컴포넌트
export default function JsxRenderer({ code, style }) {
  const containerRef = useRef(null);
  const rootRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !code?.trim()) return;

    // HTML인지 JSX인지 판별
    const isJSX = code.includes("function ") || code.includes("const ") ||
                  code.includes("=>") || code.includes("useState") ||
                  code.includes("export ") || code.includes("return (");

    if (!isJSX) {
      // 순수 HTML - dangerouslySetInnerHTML 방식
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      containerRef.current.innerHTML = code;
      setError(null);
      return;
    }

    // JSX - Babel로 컴파일 후 React로 렌더링
    try {
      // 코드에서 export default 제거하고 컴포넌트 추출
      let processedCode = code
        .replace(/^export\s+default\s+/m, "")
        .replace(/^import\s+.*$/gm, ""); // import 문 제거

      // 함수형 컴포넌트가 아니면 감싸기
      if (!processedCode.includes("function ") && !processedCode.includes("=>")) {
        processedCode = `function __Component__() { return (${processedCode}); }`;
      }

      // 마지막 함수명 추출
      const funcMatch = processedCode.match(/function\s+(\w+)/g);
      const lastFunc = funcMatch ? funcMatch[funcMatch.length - 1].replace("function ", "") : null;

      if (!lastFunc) {
        // JSX expression만 있는 경우
        processedCode = `function __Component__() { return (${processedCode}); }`;
      }

      const compName = lastFunc || "__Component__";
      processedCode += `\n;__render__(${compName});`;

      // Babel 컴파일
      const compiled = Babel.transform(processedCode, {
        presets: ["react"],
        plugins: [],
      }).code;

      // 실행
      containerRef.current.innerHTML = "";
      if (rootRef.current) {
        rootRef.current.unmount();
      }
      rootRef.current = ReactDOM.createRoot(containerRef.current);

      const __render__ = (Comp) => {
        rootRef.current.render(React.createElement(Comp));
      };

      // eslint-disable-next-line no-new-func
      const fn = new Function("React", "useState", "useEffect", "useRef", "useCallback", "useMemo", "__render__",
        compiled
      );
      fn(
        React,
        React.useState,
        React.useEffect,
        React.useRef,
        React.useCallback,
        React.useMemo,
        __render__
      );

      setError(null);
    } catch (e) {
      setError(e.message);
      containerRef.current.innerHTML = "";
    }

    return () => {
      if (rootRef.current) {
        try { rootRef.current.unmount(); } catch {}
        rootRef.current = null;
      }
    };
  }, [code]);

  return (
    <div style={style}>
      <div ref={containerRef} style={{ minHeight: 10 }} />
      {error && (
        <div style={{
          padding: "8px 12px", margin: "8px 0", background: "rgba(200,50,50,0.15)",
          borderRadius: 6, fontSize: 11, color: "#f87171", fontFamily: "monospace",
          whiteSpace: "pre-wrap", wordBreak: "break-all"
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
