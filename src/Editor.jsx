import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import PageViewer from "./components/PageViewer.jsx";
import StoryboardPanel from "./components/StoryboardPanel.jsx";
import DesignToolPanel from "./components/DesignToolPanel.jsx";

// Slider - MUST be outside Editor to prevent remount on every render
function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = "px", t }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: t.t3, marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, height: 4, accentColor: t.ac }} />
        <input value={value} onChange={e => onChange(e.target.value)}
          style={{
            width: 40, padding: "3px 4px", background: t.ib,
            border: `1px solid ${t.ibr}`, borderRadius: 4,
            fontSize: 10, color: t.tx, fontFamily: "monospace",
            textAlign: "right", outline: "none"
          }} />
        {unit && <span style={{ fontSize: 9, color: t.t3, width: 16 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ColorInput - MUST be outside Editor to prevent remount on every render
function ColorInput({ propKey, so, onUpdate, t }) {
  const val = so?.[propKey] || "";
  const hex = val.startsWith("#") ? val : "#000000";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
      <input type="color" value={hex} onChange={e => onUpdate(propKey, e.target.value)}
        style={{ width: 24, height: 24, border: `1px solid ${t.ibr}`, borderRadius: 4, padding: 0, cursor: "pointer", flexShrink: 0 }} />
      <input value={val} onChange={e => onUpdate(propKey, e.target.value)}
        style={{
          flex: 1, minWidth: 0, padding: "3px 6px", background: t.ib,
          border: `1px solid ${t.ibr}`, borderRadius: 4,
          fontSize: 10, color: t.tx, fontFamily: "monospace", outline: "none"
        }} />
    </div>
  );
}

function parseStyle(str) {
  const o = {};
  if (!str) return o;
  str.split(";").forEach(p => {
    const i = p.indexOf(":");
    if (i < 0) return;
    const k = p.substring(0, i).trim();
    const v = p.substring(i + 1).trim();
    if (k && v) o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function styleToStr(o) {
  return Object.entries(o)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";");
}

// Simple syntax highlighter for HTML
function highlightHTML(code, colors) {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    // Tags
    .replace(/(&lt;\/?)([\w-]+)/g, `$1<span style="color:${colors.tag}">$2</span>`)
    // Attribute names
    .replace(/([\w-]+)(=)/g, `<span style="color:${colors.attr}">$1</span>$2`)
    // Quoted strings
    .replace(/(&quot;|")(.*?)(\1)/g, `<span style="color:${colors.str}">"$2"</span>`)
    // Closing >
    .replace(/(&gt;)/g, `<span style="color:${colors.tag}">&gt;</span>`);
}

// Format HTML with indentation
function formatHTML(code) {
  let indent = 0;
  const lines = [];
  // Split by tags
  const tokens = code.replace(/>\s*</g, ">\n<").split("\n");
  tokens.forEach(token => {
    const trimmed = token.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("</")) indent = Math.max(0, indent - 1);
    lines.push("  ".repeat(indent) + trimmed);
    if (trimmed.match(/^<[^/!][^>]*[^/]>$/) && !trimmed.match(/^<(br|hr|img|input|meta|link)/i)) {
      indent++;
    }
  });
  return lines.join("\n");
}

export default function Editor({ project, onBack, onSave, t, tokenSets }) {
  // Auto-start editing first page or project code
  const firstPage = (project.pages || [])[0] || null;
  const [editingPage, setEditingPage] = useState(firstPage);
  const [code, setCodeRaw] = useState(firstPage?.code || project.code || "");
  const [history, setHistory] = useState([firstPage?.code || project.code || ""]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selIdx, setSelIdx] = useState(null);
  const [showPropsPanel, setShowPropsPanel] = useState(false); // floating props panel
  const [propsPanelPos, setPropsPanelPos] = useState({ x: 0, y: 0 });
  const [els, setEls] = useState([]);
  const [copied, setCopied] = useState(false);
  const [rightTab, setRightTab] = useState("storyboard"); // "storyboard" | "style" | "interaction"
  const autoSaveTimer = useRef(null);

  // setCode with undo history
  const setCode = useCallback((newCode) => {
    setCodeRaw(newCode);
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const next = [...trimmed, newCode];
      if (next.length > 50) next.shift(); // max 50 history
      return next;
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));

    // Auto-save after 1s of inactivity
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (editingPage) {
        const updatedPages = (project.pages || []).map(pg =>
          pg.id === editingPage.id ? { ...pg, code: newCode } : pg
        );
        onSave({ ...project, pages: updatedPages, code: updatedPages[0]?.code || newCode });
      } else {
        onSave({ ...project, code: newCode });
      }
    }, 1000);
  }, [historyIdx, editingPage, project, onSave]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setCodeRaw(history[newIdx]);
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setCodeRaw(history[newIdx]);
  }, [historyIdx, history]);
  const [interactions, setInteractions] = useState(project.interactions || []);
  const [newTrigger, setNewTrigger] = useState("tap");
  const [newAction, setNewAction] = useState("toast");
  const [newActionMsg, setNewActionMsg] = useState("안녕하세요!");
  const [toast, setToast] = useState(null);
  const [bottomSheet, setBottomSheet] = useState(null);
  const [modal, setModal] = useState(null);
  const [eyedropper, setEyedropper] = useState(null); // null | "color" | "background"
  const [eyedropperColor, setEyedropperColor] = useState(null); // current hovered color hex
  const [eyedropperPos, setEyedropperPos] = useState(null); // { x, y } mouse position
  const [viewMode, setViewMode] = useState("preview"); // "preview" | "code"
  const [interactionMode, setInteractionMode] = useState(false); // true = 실행 모드
  const [editingText, setEditingText] = useState(null); // { idx, text }
  const previewRef = useRef(null);
  const eyedropperCanvasRef = useRef(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        if (eyedropper) {
          setEyedropper(null);
        } else if (selIdx !== null) {
          setEyedropper("color"); // default to text color
        }
      }
      if (e.key === "Escape") {
        setEyedropper(null);
        setSelIdx(null);
        setShowPropsPanel(false);
      }
      // Ctrl+Z = undo, Ctrl+Shift+Z = redo
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
      // Ctrl+S = save
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+C with no text selection = copy code
      if (e.ctrlKey && e.key === "c" && !window.getSelection()?.toString()) {
        // don't override normal copy
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [eyedropper, selIdx, undo, redo]);

  // Eyedropper: capture preview to canvas when entering eyedropper mode
  useEffect(() => {
    if (!eyedropper || !previewRef.current) return;
    // Use a hidden canvas to render preview for pixel-level color picking
    const previewEl = previewRef.current;
    const rect = previewEl.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * 2; // 2x for retina
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);

    // Draw preview background
    ctx.fillStyle = t.pv;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Use foreignObject SVG trick to render HTML to canvas
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,sans-serif">${previewEl.innerHTML}</div>
      </foreignObject>
    </svg>`;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      eyedropperCanvasRef.current = { canvas, rect };
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

    return () => { eyedropperCanvasRef.current = null; };
  }, [eyedropper, code]);

  // Eyedropper: get pixel color at mouse position
  const getPixelColor = useCallback((clientX, clientY) => {
    const data = eyedropperCanvasRef.current;
    if (!data) {
      // Fallback: use computed style of element under cursor
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const rgb = eyedropper === "background" ? style.backgroundColor : style.color;
      const m = rgb.match(/\d+/g);
      if (!m || m.length < 3) return rgb;
      return "#" + m.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
    }
    const { canvas, rect } = data;
    const x = Math.round((clientX - rect.left) * 2);
    const y = Math.round((clientY - rect.top) * 2);
    const ctx = canvas.getContext("2d");
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return "#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join("");
  }, [eyedropper]);

  // Eyedropper mouse handlers on preview
  const handleEyedropperMove = useCallback((e) => {
    if (!eyedropper) return;
    const color = getPixelColor(e.clientX, e.clientY);
    setEyedropperColor(color);
    setEyedropperPos({ x: e.clientX, y: e.clientY });
  }, [eyedropper, getPixelColor]);

  const handleEyedropperClick = useCallback((e) => {
    if (!eyedropper || selIdx === null) return;
    e.stopPropagation();
    const color = getPixelColor(e.clientX, e.clientY);
    if (color) {
      updateStyle(eyedropper, color);
    }
    setEyedropper(null);
    setEyedropperColor(null);
    setEyedropperPos(null);
  }, [eyedropper, selIdx, getPixelColor]);

  // Syntax highlight colors
  const hlColors = {
    tag: t.ac,
    attr: t.am,
    str: t.gn,
  };

  // Formatted + highlighted code
  const formattedCode = useMemo(() => formatHTML(code), [code]);
  const highlightedCode = useMemo(() => highlightHTML(formattedCode, hlColors), [formattedCode, hlColors.tag]);

  // Parse HTML into elements array
  useEffect(() => {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = code;
      const arr = [];
      const walk = (node, depth) => {
        if (node.nodeType === 1) {
          const tag = node.tagName.toLowerCase();
          const styleObj = parseStyle(node.getAttribute("style") || "");
          const childNodes = Array.from(node.childNodes);
          const textContent = childNodes.length === 1 && childNodes[0].nodeType === 3
            ? childNodes[0].textContent.trim() : null;
          arr.push({ tag, so: styleObj, tc: textContent, depth });
          Array.from(node.children).forEach(c => walk(c, depth + 1));
        }
      };
      Array.from(tmp.children).forEach(c => walk(c, 0));
      setEls(arr);
    } catch (e) {
      setEls([]);
    }
  }, [code]);

  // Rebuild HTML from modified elements (style + text)
  const rebuild = useCallback((newEls) => {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = code;
      let i = 0;
      const walk = (node) => {
        if (node.nodeType === 1) {
          if (i < newEls.length) {
            node.setAttribute("style", styleToStr(newEls[i].so));
            // Update text content if changed
            if (newEls[i].tc !== undefined) {
              const childNodes = Array.from(node.childNodes);
              if (childNodes.length === 1 && childNodes[0].nodeType === 3) {
                childNodes[0].textContent = newEls[i].tc || "";
              }
            }
          }
          i++;
          Array.from(node.children).forEach(walk);
        }
      };
      Array.from(tmp.children).forEach(walk);
      return tmp.innerHTML;
    } catch (e) {
      return code;
    }
  }, [code]);

  // Update text content of element
  const updateText = (idx, text) => {
    const newEls = els.map((el, i) => i === idx ? { ...el, tc: text } : el);
    setEls(newEls);
    setCode(rebuild(newEls));
  };

  // Update a style property
  const updateStyle = (key, value) => {
    if (selIdx === null) return;
    const newEls = els.map((el, i) => {
      if (i !== selIdx) return el;
      const s = { ...el.so };
      const pxKeys = ["fontSize", "borderRadius", "gap", "letterSpacing"];
      if (pxKeys.includes(key)) s[key] = value + "px";
      else s[key] = value;
      return { ...el, so: s };
    });
    setEls(newEls);
    setCode(rebuild(newEls));
  };

  // Handle save
  const handleSave = () => {
    if (editingPage) {
      // Save back to the page in project.pages
      const updatedPages = (project.pages || []).map(pg =>
        pg.id === editingPage.id ? { ...pg, code } : pg
      );
      onSave({ ...project, pages: updatedPages, code: updatedPages[0]?.code || code, interactions });
    } else {
      onSave({ ...project, code, interactions });
    }
    onBack();
  };

  // Enter page editing mode
  const startEditPage = (page) => {
    setEditingPage(page);
    setCode(page.code);
    setSelIdx(null);
  };

  // Back to page viewer from page editing
  const backToViewer = () => {
    if (editingPage) {
      // Save the current editing back to project pages
      const updatedPages = (project.pages || []).map(pg =>
        pg.id === editingPage.id ? { ...pg, code } : pg
      );
      onSave({ ...project, pages: updatedPages, code: updatedPages[0]?.code || project.code });
    }
    setEditingPage(null);
    setSelIdx(null);
  };

  // Fire interaction action
  const fireAction = (action, msg) => {
    if (action === "toast") {
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    } else if (action === "bottomSheet") {
      setBottomSheet(msg);
    } else if (action === "modal") {
      setModal(msg);
    }
  };

  // Add interaction
  const addInteraction = () => {
    if (selIdx === null) return;
    const newInt = {
      id: "i" + Date.now(),
      elIdx: selIdx,
      trigger: newTrigger,
      action: newAction,
      message: newActionMsg,
    };
    setInteractions(prev => [...prev, newInt]);
  };

  // Delete interaction
  const deleteInteraction = (id) => {
    setInteractions(prev => prev.filter(x => x.id !== id));
  };

  // Copy code
  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Long press tracking
  const longPressTimer = useRef(null);

  const handlePreviewMouseDown = (e) => {
    if (!previewRef.current || !interactionMode) return;
    const idx = findElIdx(e.target);
    if (idx < 0) return;
    longPressTimer.current = setTimeout(() => {
      interactions.filter(i => i.elIdx === idx && i.trigger === "longPress")
        .forEach(i => fireAction(i.action, i.message));
      longPressTimer.current = null;
    }, 600);
  };

  const handlePreviewMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const findElIdx = (target) => {
    if (!previewRef.current) return -1;
    let idx = 0, found = -1;
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (node === target) found = idx;
        idx++;
        Array.from(node.children).forEach(walk);
      }
    };
    Array.from(previewRef.current.children).forEach(walk);
    return found;
  };

  // Click on preview to select element + fire tap interactions + eyedropper
  const handlePreviewClick = (e) => {
    const found = findElIdx(e.target);
    if (found >= 0 && found < els.length) {
      // Eyedropper mode
      if (eyedropper && selIdx !== null) {
        const clickedStyle = window.getComputedStyle(e.target);
        const pickedColor = eyedropper === "background"
          ? clickedStyle.backgroundColor
          : clickedStyle.color;
        const toHex = (rgb) => {
          const m = rgb.match(/\d+/g);
          if (!m || m.length < 3) return rgb;
          return "#" + m.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
        };
        updateStyle(eyedropper, toHex(pickedColor));
        setEyedropper(null);
        return;
      }
      // Interaction run mode: fire interactions instead of selecting
      if (interactionMode) {
        interactions.filter(i => i.elIdx === found && i.trigger === "tap")
          .forEach(i => fireAction(i.action, i.message));
        return;
      }
      setSelIdx(found);
    }
  };

  // Double-click to edit text
  const handlePreviewDblClick = (e) => {
    if (interactionMode) return;
    const found = findElIdx(e.target);
    if (found >= 0 && found < els.length && els[found].tc !== null) {
      setSelIdx(found);
      setEditingText({ idx: found, text: els[found].tc });
    }
  };

  // Highlight selected element + get its bounding rect for resize handles
  const [selRect, setSelRect] = useState(null);
  const [resizing, setResizing] = useState(null); // { handle, startX, startY, startStyle }

  useEffect(() => {
    if (!previewRef.current) { setSelRect(null); return; }
    let idx = 0;
    let foundNode = null;
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (idx === selIdx) {
          node.style.outline = "2px dashed " + t.ac;
          node.style.outlineOffset = "2px";
          foundNode = node;
        } else {
          node.style.outline = "";
          node.style.outlineOffset = "";
        }
        idx++;
        Array.from(node.children).forEach(walk);
      }
    };
    Array.from(previewRef.current.children).forEach(walk);
    if (foundNode) {
      const parentRect = previewRef.current.closest("[data-preview-area]")?.getBoundingClientRect();
      const nodeRect = foundNode.getBoundingClientRect();
      if (parentRect) {
        setSelRect({
          top: nodeRect.top - parentRect.top,
          left: nodeRect.left - parentRect.left,
          width: nodeRect.width,
          height: nodeRect.height,
        });
      }
    } else {
      setSelRect(null);
    }
  });

  // Resize handle drag - 좌우는 동시 조절, padding 축약형으로 한번에 세팅
  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      const h = resizing.handle;
      const s = { ...resizing.startStyle };

      let newPt = s.pt, newPr = s.pr, newPb = s.pb, newPl = s.pl;

      // 상 조절
      if (h === "t" || h === "tl" || h === "tr") newPt = Math.max(0, s.pt - dy);
      // 하 조절
      if (h === "b" || h === "bl" || h === "br") newPb = Math.max(0, s.pb + dy);
      // 좌우 동시 조절 (좌 핸들이든 우 핸들이든 좌우 대칭)
      if (h === "l" || h === "bl" || h === "tl") {
        const v = Math.max(0, s.pl - dx);
        newPl = v; newPr = v;
      }
      if (h === "r" || h === "br" || h === "tr") {
        const v = Math.max(0, s.pr + dx);
        newPl = v; newPr = v;
      }

      updateStyle("padding", `${Math.round(newPt)}px ${Math.round(newPr)}px ${Math.round(newPb)}px ${Math.round(newPl)}px`);
    };
    const handleUp = () => setResizing(null);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = resizing.handle.length === 2 ? "nwse-resize" : (resizing.handle === "t" || resizing.handle === "b" ? "ns-resize" : "ew-resize");
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const startResize = (handle, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!sel) return;
    const pad = sel.so.padding || "0";
    const parts = pad.replace(/px/g, "").trim().split(/\s+/).map(Number);
    let pt, pr, pb, pl;
    if (parts.length === 1) { pt = pr = pb = pl = parts[0] || 0; }
    else if (parts.length === 2) { pt = pb = parts[0] || 0; pr = pl = parts[1] || 0; }
    else if (parts.length === 3) { pt = parts[0] || 0; pr = pl = parts[1] || 0; pb = parts[2] || 0; }
    else { pt = parts[0] || 0; pr = parts[1] || 0; pb = parts[2] || 0; pl = parts[3] || 0; }
    setResizing({ handle, startX: e.clientX, startY: e.clientY, startStyle: { pt, pr, pb, pl } });
  };

  const sel = selIdx !== null ? els[selIdx] : null;

  // (Slider and ColorInput are defined outside Editor to prevent remount on re-render)

  return (
    <div style={{ background: t.bg, color: t.tx, fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        borderBottom: `1px solid ${t.cb}`, background: t.bg, zIndex: 10, flexShrink: 0
      }}>
        <span onClick={onBack} style={{ cursor: "pointer", color: t.t3, fontSize: 18, padding: "0 4px" }}>←</span>
        <b style={{ fontSize: 15 }}>{project.name}</b>
        {/* Page dropdown */}
        {(project.pages || []).length > 0 && (
          <select value={editingPage?.id || ""}
            onChange={e => {
              const pg = (project.pages || []).find(p => p.id === e.target.value);
              if (pg) { setCode(pg.code); setEditingPage(pg); setSelIdx(null); }
            }}
            style={{
              padding: "3px 8px", fontSize: 11, background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 4,
              color: t.tx, outline: "none", maxWidth: 140
            }}>
            {(project.pages || []).map((pg, i) => (
              <option key={pg.id} value={pg.id}>P{i + 1} {pg.name}</option>
            ))}
          </select>
        )}

        {/* View mode toggle: 👁 / </> pill */}
        <div style={{
          display: "flex", marginLeft: 12, background: t.ib,
          borderRadius: 20, padding: 2, border: `1px solid ${t.ibr}`
        }}>
          <button onClick={() => setViewMode("preview")}
            style={{
              width: 34, height: 28, border: "none", borderRadius: 18, cursor: "pointer",
              background: viewMode === "preview" ? t.card : "transparent",
              color: viewMode === "preview" ? t.tx : t.t3,
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: viewMode === "preview" ? "0 1px 3px rgba(0,0,0,0.2)" : "none"
            }}>👁</button>
          <button onClick={() => setViewMode("code")}
            style={{
              width: 34, height: 28, border: "none", borderRadius: 18, cursor: "pointer",
              background: viewMode === "code" ? t.card : "transparent",
              color: viewMode === "code" ? t.tx : t.t3,
              fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: viewMode === "code" ? "0 1px 3px rgba(0,0,0,0.2)" : "none"
            }}>&lt;/&gt;</button>
        </div>

        {/* Interaction mode toggle */}
        {viewMode === "preview" && (
          <button onClick={() => setInteractionMode(!interactionMode)}
            style={{
              padding: "4px 12px", fontSize: 11, borderRadius: 4, cursor: "pointer",
              border: `1px solid ${interactionMode ? t.gn : t.cb}`,
              background: interactionMode ? "rgba(93,202,165,0.15)" : "transparent",
              color: interactionMode ? t.gn : t.t3,
              fontWeight: interactionMode ? 600 : 400
            }}>
            {interactionMode ? "▶ 실행 모드" : "✏ 편집 모드"}
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={handleCopy}
            style={{ padding: "4px 10px", fontSize: 11, border: `1px solid ${t.ac}`, background: t.abg, color: copied ? t.gn : t.ac, cursor: "pointer", borderRadius: 4 }}>
            {copied ? "복사됨 ✓" : "코드 복사"}
          </button>
          <button onClick={handleSave}
            style={{ padding: "4px 10px", fontSize: 11, border: `1px solid ${t.gn}`, background: "transparent", color: t.gn, cursor: "pointer", borderRadius: 4, fontWeight: 600 }}>
            저장
          </button>
        </div>
      </div>


      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: PageViewer (preview) or Code editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${t.cb}`, minWidth: 0 }}>
          {viewMode === "preview" ? (
            <PageViewer project={project} onUpdateProject={onSave} t={t}
              onEditPage={(page) => {
                setCode(page.code);
                setShowPropsPanel(true);
                // Auto-select first element
                setTimeout(() => setSelIdx(0), 100);
              }} />
          ) : viewMode === "code" ? (
            /* Code editor mode */
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <textarea value={formattedCode}
                onChange={e => { setCode(e.target.value); setSelIdx(null); }}
                style={{
                  flex: 1, padding: 16, background: t.pv,
                  border: "none", color: t.gn, fontFamily: "monospace",
                  fontSize: 13, lineHeight: 1.7, resize: "none", outline: "none",
                  boxSizing: "border-box"
                }}
                spellCheck={false}
                placeholder="HTML 코드를 편집하세요..."
              />
              <div style={{ padding: "4px 12px", fontSize: 10, color: t.t3, borderTop: `1px solid ${t.cb}`, flexShrink: 0 }}>
                코드 직접 편집 가능 · 미리보기 탭에서 결과 확인
              </div>
            </div>
          ) : viewMode === "edit" ? (
            <>
              {/* Edit mode preview with element selection */}
              <div data-preview-area style={{
                flex: 1, padding: 24, background: t.pv,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "auto"
              }}>
                <style>{`[data-preview-area] * { user-select: none !important; -webkit-user-select: none !important; cursor: inherit !important; }`}</style>
                <div ref={previewRef}
                  onClick={eyedropper ? handleEyedropperClick : handlePreviewClick}
                  onDoubleClick={handlePreviewDblClick}
                  onMouseDown={handlePreviewMouseDown} onMouseUp={handlePreviewMouseUp}
                  onMouseMove={eyedropper ? handleEyedropperMove : undefined}
                  onMouseLeave={eyedropper ? () => { setEyedropperPos(null); setEyedropperColor(null); } : undefined}
                  dangerouslySetInnerHTML={{ __html: code }}
                  style={{ maxWidth: "100%", cursor: interactionMode ? "pointer" : (eyedropper ? "none" : "crosshair"), userSelect: "none", WebkitUserSelect: "none" }} />

                {/* Resize handles on selected element */}
                {selRect && !interactionMode && !eyedropper && (
                  <>
                    {/* 8 handles: t, b, l, r, tl, tr, bl, br */}
                    {[
                      { id: "t",  cursor: "ns-resize",   top: selRect.top - 5,   left: selRect.left + selRect.width / 2 - 5 },
                      { id: "b",  cursor: "ns-resize",   top: selRect.top + selRect.height - 5, left: selRect.left + selRect.width / 2 - 5 },
                      { id: "l",  cursor: "ew-resize",   top: selRect.top + selRect.height / 2 - 5, left: selRect.left - 5 },
                      { id: "r",  cursor: "ew-resize",   top: selRect.top + selRect.height / 2 - 5, left: selRect.left + selRect.width - 5 },
                      { id: "tl", cursor: "nwse-resize", top: selRect.top - 5,   left: selRect.left - 5 },
                      { id: "tr", cursor: "nesw-resize", top: selRect.top - 5,   left: selRect.left + selRect.width - 5 },
                      { id: "bl", cursor: "nesw-resize", top: selRect.top + selRect.height - 5, left: selRect.left - 5 },
                      { id: "br", cursor: "nwse-resize", top: selRect.top + selRect.height - 5, left: selRect.left + selRect.width - 5 },
                    ].map(h => (
                      <div key={h.id}
                        onMouseDown={e => startResize(h.id, e)}
                        style={{
                          position: "absolute", top: h.top, left: h.left,
                          width: 10, height: 10, background: t.ac, borderRadius: 2,
                          cursor: h.cursor, zIndex: 15,
                          border: "1px solid rgba(255,255,255,0.5)"
                        }} />
                    ))}
                  </>
                )}

                {/* Eyedropper magnifier */}
                {eyedropper && eyedropperPos && eyedropperColor && (
                  <div style={{
                    position: "fixed",
                    left: eyedropperPos.x + 20,
                    top: eyedropperPos.y - 80,
                    pointerEvents: "none",
                    zIndex: 100,
                    display: "flex", flexDirection: "column", alignItems: "center"
                  }}>
                    {/* Magnifier circle */}
                    <div style={{
                      width: 80, height: 80, borderRadius: "50%",
                      border: `3px solid ${eyedropperColor}`,
                      background: eyedropperColor,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.8)",
                        background: "transparent"
                      }} />
                    </div>
                    {/* Color label */}
                    <div style={{
                      marginTop: 4, padding: "2px 8px",
                      background: "#000", color: "#fff",
                      borderRadius: 4, fontSize: 11, fontFamily: "monospace",
                      whiteSpace: "nowrap"
                    }}>
                      {eyedropperColor}
                    </div>
                  </div>
                )}

                {/* Text editing overlay */}
                {editingText && (
                  <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30
                  }} onClick={() => {
                    updateText(editingText.idx, editingText.text);
                    setEditingText(null);
                  }}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: t.card, borderRadius: 8, padding: 16,
                      border: `1px solid ${t.cb}`, minWidth: 300
                    }}>
                      <div style={{ fontSize: 12, color: t.ac, marginBottom: 8, fontWeight: 600 }}>
                        텍스트 편집 {"<" + (els[editingText.idx]?.tag || "") + ">"}
                      </div>
                      <input value={editingText.text}
                        autoFocus
                        onChange={e => setEditingText({ ...editingText, text: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            updateText(editingText.idx, editingText.text);
                            setEditingText(null);
                          }
                          if (e.key === "Escape") setEditingText(null);
                        }}
                        style={{
                          width: "100%", padding: "8px 10px", background: t.ib,
                          border: `1px solid ${t.ibr}`, borderRadius: 6,
                          fontSize: 14, color: t.tx, outline: "none", boxSizing: "border-box"
                        }} />
                      <div style={{ fontSize: 10, color: t.t3, marginTop: 6 }}>Enter로 확인, Esc로 취소</div>
                    </div>
                  </div>
                )}

                {/* Toast overlay */}
                {toast && (
                  <div style={{
                    position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                    padding: "10px 20px", background: "#333", color: "#fff", borderRadius: 8,
                    fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 20
                  }}>{toast}</div>
                )}

                {/* Bottom Sheet overlay */}
                {bottomSheet && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: t.card, borderTop: `1px solid ${t.cb}`,
                    borderRadius: "12px 12px 0 0", padding: "16px 20px", zIndex: 20,
                    boxShadow: "0 -4px 20px rgba(0,0,0,0.3)"
                  }}>
                    <div style={{ width: 40, height: 4, background: t.cb, borderRadius: 2, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 14, marginBottom: 12 }}>{bottomSheet}</div>
                    <button onClick={() => setBottomSheet(null)}
                      style={{ padding: "8px 16px", background: t.ac, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                      닫기
                    </button>
                  </div>
                )}

                {/* Modal overlay */}
                {modal && (
                  <div onClick={() => setModal(null)} style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20
                  }}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: t.card, borderRadius: 12, padding: 24, minWidth: 200,
                      border: `1px solid ${t.cb}`, textAlign: "center"
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 16 }}>{modal}</div>
                      <button onClick={() => setModal(null)}
                        style={{ padding: "8px 20px", background: t.ac, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                        확인
                      </button>
                    </div>
                  </div>
                )}

                {/* Interaction mode indicator */}
                {interactionMode && (
                  <div style={{
                    position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
                    padding: "4px 12px", background: t.gn, color: "#fff", borderRadius: 4,
                    fontSize: 11, fontWeight: 600, zIndex: 10
                  }}>
                    실행 모드 - 인터랙션 테스트 중
                  </div>
                )}
              </div>
              <div style={{ padding: "4px 12px", fontSize: 10, color: t.t3, borderTop: `1px solid ${t.cb}`, flexShrink: 0 }}>
                {interactionMode ? "요소를 클릭/롱프레스하면 등록된 인터랙션이 실행됩니다" : "클릭=선택, 더블클릭=텍스트 편집"}
              </div>
            </>
          ) : null}
        </div>


        {/* Floating Design Tool - between left and right panels */}
        {showPropsPanel && sel && (
          <div style={{ flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <DesignToolPanel
              style={sel.so}
              tagName={sel.tag}
              textContent={sel.tc}
              onChange={(key, value) => updateStyle(key, value)}
              onClose={() => { setShowPropsPanel(false); setSelIdx(null); }}
            />
          </div>
        )}

        {/* Right Panel: Storyboard only */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", background: t.card, borderLeft: `1px solid ${t.cb}` }}>
          <StoryboardPanel project={project} onUpdateProject={onSave} t={t} tokenSets={tokenSets} />
        </div>
      </div>
    </div>
  );
}
