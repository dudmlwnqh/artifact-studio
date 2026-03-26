import { useState, useEffect, useRef } from "react";
import * as Babel from "@babel/standalone";

export default function JsxRenderer({ code, style }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState(null);
  const [height, setHeight] = useState(300);

  useEffect(() => {
    if (!iframeRef.current || !code?.trim()) return;

    const isJSX = code.includes("function ") || code.includes("const ") ||
                  code.includes("useState") || code.includes("export ") ||
                  code.includes("return (") || code.includes("=>");

    if (!isJSX) {
      // 순수 HTML
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:transparent;color:#fff}</style></head><body>${code}</body></html>`;
      setError(null);
      return;
    }

    // JSX: 부모에서 Babel로 컴파일 후 iframe에 전달
    try {
      let processed = code
        .replace(/^import\s+.*$/gm, "")
        .replace(/^export\s+default\s+/gm, "");

      const funcMatches = [...processed.matchAll(/(?:function|const)\s+(\w+)/g)];
      const compName = funcMatches.length > 0 ? funcMatches[funcMatches.length - 1][1] : null;

      if (!compName) {
        processed = `function __App__() { return (${processed}); }`;
      }
      const renderTarget = compName || "__App__";

      // Babel 컴파일 (부모에서 수행)
      const compiled = Babel.transform(
        processed + `\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(${renderTarget}));`,
        { presets: ["react"] }
      ).code;

      const htmlDoc = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: system-ui, -apple-system, 'Pretendard', sans-serif; background: transparent; }
</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
</head><body>
<div id="root"></div>
<script>
var { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext, Fragment } = React;
try {
  ${compiled}
} catch(e) {
  document.getElementById("root").innerHTML = '<pre style="color:#f87171;padding:12px;font-size:12px">' + e.message + '</pre>';
}
var _ro = new ResizeObserver(function() {
  window.parent.postMessage({ type: "iframe-height", height: document.body.scrollHeight }, "*");
});
_ro.observe(document.body);
setTimeout(function() {
  window.parent.postMessage({ type: "iframe-height", height: document.body.scrollHeight }, "*");
}, 300);
<\/script>
</body></html>`;

      iframeRef.current.srcdoc = htmlDoc;
      setError(null);
    } catch (e) {
      setError(e.message);
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><body style="padding:12px;font-family:monospace;font-size:12px;color:#f87171;background:#1a1a2e">${e.message}</body></html>`;
    }
  }, [code]);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "iframe-height" && e.data.height) {
        setHeight(Math.max(100, e.data.height));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height, border: "none", background: "transparent", display: "block" }}
      />
      {error && (
        <div style={{ padding: "8px 12px", margin: "8px 0", background: "rgba(200,50,50,0.15)", borderRadius: 6, fontSize: 11, color: "#f87171", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}
    </div>
  );
}
