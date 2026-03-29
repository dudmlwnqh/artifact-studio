import { useState } from "react";
import { PRESETS, createTokenSetFromPreset } from "../data/tokenPresets.js";

export default function TokenSetManager({ tokenSets, setTokenSets, onEditSet, t }) {
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameName, setRenameName] = useState("");

  const addFromPreset = (preset) => {
    const newSet = createTokenSetFromPreset(preset);
    setTokenSets((prev) => [...prev, newSet]);
    setShowPresetModal(false);
  };

  const duplicateSet = (ts) => {
    const now = Date.now();
    const dup = {
      ...JSON.parse(JSON.stringify(ts)),
      id: "ts_" + now,
      name: ts.name + " (복사)",
      createdAt: now,
      updatedAt: now,
    };
    setTokenSets((prev) => [...prev, dup]);
    setMenuOpen(null);
  };

  const deleteSet = (id) => {
    setTokenSets((prev) => prev.filter((s) => s.id !== id));
    setMenuOpen(null);
  };

  const startRename = (ts) => {
    setRenaming(ts.id);
    setRenameName(ts.name);
    setMenuOpen(null);
  };

  const finishRename = (id) => {
    if (renameName.trim()) {
      setTokenSets((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, name: renameName.trim(), updatedAt: Date.now() } : s
        )
      );
    }
    setRenaming(null);
  };

  const SWATCH_KEYS = ["brand", "bg", "text", "success", "error"];

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {tokenSets.map((ts) => (
          <div
            key={ts.id}
            style={{
              background: t.card,
              borderRadius: 10,
              border: `1px solid ${t.cb}`,
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              transition: "border-color 0.15s",
            }}
            onClick={() => onEditSet(ts)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = t.ac)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = t.cb)
            }
          >
            {/* 색상 스와치 헤더 */}
            <div
              style={{
                display: "flex",
                gap: 0,
                height: 40,
              }}
            >
              {SWATCH_KEYS.map((key) => (
                <div
                  key={key}
                  style={{
                    flex: 1,
                    background: ts.colors[key] || "#333",
                  }}
                />
              ))}
            </div>

            {/* 정보 */}
            <div style={{ padding: "10px 12px" }}>
              {renaming === ts.id ? (
                <input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onBlur={() => finishRename(ts.id)}
                  onKeyDown={(e) => e.key === "Enter" && finishRename(ts.id)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{
                    width: "100%",
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.tx,
                    background: t.ib,
                    border: `1px solid ${t.ac}`,
                    borderRadius: 4,
                    padding: "2px 6px",
                    outline: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.tx,
                    marginBottom: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ts.name}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  color: t.t3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ts.desc || "설명 없음"}
              </div>
            </div>

            {/* 메뉴 버튼 */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(menuOpen === ts.id ? null : ts.id);
              }}
              style={{
                position: "absolute",
                top: 44,
                right: 6,
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                cursor: "pointer",
                color: t.t3,
                fontSize: 14,
              }}
            >
              ⋮
            </div>

            {/* 드롭다운 메뉴 */}
            {menuOpen === ts.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: 70,
                  right: 6,
                  background: t.card,
                  border: `1px solid ${t.cb}`,
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 10,
                  minWidth: 100,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {[
                  { label: "복제", action: () => duplicateSet(ts) },
                  { label: "이름 변경", action: () => startRename(ts) },
                  { label: "삭제", action: () => deleteSet(ts.id), danger: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      color: item.danger ? "#F44336" : t.tx,
                      cursor: "pointer",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = t.abg)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 새 토큰 세트 추가 카드 */}
        <div
          onClick={() => setShowPresetModal(true)}
          style={{
            background: "transparent",
            borderRadius: 10,
            border: `1px dashed ${t.cb}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            minHeight: 110,
            color: t.t3,
            gap: 6,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = t.ac)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = t.cb)
          }
        >
          <span style={{ fontSize: 20 }}>+</span>
          <span style={{ fontSize: 11 }}>새 토큰 세트</span>
        </div>
      </div>

      {/* 프리셋 선택 모달 */}
      {showPresetModal && (
        <div
          onClick={() => setShowPresetModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "80vh",
              overflow: "auto",
              background: t.card,
              borderRadius: 14,
              padding: 24,
              border: `1px solid ${t.cb}`,
            }}
          >
            <h3
              style={{ margin: "0 0 6px", fontSize: 17, color: t.tx }}
            >
              프리셋에서 시작하기
            </h3>
            <p
              style={{ margin: "0 0 16px", fontSize: 12, color: t.t3 }}
            >
              검증된 디자인 시스템을 기반으로 새 토큰 세트를 생성합니다.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              {PRESETS.map((p) => (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: `1px solid ${t.cb}`,
                    background: t.bg,
                  }}
                  onClick={() => addFromPreset(p)}
                >
                  <div
                    style={{
                      height: 50,
                      background: p.header,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {p.desc}
                    </div>
                  </div>
                  <div style={{ padding: "8px 12px" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginBottom: 6,
                      }}
                    >
                      {[
                        p.colors.brand,
                        p.colors.bgCard || p.colors.bg,
                        p.colors.text,
                        p.colors.success,
                        p.colors.error,
                      ].map((c, i) => (
                        <div
                          key={i}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            background: c,
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: t.t3 }}>
                      {p.style}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPresetModal(false)}
              style={{
                width: "100%",
                marginTop: 14,
                padding: 8,
                border: `1px solid ${t.cb}`,
                background: "transparent",
                color: t.t3,
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
