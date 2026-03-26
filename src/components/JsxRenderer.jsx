import { useState, useEffect, useRef } from "react";

// HTML → dangerouslySetInnerHTML (가장 확실)
// JSX → iframe + React CDN + Babel
export default function JsxRenderer({ code, style }) {
  const [iframeDoc, setIframeDoc] = useState("");
  const [useIframe, setUseIframe] = useState(false);
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    if (!code?.trim()) return;

    const hasJSX = code.includes("function ") || code.includes("const ") ||
                   code.includes("useState") || code.includes("export ") ||
                   code.includes("import ");

    if (!hasJSX) {
      setUseIframe(false);
      return;
    }

    // JSX 처리
    setUseIframe(true);
    let processed = code
      .replace(/^import\s+.*$/gm, "// (import removed)")
      .replace(/^export\s+default\s+/gm, "");

    const funcMatches = [...processed.matchAll(/(?:function|const)\s+(\w+)/g)];
    const compName = funcMatches.length > 0 ? funcMatches[funcMatches.length - 1][1] : null;
    if (!compName) {
      processed = `function __App__() { return (${processed}); }`;
    }
    const renderTarget = compName || "__App__";

    setIframeDoc(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0c0c18}</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body><div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useRef,useCallback,useMemo}=React;
${processed}
ReactDOM.createRoot(document.getElementById("root")).render(<${renderTarget}/>);
<\/script></body></html>`);
  }, [code]);

  // iframe srcdoc 설정
  useEffect(() => {
    if (useIframe && iframeRef.current && iframeDoc) {
      iframeRef.current.srcdoc = iframeDoc;
    }
  }, [iframeDoc, useIframe]);

  // HTML은 dangerouslySetInnerHTML로 직접 렌더링 (iframe 없이)
  if (!useIframe) {
    return (
      <div style={style} dangerouslySetInnerHTML={{ __html: code || "" }} />
    );
  }

  // JSX는 iframe
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
