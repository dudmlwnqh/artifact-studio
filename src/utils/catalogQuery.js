/**
 * catalogQuery.js
 * catalogData(node[]) 에 대한 쿼리 유틸
 *
 * catalogData = { nodes: Node[], pool_indexes: { [pool]: node_id[] }, origins: { [origin_id]: node_id[] } }
 */

// ─────────────────────────────────────────────
// 레벨별 필터
// ─────────────────────────────────────────────
const byLevel = (nodes, level) => nodes.filter(n => n.granularity_level === level);

export const q = {
  // ── 레벨별 목록 ──────────────────────────────
  pages:      (catalog) => byLevel(catalog.nodes, 0),
  sections:   (catalog) => byLevel(catalog.nodes, 1),
  components: (catalog) => byLevel(catalog.nodes, 2),
  atoms:      (catalog) => byLevel(catalog.nodes, 3),
  elements:   (catalog) => byLevel(catalog.nodes, 4),
  tokens:     (catalog) => byLevel(catalog.nodes, 5),
  assets:     (catalog) => byLevel(catalog.nodes, 6),

  // ── Foundation 서브필터 (token 레벨) ─────────
  colors:     (catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'color'),
  typography: (catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'typography'),
  spacing:    (catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'spacing'),
  radii:      (catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'radius'),
  shadows:    (catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'shadow'),
  transitions:(catalog) => byLevel(catalog.nodes, 5).filter(n => n.token_type === 'transition'),

  // ── Asset 서브필터 (visual_asset 레벨) ───────
  textures:   (catalog) => byLevel(catalog.nodes, 6).filter(n => n.asset_format === 'texture' || n.subtype === 'texture'),
  icons:      (catalog) => byLevel(catalog.nodes, 6).filter(n => /icon/i.test(n.type)),
  illustrations:(catalog)=> byLevel(catalog.nodes, 6).filter(n => /illust|character|mascot/i.test(n.type)),
  motions:    (catalog) => byLevel(catalog.nodes, 6).filter(n => /lottie|animation|motion/i.test(n.asset_format || n.type)),

  // ── 트리 탐색 ────────────────────────────────
  children(catalog, node_id) {
    const node = catalog.nodes.find(n => n.node_id === node_id);
    if (!node) return [];
    return catalog.nodes.filter(n => n.parent_id === node_id);
  },

  ancestors(catalog, node_id) {
    const node = catalog.nodes.find(n => n.node_id === node_id);
    if (!node || !node.parent_chain?.length) return [];
    const chainSet = new Set(node.parent_chain);
    return catalog.nodes.filter(n => chainSet.has(n.node_id));
  },

  siblings(catalog, node_id) {
    const node = catalog.nodes.find(n => n.node_id === node_id);
    if (!node) return [];
    return catalog.nodes.filter(n => n.parent_id === node.parent_id && n.node_id !== node_id);
  },

  fromOrigin(catalog, origin_id) {
    const ids = catalog.origins?.[origin_id] || [];
    const idSet = new Set(ids);
    return catalog.nodes.filter(n => idSet.has(n.node_id));
  },

  // 특정 노드를 참조하는 다른 origin들
  usedIn(catalog, node_id) {
    return catalog.nodes.filter(n => n.source_refs?.includes(node_id));
  },

  // ── 검색 ────────────────────────────────────
  search(catalog, query, { level, domain, pool } = {}) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    let nodes = catalog.nodes;
    if (level !== undefined) nodes = byLevel(nodes, level);
    if (domain) nodes = nodes.filter(n => n.domain === domain);
    if (pool) nodes = nodes.filter(n => n.pool_targets?.includes(pool));

    return nodes.filter(n => {
      const haystack = [
        n.name, n.name_en, n.type, n.subtype,
        n.category_path, n.domain,
        ...(n.tags || []), ...(n.search_keys || []),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  },

  // ── Pool 브라우저 ────────────────────────────
  pool(catalog, pool_name) {
    const ids = catalog.pool_indexes?.[pool_name] || [];
    const idSet = new Set(ids);
    return catalog.nodes.filter(n => idSet.has(n.node_id));
  },

  poolNames(catalog) {
    return Object.keys(catalog.pool_indexes || {});
  },

  // ── 통계 ────────────────────────────────────
  stats(catalog) {
    const nodes = catalog.nodes;
    const levels = [0,1,2,3,4,5,6];
    const names = ['page','section','component','atom','element','token','visual_asset'];
    const counts = {};
    levels.forEach(lv => { counts[names[lv]] = byLevel(nodes, lv).length; });
    const totalColors = byLevel(nodes, 5).filter(n => n.token_type === 'color').length;
    return {
      total: nodes.length,
      byLevel: counts,
      totalColors,
      origins: Object.keys(catalog.origins || {}).length,
      pools: Object.keys(catalog.pool_indexes || {}).length,
    };
  },

  // ── 재사용 가능 필터 ────────────────────────
  reusable(catalog, level) {
    let nodes = catalog.nodes.filter(n => n.reusable);
    if (level !== undefined) nodes = byLevel(nodes, level);
    return nodes;
  },

  // ── confidence 기준 필터 ─────────────────────
  confident(catalog, minConfidence = 0.7, level) {
    let nodes = catalog.nodes.filter(n => n.confidence >= minConfidence);
    if (level !== undefined) nodes = byLevel(nodes, level);
    return nodes;
  },

  // ── origin별 그룹핑 ─────────────────────────
  groupByOrigin(catalog) {
    const map = {};
    for (const node of catalog.nodes) {
      if (!map[node.origin_id]) map[node.origin_id] = [];
      map[node.origin_id].push(node);
    }
    return map;
  },

  // ── category_path 기준 그룹핑 ───────────────
  groupByCategory(catalog, level) {
    let nodes = level !== undefined ? byLevel(catalog.nodes, level) : catalog.nodes;
    const map = {};
    for (const node of nodes) {
      const key = node.category_path || 'uncategorized';
      if (!map[key]) map[key] = [];
      map[key].push(node);
    }
    return map;
  },

  // ── 단일 노드 fetch ──────────────────────────
  get(catalog, node_id) {
    return catalog.nodes.find(n => n.node_id === node_id) || null;
  },
};

// ─────────────────────────────────────────────
// 빈 catalogData 초기값
// ─────────────────────────────────────────────
export const EMPTY_CATALOG = { nodes: [], pool_indexes: {}, origins: {} };

// ─────────────────────────────────────────────
// catalogData를 localStorage에 직렬화/역직렬화
// ─────────────────────────────────────────────
export function serializeCatalog(catalog) {
  return JSON.stringify(catalog);
}

export function deserializeCatalog(json) {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.nodes)) return parsed;
    return EMPTY_CATALOG;
  } catch {
    return EMPTY_CATALOG;
  }
}
