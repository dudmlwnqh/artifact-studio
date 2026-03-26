import { useState, useEffect, useRef } from "react";

// HTML은 직접 렌더링, JSX는 iframe + React CDN으로 렌더링
export default function JsxRenderer({ code, style }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);

  const isJSX = code?.includes("function ") || code?.includes("const ") ||
                code?.includes("useState") || code?.includes("export ") ||
                code?.includes("import ") || code?.includes("=>");

  // iframe 높이 자동 조절
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "iframe-height" && e.data.height) {
        setHeight(Math.max(100, e.data.height + 20));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!iframeRef.current || !code?.trim()) return;

    if (!isJSX) {
      // 순수 HTML → iframe에 직접 넣기
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0c0c18;color:#fff}</style>
</head><body>${code}</body>
<script>
new ResizeObserver(function(){window.parent.postMessage({type:"iframe-height",height:document.body.scrollHeight},"*")}).observe(document.body);
setTimeout(function(){window.parent.postMessage({type:"iframe-height",height:document.body.scrollHeight},"*")},100);
<\/script></html>`;
      return;
    }

    // JSX → import 제거 후 iframe + React CDN
    let processed = code
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+default\s+/gm, "");

    // 컴포넌트 이름 추출
    const funcMatches = [...processed.matchAll(/(?:function|const)\s+(\w+)/g)];
    const compName = funcMatches.length > 0 ? funcMatches[funcMatches.length - 1][1] : null;
    if (!compName) {
      processed = `function __App__() { return (${processed}); }`;
    }
    const renderTarget = compName || "__App__";

    iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0c0c18}</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body><div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useRef,useCallback,useMemo,useContext,createContext,Fragment}=React;
${processed}
ReactDOM.createRoot(document.getElementById("root")).render(<${renderTarget}/>);
new ResizeObserver(()=>window.parent.postMessage({type:"iframe-height",height:document.body.scrollHeight},"*")).observe(document.body);
setTimeout(()=>window.parent.postMessage({type:"iframe-height",height:document.body.scrollHeight},"*"),500);
<\/script></body></html>`;
  }, [code]);

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height, border: "none", display: "block" }}
      />
    </div>
  );
}
