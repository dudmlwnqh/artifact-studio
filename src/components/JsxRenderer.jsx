import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";

// 프로젝트의 모든 파일을 Sandpack에 전달하여 import 포함 전체 JSX 렌더링
// files: { "/App.jsx": "code...", "/theme.js": "code..." } 형태
export default function JsxRenderer({ code, style, files }) {
  // files가 있으면 멀티파일 프로젝트, 없으면 단일 코드
  const sandpackFiles = files || {
    "/App.jsx": code || '<div style={{padding:20,color:"#fff"}}>빈 시안</div>',
  };

  // 순수 HTML인지 체크
  const isHTML = !code?.includes("function ") && !code?.includes("const ") &&
                 !code?.includes("useState") && !code?.includes("export ") &&
                 !code?.includes("import ") && !code?.includes("=>");

  if (isHTML && !files) {
    return (
      <div style={style}>
        <div dangerouslySetInnerHTML={{ __html: code || "" }} />
      </div>
    );
  }

  return (
    <div style={style}>
      <SandpackProvider
        template="react"
        files={sandpackFiles}
        options={{
          visibleFiles: [],
          activeFile: "/App.jsx",
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
        theme="dark"
      >
        <SandpackPreview
          style={{ height: "100%", minHeight: 300, border: "none" }}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
        />
      </SandpackProvider>
    </div>
  );
}
