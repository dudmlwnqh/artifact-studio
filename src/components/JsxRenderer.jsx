import { useState, useEffect, useRef } from "react";

// 전체 JSX/HTML 페이지를 iframe 안에서 렌더링
// import문 포함 전체 컴포넌트도 동작
export default function JsxRenderer({ code, style }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState(null);
  const [height, setHeight] = useState(300);

  useEffect(() => {
    if (!iframeRef.current || !code?.trim()) return;

    const isJSX = code.includes("import ") || code.includes("function ") ||
                  code.includes("const ") || code.includes("useState") ||
                  code.includes("export ") || code.includes("return (") || code.includes("=>");

    if (!isJSX) {
      // 순수 HTML
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:transparent;color:#fff}</style></head><body>${code}</body></html>`;
      iframeRef.current.srcdoc = htmlDoc;
      setError(null);
      return;
    }

    // JSX: iframe에서 React CDN + Babel로 렌더링
    // import문 제거, export default 제거, 마지막 함수를 렌더 대상으로
    let processed = code
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+default\s+/gm, "");

    // 마지막 function/const 컴포넌트 이름 추출
    const funcMatches = [...processed.matchAll(/(?:function|const)\s+(\w+)/g)];
    const compName = funcMatches.length > 0 ? funcMatches[funcMatches.length - 1][1] : null;

    // 함수가 없으면 전체를 감싸기
    if (!compName) {
      processed = `function __App__() { return (${processed}); }`;
    }

    const renderTarget = compName || "__App__";

    const htmlDoc = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: system-ui, -apple-system, 'Pretendard', sans-serif; background: transparent; }
</style>
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext, Fragment } = React;

${processed}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(${renderTarget}));

// 높이 자동 보고
const ro = new ResizeObserver(() => {
  const h = document.body.scrollHeight;
  window.parent.postMessage({ type: "iframe-height", height: h }, "*");
});
ro.observe(document.body);
setTimeout(() => {
  window.parent.postMessage({ type: "iframe-height", height: document.body.scrollHeight }, "*");
}, 200);
<\/script>
</body></html>`;

    iframeRef.current.srcdoc = htmlDoc;
    setError(null);
  }, [code]);

  // iframe 높이 자동 조절
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "iframe-height" && e.data.height) {
        setHeight(Math.max(100, e.data.height));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // iframe 로드 에러 감지
  const handleLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const errEl = doc.querySelector("#root");
        if (errEl && errEl.innerHTML === "") {
          // 빈 렌더 = 에러 가능성
        }
      }
    } catch {}
  };

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        onLoad={handleLoad}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: height,
          border: "none",
          background: "transparent",
          display: "block"
        }}
      />
      {error && (
        <div style={{
          padding: "8px 12px", margin: "8px 0", background: "rgba(200,50,50,0.15)",
          borderRadius: 6, fontSize: 11, color: "#f87171", fontFamily: "monospace",
          whiteSpace: "pre-wrap", wordBreak: "break-all"
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
