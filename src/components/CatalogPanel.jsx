/**
 * CatalogPanel.jsx
 * App.jsx의 nav==="collect" 영역 대체
 * catalogData: { nodes, pool_indexes, origins }
 * catalogData 변경: onCatalogChange(newCatalog)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { parseAndDecompose, normalizeHandoff, mergeToCatalog, previewDecomposition } from '../utils/catalogParser.js';
import { q, EMPTY_CATALOG } from '../utils/catalogQuery.js';
import { analyzeWithClaude, claudeResultToParsed } from '../utils/claudeAnalyze.js';
import { toRenderCode } from '../utils/codeUtils.js';

// ─── 아이콘 ───────────────────────────────────
const I = ({ d, s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

// ─── 탭 정의 ──────────────────────────────────
const TABS = [
  { id: 'foundation', label: '파운데이션', icon: '🎨', level: 5 },
  { id: 'assets',     label: '비주얼 에셋', icon: '🖼',  level: 6 },
  { id: 'atoms',      label: '원자',       icon: '⚛️', level: 3 },
  { id: 'components', label: '컴포넌트',   icon: '🧱',  level: 2 },
  { id: 'sections',   label: '섹션',       icon: '📐',  level: 1 },
  { id: 'pages',      label: '페이지',     icon: '📄',  level: 0 },
  { id: 'import',     label: '가져오기',   icon: '➕',  level: null },
];

// ─── 토큰 타입별 컬러 ─────────────────────────
const TOKEN_COLORS = {
  color: '#ff9500', typography: '#007aff', spacing: '#34c759',
  radius: '#af52de', shadow: '#636366', transition: '#5ac8fa',
};

// ─── 공통 iframe 스타일 ────────────────────────
const HTML_STYLE = `*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif}body{background:#fff;overflow:auto;padding:8px}button{cursor:pointer;padding:6px 12px;border-radius:4px;border:1px solid #ddd}input,textarea,select{padding:6px 8px;border:1px solid #ddd;border-radius:4px;width:100%;font-family:inherit}`;
const CODE_STYLE = `*{margin:0;padding:0;box-sizing:border-box}body{background:#1e1e2e;overflow:auto;padding:8px}pre{font-family:monospace;font-size:9px;color:#cdd6f4;white-space:pre-wrap;word-break:break-all;line-height:1.5}`;
const JSON_STYLE = `*{margin:0;padding:0;box-sizing:border-box}body{background:#0d1117;overflow:auto;padding:8px}pre{font-family:monospace;font-size:9px;color:#79c0ff;white-space:pre-wrap;word-break:break-all;line-height:1.5}`;

// ─── JSX 미니 렌더러 (iframe + React CDN) ─────
function MiniRender({ code, renderCode, renderType, fullSize = false }) {
  const iframeRef = useRef(null);
  const h = fullSize ? 300 : 130;

  useEffect(() => {
    if (!iframeRef.current || !code) return;

    // render_type이 있으면 직접 분기, 없으면 즉시 감지
    let rType = renderType;
    let processed = renderCode;
    if (!processed || !rType) {
      const r = toRenderCode(code);
      processed = r.render_code || code;
      rType = r.render_type || 'code';
    }

    // ── JSON ──────────────────────────────────
    if (rType === 'json') {
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${JSON_STYLE}</style></head><body><pre>${processed.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`;
      return;
    }

    // ── 순수 HTML ──────────────────────────────
    if (rType === 'html') {
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${HTML_STYLE}</style></head><body>${processed}</body></html>`;
      return;
    }

    // ── 렌더 불가 코드 ─────────────────────────
    if (rType === 'code' || !processed) {
      iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CODE_STYLE}</style></head><body><pre>${(processed||code).slice(0,500).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`;
      return;
    }

    // ── JSX (rType === 'jsx') ──────────────────
    // PascalCase 컴포넌트 이름 추출
    const matches = [...processed.matchAll(/(?:function|const|class)\s+([A-Z]\w*)/g)];
    let compName = matches.length > 0 ? matches[matches.length - 1][1] : null;

    if (!compName) {
      const trimmed = processed.trim();
      const hasJsxTags = /className=/.test(trimmed) || /<[A-Z]/.test(trimmed)
        || /<[a-z][a-zA-Z0-9]*[\s\/>]/.test(trimmed);
      if (hasJsxTags) {
        const needsReturn = /^\s*</.test(trimmed) || /^\s*return\s*\(/.test(trimmed);
        processed = needsReturn
          ? `const __Preview = () => (\n${trimmed.replace(/^\s*return\s*/, '')}\n);`
          : `const __Preview = () => { ${trimmed} };`;
        compName = '__Preview';
      } else {
        iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CODE_STYLE}</style></head><body><pre>${processed.slice(0,500).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`;
        return;
      }
    }

    // 에러 바운더리: React 렌더 에러를 잡아 시각 플레이스홀더 표시
    const ebClass = `class __EB extends React.Component{constructor(p){super(p);this.state={err:null};}static getDerivedStateFromError(e){return{err:e};}componentDidCatch(){}render(){if(this.state.err){return React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'4px',color:'#aaa',background:'#f5f5f7'}},React.createElement('div',{style:{fontSize:'24px',lineHeight:1}},'🧩'),React.createElement('div',{style:{fontSize:'10px',fontWeight:'600',color:'#666',marginTop:'4px'}},${JSON.stringify(compName)}),React.createElement('div',{style:{fontSize:'8px',color:'#bbb',maxWidth:'150px',textAlign:'center',marginTop:'2px',wordBreak:'break-word',lineHeight:'1.3'}},this.state.err.message.slice(0,60)));}return this.props.children;}}`;

    // 공통 라이브러리 preamble (stub)
    const preamble = [
      'const {useState,useEffect,useRef,useCallback,useMemo,forwardRef,createContext,useContext,memo,Fragment,createRef,useReducer,useLayoutEffect,useImperativeHandle,useDebugValue,useId}=React;',
      'const _pt=()=>Object.assign(()=>null,{isRequired:null});',
      'const PropTypes={string:_pt(),number:_pt(),bool:_pt(),func:_pt(),object:_pt(),array:_pt(),node:_pt(),any:_pt(),element:_pt(),symbol:_pt(),arrayOf:()=>_pt(),objectOf:()=>_pt(),shape:()=>_pt(),exact:()=>_pt(),oneOf:()=>_pt(),oneOfType:()=>_pt(),instanceOf:()=>_pt()};',
      'const clsx=(...a)=>a.filter(Boolean).join(" ");const cn=clsx;const classNames=clsx;const twMerge=clsx;const cva=()=>()=>"";',
      'const _sc=t=>{const f=(s,...v)=>{const C=(p)=>{const{children,...r}=p||{};return React.createElement(t,r,children);};C.attrs=(a)=>C;C.withConfig=(c)=>C;return C;};f.attrs=(a)=>f;f.withConfig=(c)=>f;return f;};',
      'const styled=new Proxy(_sc,{get:(_,t)=>_sc(t)});styled.css=()=>"";styled.injectGlobal=()=>{};styled.createGlobalStyle=()=>()=>null;styled.keyframes=()=>"anim";',
      'const css=styled.css;const tw=(s,...v)=>typeof s==="string"?s:(s.raw||[s]).join(" ");const cx=clsx;',
      // framer-motion stubs
      'const _mEl=(tag)=>(p)=>{const{children,...r}=p||{};return React.createElement(tag,r,children);};',
      'const motion={div:_mEl("div"),span:_mEl("span"),button:_mEl("button"),img:_mEl("img"),ul:_mEl("ul"),li:_mEl("li"),section:_mEl("section"),header:_mEl("header"),footer:_mEl("footer"),nav:_mEl("nav"),a:_mEl("a"),p:_mEl("p"),h1:_mEl("h1"),h2:_mEl("h2"),h3:_mEl("h3"),h4:_mEl("h4"),svg:_mEl("svg"),path:_mEl("path"),circle:_mEl("circle"),rect:_mEl("rect"),form:_mEl("form"),input:_mEl("input"),textarea:_mEl("textarea"),main:_mEl("main"),article:_mEl("article"),aside:_mEl("aside"),figure:_mEl("figure"),label:_mEl("label"),table:_mEl("table"),tr:_mEl("tr"),td:_mEl("td"),th:_mEl("th"),tbody:_mEl("tbody"),thead:_mEl("thead"),select:_mEl("select"),option:_mEl("option")};',
      'const AnimatePresence=({children})=>children;const useAnimation=()=>({start:()=>{},stop:()=>{}});const useMotionValue=()=>({get:()=>0,set:()=>{},onChange:()=>{}});const useTransform=()=>({get:()=>0});const useSpring=()=>({get:()=>0});const useScroll=()=>({scrollY:{get:()=>0}});const useDragControls=()=>({start:()=>{}});const useInView=()=>false;',
      // misc utilities
      'var module={exports:{}};var exports={};var require=(n)=>({default:()=>null,useState,useEffect,createElement:React.createElement});',
      'const router={push:()=>{},replace:()=>{},back:()=>{},pathname:"/"};const useRouter=()=>router;const useNavigate=()=>()=>{};const useLocation=()=>({pathname:"/",search:"",hash:""});const useParams=()=>({});const Link=({children,...p})=>React.createElement("a",p,children);',
      'const toast={success:()=>{},error:()=>{},info:()=>{},warning:()=>{}};',
      'const dayjs=(d)=>({format:()=>"2024-01-01",fromNow:()=>"방금",diff:()=>0,add:()=>dayjs(),subtract:()=>dayjs(),isBefore:()=>false,isAfter:()=>false,valueOf:()=>Date.now()});',
      // React.lazy/Suspense stubs — dynamic import() fails in sandbox
      'var lazy=(fn)=>{const C=(p)=>{const{children,...r}=p||{};return React.createElement("div",r,children);};C.displayName="LazyStub";return C;};var Suspense=({children,fallback})=>children||fallback||null;',
      // PropTypes.*json* patch — invalid custom proptype "json" causes crashes
      'const _pt2=()=>Object.assign(()=>null,{isRequired:()=>null});const _ptProxy=new Proxy({},{get:(o,k)=>_pt2()});Object.assign(PropTypes,{json:_pt2(),element:_pt2(),any:_pt2()});',
    ].join('');

    // gsap + 기타 애니메이션 라이브러리 stub
    const gsapStub = `var gsap={to:()=>{},from:()=>{},fromTo:()=>{},set:()=>{},timeline:()=>({to:()=>({to:()=>{}}),from:()=>{},fromTo:()=>{},add:()=>{},play:()=>{},pause:()=>{},kill:()=>{}}),context:function(fn){try{if(typeof fn==="function")fn();}catch(e){}return{revert:()=>{},kill:()=>{}};},registerPlugin:()=>{},utils:{clamp:()=>0,mapRange:()=>0,toArray:()=>[]},ticker:{add:()=>{},remove:()=>{}}};var ScrollTrigger={create:()=>{},refresh:()=>{}};var gsapCore=gsap;`;

    // JSX 내 PascalCase 컴포넌트를 미리 스텁 (React render 중 "X is not defined" 방지)
    const definedInCode = new Set([...(processed.matchAll(/(?:function|const|class|var|let)\s+([A-Z][a-zA-Z0-9]*)/g))].map(m => m[1]));
    const jsxRefs = [...new Set([...(processed.matchAll(/<([A-Z][a-zA-Z0-9.]*)/g))].map(m => m[1].split('.')[0]))];
    const preStubs = jsxRefs
      .filter(n => !definedInCode.has(n) && n !== compName && n !== '__EB')
      .map(n => `if(typeof ${n}==="undefined")var ${n}=function(p){return React.createElement("div",{"data-s":${JSON.stringify(n)}},(p&&p.children)||null);};`)
      .join('');

    // 공통 라이브러리 추가 stubs (BoringAvatar, Lottie, recharts 등)
    const extraStubs = `var BoringAvatar=function(p){return React.createElement("div",{style:{width:p&&p.size||40,height:p&&p.size||40,borderRadius:"50%",background:"linear-gradient(135deg,#667eea,#764ba2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:Math.round((p&&p.size||40)*0.4)+"px"}},p&&p.name?p.name[0].toUpperCase():"?");};var Lottie=function(){return React.createElement("div",{style:{width:100,height:100,background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center"}},"🎬");};var LottieView=Lottie;var recharts={ResponsiveContainer:_mEl("div"),LineChart:_mEl("div"),BarChart:_mEl("div"),PieChart:_mEl("div"),Line:_mEl("div"),Bar:_mEl("div"),Pie:_mEl("div"),XAxis:_mEl("div"),YAxis:_mEl("div"),Tooltip:_mEl("div"),Legend:_mEl("div"),Cell:_mEl("div")};`;

    // 렌더 직전: 컴포넌트에 안전한 기본 props 주입 (json.components 등 필수 prop 대비)
    const defaultPropsInject = `try{if(typeof ${compName}==="function"){${compName}.defaultProps=Object.assign({json:{components:[],type:"view"},data:[],items:[],list:[],children:null,title:"",label:"",text:"",value:"",name:"",src:"",href:"#",onClick:function(){},onChange:function(){},onPress:function(){},onSubmit:function(){},style:{}},${compName}.defaultProps||{});}}catch(e){}`;
    const safeWrapped = JSON.stringify(
      `(function(){\n${preamble}\n${gsapStub}\n${extraStubs}\n${ebClass}\n${preStubs}\n${processed}\n${defaultPropsInject}\n;(ReactDOM.createRoot||function(el){return{render:function(c){ReactDOM.render(c,el);}}})(document.getElementById("root")).render(React.createElement(__EB,null,React.createElement(${compName})));\n})()`
    );
    const fallbackHtml = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;color:#aaa;background:#f5f5f7"><div style="font-size:24px">🧩</div><div style="font-size:10px;font-weight:600;color:#666;margin-top:4px">${compName}</div></div>`;

    // HTML 대체 렌더: 원본 code → JSX→HTML 변환 (React 실패 시 폴백)
    // render_code의 __Preview 래퍼를 거치지 않고 원본 code에서 직접 변환
    const _toHtml = (src) => {
      let s = src || '';
      // import/export 줄 제거
      s = s.replace(/^import\s+.*$/gm, '').replace(/^export\s+\S[^\n]*/gm, '');
      // 백틱 템플릿 리터럴 제거 (styled-components CSS 등)
      s = s.replace(/`[^`]*`/gs, '""');
      // JSX→HTML
      s = s
        .replace(/className=/g, 'class=')
        .replace(/htmlFor=/g, 'for=')
        .replace(/style=\{\{[^}]*\}\}/g, '')
        .replace(/on[A-Z]\w+=\{[^}]*\}/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\{`[^`]*`\}/g, '')
        .replace(/\{[^{}]*\}/g, '')
        .replace(/<>/g, '<div>').replace(/<\/>/g, '</div>');
      // 코드 전용 줄 제거 — HTML 태그 없는 줄에서:
      // 1) 키워드로 시작하는 줄
      s = s.replace(/^\s*(const|let|var|function|return|class|if|else|for|while|switch|try|catch|type|interface|async|await|\}|\{|\(|\))[^\n]*$/gm, '');
      // 2) PascalCase JSX 컴포넌트 태그를 div로 대체 (NavigationBar, SpinnerOverlay 등)
      s = s.replace(/<([A-Z][a-zA-Z0-9.]*)([\s>\/])/g, '<div$2').replace(/<\/([A-Z][a-zA-Z0-9.]*)>/g, '</div>');
      // 3) JS 함수 호출로만 이루어진 줄 (HTML 태그 없음): identifier.method() 혹은 method()
      s = s.replace(/^\s*[a-zA-Z_$][\w$.]*(?:\.[a-zA-Z_$][\w$]*)*\s*\([^)]*\)\s*;?\s*$/gm, (line) =>
        /<[a-zA-Z]/.test(line) ? line : '');
      // 3) => 화살표가 있고 HTML 태그가 없는 줄
      s = s.replace(/^[^\n]*=>[^\n]*$/gm, (line) =>
        /<[a-zA-Z]/.test(line) ? line : '');
      // 4) 세미콜론으로 끝나지만 HTML 태그 없는 줄
      s = s.replace(/^[^\n]*;[^\n]*$/gm, (line) =>
        /<[a-zA-Z]/.test(line) ? line : '');
      return s.trim();
    };
    const htmlBody = JSON.stringify(_toHtml(code));

    iframeRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif}body{background:#fff;overflow:auto;padding:4px}#root{min-height:100%}button{cursor:pointer;padding:6px 12px;border-radius:4px;border:1px solid #ddd}input,textarea,select{padding:6px 8px;border:1px solid #ddd;border-radius:4px;width:100%}</style>
</head><body><div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script>
(function(){
  var root=document.getElementById('root');
  var fallback=${JSON.stringify(fallbackHtml)};
  var htmlBody=${htmlBody};
  function tryHtml(){try{root.innerHTML=htmlBody;if(!root.innerHTML.trim())root.innerHTML=fallback;}catch(e){root.innerHTML=fallback;}}
  try{
    var w=${safeWrapped};
    var out=Babel.transform(w,{presets:['react',['typescript',{allExtensions:true,isTSX:true}]],filename:'c.tsx'}).code;
    var stubs='';
    var ok=false;
    for(var i=0;i<12;i++){
      try{eval(stubs+out);ok=true;break;}
      catch(e2){
        var m=e2.message.match(/^([A-Za-z_$][A-Za-z0-9_$]*) is not defined/);
        if(!m){tryHtml();break;}
        var nm=m[1];
        if(nm.startsWith('use'))stubs+='function '+nm+'(){return[null,function(){}];}\\n';
        else if(/^[A-Z]/.test(nm))stubs+='function '+nm+'(p){var c=p&&p.children;return React.createElement("div",{"data-stub":"'+nm+'"},typeof c==="string"?c:null);}\\n';
        else stubs+='var '+nm+'=new Proxy(function(){return null},{get:function(_,k){return/^[A-Z]/.test(k)?function(p){return React.createElement("div",null,(p&&p.children)||null)}:function(){return null};},apply:function(){return null}});\\n';
      }
    }
    if(!ok&&!root.innerHTML)tryHtml();
  }catch(e){
    tryHtml();
  }
})();
<\/script></body></html>`;
  }, [code, renderCode]);

  return (
    <div style={{ width: '100%', height: h, borderRadius: 8, overflow: 'hidden', background: '#f5f5f7', border: '1px solid var(--sep)' }}>
      <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="preview" />
    </div>
  );
}

// ─── 색상 칩 ──────────────────────────────────
function ColorChip({ value }) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
      background: isHex ? value : 'var(--sep)',
      border: '1px solid var(--sep)',
    }} />
  );
}

// ─── 노드 카드 ────────────────────────────────
function NodeCard({ node, onClick }) {
  const isToken = node.granularity_level === 5;
  const isAsset = node.granularity_level === 6;
  const hasCode = node.code && node.code.length > 0;

  return (
    <div
      onClick={() => onClick(node)}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--sep)',
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* 미리보기 */}
      {isToken && node.token_type === 'color' ? (
        <ColorChip value={node.value} />
      ) : hasCode ? (
        <MiniRender code={node.code} renderCode={node.render_code} renderType={node.render_type} />
      ) : isAsset && node.asset_url ? (
        <img src={node.asset_url} alt={node.name}
          style={{ width: '100%', height: 120, objectFit: 'contain', borderRadius: 8 }} />
      ) : (
        <div style={{
          height: 120, background: 'var(--bg3)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          {TABS.find(t => t.level === node.granularity_level)?.icon || '📦'}
        </div>
      )}

      {/* 이름 */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>
        {node.name || node.name_en || node.type}
      </div>

      {/* 서브 정보 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {node.token_type && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
            background: TOKEN_COLORS[node.token_type] + '22',
            color: TOKEN_COLORS[node.token_type],
          }}>
            {node.token_type}
          </span>
        )}
        {node.value && !node.token_type && (
          <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace' }}>
            {String(node.value).slice(0, 24)}
          </span>
        )}
        {node.confidence < 0.7 && (
          <span style={{ fontSize: 9, color: 'var(--orange)', marginLeft: 'auto' }}>추론</span>
        )}
      </div>
    </div>
  );
}

const GRANULARITY_KO = { page: '페이지', section: '섹션', component: '컴포넌트', atom: '원자', element: '요소', token: '토큰', visual_asset: '비주얼 에셋' };
const TYPE_KO = { component: '컴포넌트', atom: '원자', token: '토큰', section: '섹션', page: '페이지', element: '요소', state: '상태', visual_asset: '비주얼 에셋' };
const POOL_KO = { component_pool: '컴포넌트', atom_pool: '원자', token_pool: '토큰', button_pool: '버튼', input_pool: '입력', nav_pool: '네비', card_pool: '카드', overlay_pool: '오버레이', chart_pool: '차트', texture_pool: '텍스처' };

// ─── 상세 드로어 ──────────────────────────────
function DetailDrawer({ node, onClose, catalog }) {
  const [tab, setTab] = useState('render');
  if (!node) return null;
  const children = q.children(catalog, node.node_id);
  const ancestors = q.ancestors(catalog, node.node_id);
  const hasCode = !!node.code;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 360,
      background: 'var(--bg1)', borderLeft: '1px solid var(--sep)',
      display: 'flex', flexDirection: 'column', zIndex: 10,
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--sep)' }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>{node.name || node.type}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--sep)', padding: '0 14px' }}>
        {[['render','🖼 렌더링'], ['code','💻 코드'], ['meta','ℹ️ 정보']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 12,
            color: tab === id ? 'var(--accent)' : 'var(--t3)',
            borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: tab === id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* 렌더링 탭 */}
        {tab === 'render' && (
          <div style={{ padding: 14 }}>
            {hasCode ? (
              <MiniRender code={node.code} renderCode={node.render_code} renderType={node.render_type} fullSize />
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>코드 없음</div>
            )}
          </div>
        )}

        {/* 코드 탭 */}
        {tab === 'code' && (
          <div style={{ padding: 14 }}>
            {hasCode ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{node.subtype?.toUpperCase() || '코드'}</span>
                  <button onClick={() => navigator.clipboard.writeText(node.code)} style={{ fontSize: 11, background: 'none', border: '1px solid var(--sep)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'var(--t2)' }}>복사</button>
                </div>
                <pre style={{ margin: 0, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, fontSize: 11, color: 'var(--t2)', fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {node.code}
                </pre>
              </>
            ) : <div style={{ color: 'var(--t3)', fontSize: 13, padding: 8 }}>코드 없음</div>}
          </div>
        )}

        {/* 정보 탭 */}
        {tab === 'meta' && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 메타 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['분류', GRANULARITY_KO[node.granularity] || node.granularity],
                ['타입', TYPE_KO[node.type] || node.type],
                ['형식', node.subtype?.toUpperCase()],
                ['도메인', node.domain],
                ['확신도', node.confidence != null ? (node.confidence * 100).toFixed(0) + '%' : null],
                ['값', node.value],
                ['출처', node.source_url],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--t3)', minWidth: 56 }}>{k}</span>
                  <span style={{ color: 'var(--t1)', fontFamily: k === '출처' ? 'monospace' : undefined, wordBreak: 'break-all', fontSize: k === '출처' ? 10 : 12 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* 태그 */}
            {node.tags?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>태그</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {node.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t2)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 풀 */}
            {node.pool_targets?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>풀</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {node.pool_targets.map(p => (
                    <span key={p} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,122,255,.1)', color: 'var(--blue)' }}>
                      {POOL_KO[p] || p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 부모/자식 */}
            {ancestors.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>상위</div>
                {ancestors.map(a => (
                  <div key={a.node_id} style={{ fontSize: 11, color: 'var(--t2)', padding: '2px 0' }}>
                    ↑ {a.name || a.type} <span style={{ color: 'var(--t3)' }}>({GRANULARITY_KO[a.granularity] || a.granularity})</span>
                  </div>
                ))}
              </div>
            )}
            {children.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>하위 ({children.length})</div>
                {children.slice(0, 8).map(c => (
                  <div key={c.node_id} style={{ fontSize: 11, color: 'var(--t2)', padding: '2px 0' }}>
                    → {c.name || c.type} <span style={{ color: 'var(--t3)' }}>({GRANULARITY_KO[c.granularity] || c.granularity})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 가져오기 탭 ──────────────────────────────
function ImportTab({ catalog, onCatalogChange }) {
  const [mode, setMode] = useState('claude'); // 'claude' | 'code' | 'handoff'
  const [code, setCode] = useState('');
  const [handoffText, setHandoffText] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claudeApiKey') || '');
  const [showKey, setShowKey] = useState(false);

  const saveApiKey = (k) => { setApiKey(k); localStorage.setItem('claudeApiKey', k); };

  const hasInput = mode === 'handoff' ? !!handoffText : !!code;

  const handlePreview = useCallback(async () => {
    setError(''); setPreview(null);
    try {
      if (mode === 'claude') {
        if (!apiKey) { setError('API 키를 입력하세요'); return; }
        setBusy(true);
        const result = await analyzeWithClaude(code, apiKey, { name, domain });
        const parsed = claudeResultToParsed(result, { domain });
        setPreview(previewDecomposition(parsed));
      } else if (mode === 'code') {
        const parsed = parseAndDecompose(code, { name, domain, source: 'manual' });
        setPreview(previewDecomposition(parsed));
      } else {
        const json = JSON.parse(handoffText);
        const parsed = normalizeHandoff(json);
        setPreview(previewDecomposition(parsed));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [mode, code, handoffText, name, domain, apiKey]);

  const handleImport = useCallback(async () => {
    setError(''); setBusy(true);
    try {
      let parsed;
      if (mode === 'claude') {
        if (!apiKey) { setError('API 키를 입력하세요'); setBusy(false); return; }
        try {
          const result = await analyzeWithClaude(code, apiKey, { name, domain });
          parsed = claudeResultToParsed(result, { domain });
        } catch (claudeErr) {
          // Claude 실패 → 코드 파서로 자동 폴백
          setError(`Claude 오류: ${claudeErr.message} — 코드 파서로 대신 추가합니다`);
          parsed = parseAndDecompose(code, { name, domain, source: 'manual' });
        }
      } else if (mode === 'code') {
        parsed = parseAndDecompose(code, { name, domain, source: 'manual' });
      } else {
        const json = JSON.parse(handoffText);
        parsed = normalizeHandoff(json);
      }
      const next = mergeToCatalog(catalog, parsed);
      onCatalogChange(next);
      setCode(''); setHandoffText(''); setName(''); setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [mode, code, handoffText, name, domain, apiKey, catalog, onCatalogChange]);

  const MODES = [
    ['claude', '✨ Claude AI 분석'],
    ['code',   '📝 코드 직접 파싱'],
    ['handoff','🤖 핸드오프 JSON'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {/* 모드 선택 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MODES.map(([id, label]) => (
          <button key={id} onClick={() => { setMode(id); setPreview(null); setError(''); }}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              border: mode === id ? 'none' : '1px solid var(--sep)',
              background: mode === id ? (id === 'claude' ? '#5856d6' : 'var(--blue)') : 'var(--bg2)',
              color: mode === id ? '#fff' : 'var(--t2)',
              fontWeight: mode === id ? 600 : 400,
            }}>{label}</button>
        ))}
      </div>

      {/* Claude AI 모드 — API Key + 코드 입력 */}
      {mode === 'claude' && (
        <>
          {/* API Key */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>Anthropic API Key</span>
              {apiKey && <span style={{ color: 'var(--green)', fontSize: 10 }}>✓ 저장됨</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                placeholder="sk-ant-api..."
                style={{
                  flex: 1, padding: '6px 10px', fontSize: 12,
                  background: 'var(--bg2)', border: `1px solid ${apiKey ? 'var(--green)' : 'var(--sep)'}`,
                  borderRadius: 7, color: 'var(--t1)', fontFamily: 'monospace',
                }}
              />
              <button onClick={() => setShowKey(p => !p)}
                style={{ padding: '6px 10px', borderRadius: 7, fontSize: 11, background: 'var(--bg2)', border: '1px solid var(--sep)', color: 'var(--t2)', cursor: 'pointer' }}>
                {showKey ? '숨김' : '표시'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              console.anthropic.com → API Keys에서 복사
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>이름 (선택)</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: HeroSection"
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 7, color: 'var(--t1)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>도메인 (선택)</div>
              <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="예: game, health"
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 7, color: 'var(--t1)', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>JSX / HTML 코드</div>
            <textarea value={code} onChange={e => setCode(e.target.value)}
              placeholder={'<section>\n  <h1>타이틀</h1>\n  <button>CTA</button>\n</section>'}
              style={{ width: '100%', height: 160, padding: '8px 10px', fontSize: 11, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 8, color: 'var(--t1)', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>
          <div style={{ fontSize: 11, color: '#5856d6', padding: '7px 10px', background: 'rgba(88,86,214,.08)', borderRadius: 7 }}>
            ✨ Claude가 코드를 분석해 컴포넌트·토큰·에셋을 자동 분류합니다
          </div>
        </>
      )}

      {/* 코드 직접 파싱 모드 */}
      {mode === 'code' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>이름 (선택)</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: HeroSection"
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 7, color: 'var(--t1)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>도메인 (선택)</div>
              <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="예: health, commerce"
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 7, color: 'var(--t1)', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>JSX / HTML 코드</div>
            <textarea value={code} onChange={e => setCode(e.target.value)}
              placeholder={'<div className="hero">\n  <h1>타이틀</h1>\n  <button>CTA</button>\n</div>'}
              style={{ width: '100%', height: 180, padding: '8px 10px', fontSize: 11, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 8, color: 'var(--t1)', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>
        </>
      )}

      {/* 핸드오프 JSON 모드 */}
      {mode === 'handoff' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>에이전트 핸드오프 JSON</div>
          <textarea value={handoffText} onChange={e => setHandoffText(e.target.value)}
            placeholder={'{\n  "type": "component_catalog",\n  "nodes": [...]\n}'}
            style={{ width: '100%', height: 220, padding: '8px 10px', fontSize: 11, background: 'var(--bg2)', border: '1px solid var(--sep)', borderRadius: 8, color: 'var(--t1)', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 10px', background: 'rgba(255,59,48,.08)', borderRadius: 7 }}>
          {error}
        </div>
      )}

      {/* 미리보기 결과 */}
      {preview && (
        <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--sep)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(preview).map(([k, v]) => v > 0 && (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: mode === 'claude' ? '#5856d6' : 'var(--blue)' }}>{v}</span>
              <span style={{ fontSize: 9, color: 'var(--t3)' }}>{k}</span>
            </div>
          ))}
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handlePreview} disabled={busy || !hasInput}
          style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--sep)', color: 'var(--t2)', cursor: 'pointer' }}>
          {busy ? '분석중…' : '🔍 미리보기'}
        </button>
        <button onClick={handleImport} disabled={busy || !hasInput}
          style={{ flex: 2, padding: '7px 0', borderRadius: 8, fontSize: 12, background: mode === 'claude' ? '#5856d6' : 'var(--blue)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          {busy ? (mode === 'claude' ? '✨ Claude 분석중…' : '처리중…') : '📥 카탈로그에 추가'}
        </button>
      </div>
    </div>
  );
}

// ─── Foundation 탭 ────────────────────────────
function FoundationTab({ catalog, onSelect }) {
  const [sub, setSub] = useState('전체');
  const subs = ['전체', '컬러', '타이포', '간격', '레이디우스', '그림자', '트랜지션'];
  const subMap = { '컬러': 'color', '타이포': 'typography', '간격': 'spacing', '레이디우스': 'radius', '그림자': 'shadow', '트랜지션': 'transition' };

  let tokens = q.tokens(catalog);
  if (sub !== '전체') tokens = tokens.filter(n => n.token_type === subMap[sub]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {subs.map(s => (
          <button key={s} onClick={() => setSub(s)}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: sub === s ? 'none' : '1px solid var(--sep)',
              background: sub === s ? 'var(--blue)' : 'var(--bg2)',
              color: sub === s ? '#fff' : 'var(--t2)',
            }}>{s}</button>
        ))}
      </div>

      {tokens.length === 0 ? (
        <EmptyState label="토큰이 없습니다" hint="가져오기 탭에서 코드를 추가하면 자동 추출됩니다" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {tokens.map(n => <NodeCard key={n.node_id} node={n} onClick={onSelect} />)}
        </div>
      )}
    </div>
  );
}

// ─── 빈 상태 ──────────────────────────────────
function EmptyState({ label, hint }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {hint && <div style={{ fontSize: 11 }}>{hint}</div>}
    </div>
  );
}

// ─── Visual Asset 탭 ─────────────────────────
const ASSET_SUBS = [
  { id: '전체',         label: '전체' },
  { id: 'texture',     label: '배경/텍스처' },
  { id: 'illustration',label: '일러스트/이미지' },
  { id: 'icon_illust', label: '일러스트 아이콘' },
  { id: 'brand_mark',  label: '브랜드 마크' },
  { id: 'character',   label: '캐릭터' },
  { id: 'lottie',      label: 'Lottie' },
];

const ASSET_SUB_DESC = {
  texture: '노이즈·그레인·도트·메시 그라데이션 등 CSS로 생성 가능한 반복 패턴',
  illustration: '히어로 사진, 목업, 배경 씬, 스톡 이미지 등 고유 장면',
  icon_illust: '일러스트 스타일로 그린 아이콘',
  brand_mark: '로고, 워드마크, 브랜드 심볼',
  character: '마스코트, 포즈별 캐릭터, 감정시트, 온보딩 일러스트',
  lottie: 'Lottie / JSON 기반 모션 에셋',
};

function VisualAssetTab({ catalog, onSelect }) {
  const [sub, setSub] = useState('전체');
  const all = q.assets(catalog);
  const filtered = sub === '전체' ? all : all.filter(n => n.subtype === sub);
  const counts = ASSET_SUBS.reduce((acc, s) => {
    acc[s.id] = s.id === '전체' ? all.length : all.filter(n => n.subtype === s.id).length;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ASSET_SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: sub === s.id ? 'none' : '1px solid var(--sep)',
              background: sub === s.id ? 'var(--blue)' : 'var(--bg2)',
              color: sub === s.id ? '#fff' : 'var(--t2)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            {s.label}
            {counts[s.id] > 0 && (
              <span style={{
                fontSize: 9, padding: '0 4px', borderRadius: 8,
                background: sub === s.id ? 'rgba(255,255,255,.25)' : 'var(--bg3)',
                color: sub === s.id ? '#fff' : 'var(--t3)',
              }}>{counts[s.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 서브타입 설명 */}
      {sub !== '전체' && ASSET_SUB_DESC[sub] && (
        <div style={{ fontSize: 11, color: 'var(--t3)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 7 }}>
          {ASSET_SUB_DESC[sub]}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState label={`${ASSET_SUBS.find(s=>s.id===sub)?.label} 없음`} hint="가져오기 탭에서 소스를 추가하세요" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {filtered.map(n => <NodeCard key={n.node_id} node={n} onClick={onSelect} />)}
        </div>
      )}
    </div>
  );
}

// ─── 일반 그리드 탭 ───────────────────────────
function GridTab({ nodes, onSelect, emptyLabel }) {
  if (nodes.length === 0) return <EmptyState label={emptyLabel} hint="가져오기 탭에서 소스를 추가하세요" />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
      {nodes.map(n => <NodeCard key={n.node_id} node={n} onClick={onSelect} />)}
    </div>
  );
}

// ─── 메인 CatalogPanel ────────────────────────
export default function CatalogPanel({ catalog = EMPTY_CATALOG, onCatalogChange }) {
  const [activeTab, setActiveTab] = useState('foundation');
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const [decompStatus, setDecompStatus] = useState('');

  const stats = q.stats(catalog);
  const safeChange = onCatalogChange || (() => {});

  // ── 자동 분해: 컴포넌트 → 원자/섹션/토큰 자동 추출 ──────────
  // render_code / render_type 없는 기존 노드 백필 (localStorage에서 로드된 구버전 노드)
  useEffect(() => {
    const nodes = catalog.nodes || [];
    const missing = nodes.filter(n => n.code && (!n.render_code || !n.render_type));
    if (missing.length === 0) return;
    const updated = nodes.map(n => {
      if (n.code && (!n.render_code || !n.render_type)) {
        const r = toRenderCode(n.code);
        return { ...n, render_code: r.render_code, render_type: r.render_type };
      }
      return n;
    });
    safeChange({ ...catalog, nodes: updated });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nodes = catalog.nodes || [];
    // 아직 분해되지 않은 컴포넌트/섹션 노드 찾기 (child_ids 없음)
    const undecomposed = nodes.filter(n =>
      (n.granularity_level === 1 || n.granularity_level === 2) &&
      n.code && n.code.length > 30 &&
      (!n.child_ids || n.child_ids.length === 0)
    );
    if (undecomposed.length === 0) return;

    setDecompStatus(`🔧 ${undecomposed.length}개 컴포넌트 분해 중…`);

    const updatedNodes = nodes.map(n => ({ ...n })); // 얕은 복사
    const newNodes = [];

    for (const node of undecomposed) {
      try {
        const decomposed = parseAndDecompose(node.code, {
          name: node.name,
          domain: node.domain || '',
          source_url: node.source_url || '',
        });
        // 같은 레벨 중복 제외, 원자·요소·토큰·섹션 등 추가
        const subNodes = decomposed.nodes.filter(n =>
          n.granularity_level !== node.granularity_level &&
          n.granularity_level >= 1 && n.granularity_level <= 5
        );
        subNodes.forEach(n => {
          n.parent_id = node.node_id;
          n.parent_chain = [node.node_id];
          n.tags = [...new Set([...(n.tags || []), ...(node.tags || [])])];
          n.domain = n.domain || node.domain || '';
        });
        newNodes.push(...subNodes);
        // child_ids 업데이트 (sentinel '_done' if no sub-nodes)
        const idx = updatedNodes.findIndex(n => n.node_id === node.node_id);
        if (idx >= 0) {
          updatedNodes[idx].child_ids = subNodes.length > 0
            ? subNodes.map(n => n.node_id)
            : ['_done'];
        }
      } catch {
        const idx = updatedNodes.findIndex(n => n.node_id === node.node_id);
        if (idx >= 0) updatedNodes[idx].child_ids = ['_done'];
      }
    }

    const origins = { ...(catalog.origins || {}) };
    if (newNodes.length > 0) {
      const originId = `org_auto_${Date.now()}`;
      origins[originId] = newNodes.map(n => n.node_id);
    }

    safeChange({ ...catalog, nodes: [...updatedNodes, ...newNodes], origins });
    setDecompStatus(newNodes.length > 0 ? `✅ ${newNodes.length}개 하위 요소 추출 완료` : '');
    setTimeout(() => setDecompStatus(''), 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.nodes?.length]);

  // 검색 결과
  const searchResults = search.trim()
    ? q.search(catalog, search.trim())
    : null;

  // 탭별 노드 가져오기
  function getTabNodes(tabId) {
    switch (tabId) {
      case 'foundation': return q.tokens(catalog);
      case 'assets':     return q.assets(catalog);
      case 'atoms':      return q.atoms(catalog);
      case 'components': return q.components(catalog);
      case 'sections':   return q.sections(catalog);
      case 'pages':      return q.pages(catalog);
      default: return [];
    }
  }

  const displayNodes = searchResults || getTabNodes(activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

      {/* 자동 분해 상태 표시 */}
      {decompStatus && (
        <div style={{
          padding: '6px 16px', fontSize: 11, color: 'var(--t2)',
          background: 'var(--bg2)', borderBottom: '1px solid var(--sep)',
        }}>
          {decompStatus}
        </div>
      )}

      {/* 검색바 + 통계 */}
      <div style={{
        padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--bg2)', border: '1px solid var(--sep)',
          borderRadius: 8, padding: '0 10px', height: 32,
        }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름, 타입, 태그 검색…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--t1)',
            }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
          총 {stats.total}
        </div>
      </div>

      {/* 탭 바 */}
      {!search && (
        <div style={{
          display: 'flex', gap: 2, padding: '10px 12px 0', overflowX: 'auto',
        }}>
          {TABS.map(tab => {
            const count = tab.level !== null ? getTabNodes(tab.id).length : null;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 7, fontSize: 11,
                  border: activeTab === tab.id ? 'none' : '1px solid transparent',
                  background: activeTab === tab.id ? 'var(--blue)' : 'var(--bg2)',
                  color: activeTab === tab.id ? '#fff' : 'var(--t2)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count !== null && count > 0 && (
                  <span style={{
                    fontSize: 9, padding: '0 5px', borderRadius: 10,
                    background: activeTab === tab.id ? 'rgba(255,255,255,.25)' : 'var(--bg3)',
                    color: activeTab === tab.id ? '#fff' : 'var(--t3)',
                    minWidth: 16, textAlign: 'center',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 컨텐츠 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px' }}>
        {search ? (
          /* 검색 결과 */
          searchResults.length === 0 ? (
            <EmptyState label={`"${search}" 검색 결과 없음`} hint="다른 키워드로 검색해보세요" />
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>
                {searchResults.length}개 결과
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                {searchResults.map(n => <NodeCard key={n.node_id} node={n} onClick={setSelectedNode} />)}
              </div>
            </div>
          )
        ) : activeTab === 'import' ? (
          <ImportTab catalog={catalog} onCatalogChange={safeChange} />
        ) : activeTab === 'foundation' ? (
          <FoundationTab catalog={catalog} onSelect={setSelectedNode} />
        ) : activeTab === 'assets' ? (
          <VisualAssetTab catalog={catalog} onSelect={setSelectedNode} />
        ) : (
          <GridTab
            nodes={displayNodes}
            onSelect={setSelectedNode}
            emptyLabel={`${TABS.find(t => t.id === activeTab)?.label} 없음`}
          />
        )}
      </div>

      {/* 상세 드로어 */}
      {selectedNode && (
        <DetailDrawer
          node={selectedNode}
          catalog={catalog}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
