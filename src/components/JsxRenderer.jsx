import { useState, useEffect, useRef } from "react";
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";

// HTML → dangerouslySetInnerHTML
// JSX (import 없음) → iframe + React CDN
// JSX (import 있음) → Sandpack 멀티파일 번들링
export default function JsxRenderer({ code, style, projectFiles }) {
  const [mode, setMode] = useState("html"); // "html" | "jsx-simple" | "jsx-full"
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);

  const hasImport = code?.includes("import ");
  const hasJSX = code?.includes("function ") || code?.includes("const ") ||
                 code?.includes("useState") || code?.includes("export ");

  useEffect(() => {
    if (!code?.trim()) { setMode("html"); return; }
    if (hasImport && projectFiles && Object.keys(projectFiles).length > 0) {
      setMode("jsx-full");
    } else if (hasJSX || hasImport) {
      setMode("jsx-simple");
    } else {
      setMode("html");
    }
  }, [code, projectFiles]);

  // jsx-simple: iframe
  useEffect(() => {
    if (mode !== "jsx-simple" || !iframeRef.current || !code) return;
    let processed = code
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+default\s+/gm, "");
    const funcMatches = [...processed.matchAll(/(?:function|const)\s+(\w+)/g)];
    const compName = funcMatches.length > 0 ? funcMatches[funcMatches.length - 1][1] : null;
    if (!compName) processed = `function __App__() { return (${processed}); }`;
    const renderTarget = compName || "__App__";
    iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0c0c18}</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head><body><div id="root"></div>
<script type="text/babel">
const {useState,useEffect,useRef,useCallback,useMemo}=React;
${processed}
ReactDOM.createRoot(document.getElementById("root")).render(<${renderTarget}/>);
<\/script></body></html>`;
  }, [mode, code]);

  // HTML
  if (mode === "html") {
    return <div style={style} dangerouslySetInnerHTML={{ __html: code || "" }} />;
  }

  // JSX with imports → Sandpack
  if (mode === "jsx-full" && projectFiles) {
    // 메인 파일 + 프로젝트 파일들 합치기
    const files = { "/App.jsx": code };
    Object.entries(projectFiles).forEach(([name, content]) => {
      const path = name.startsWith("/") ? name : `/${name}`;
      files[path] = content;
    });

    return (
      <div style={style}>
        <SandpackProvider
          template="react"
          files={files}
          options={{ activeFile: "/App.jsx", visibleFiles: [] }}
          theme="dark"
        >
          <SandpackPreview
            style={{ height: "100%", minHeight: 400, border: "none" }}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        </SandpackProvider>
      </div>
    );
  }

  // JSX simple (no imports)
  return (
    <div style={style}>
      <iframe ref={iframeRef} sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height, border: "none", display: "block" }} />
    </div>
  );
}
