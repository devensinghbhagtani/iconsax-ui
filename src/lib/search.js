// src/lib/search.js

// --- tokenization helpers ---
export function slugToTokens(text = "") {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []);
}
function uniq(arr) {
  const seen = new Set();
  return arr.filter(x => (seen.has(x) ? false : (seen.add(x), true)));
}

// --- tiny Levenshtein for optional fuzzy ---
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

// --- config defaults ---
const DEFAULT_CFG = {
  synonyms: {},
  categoryBoosts: [],
  weights: { overlap: 2.0, filename: 1.0, category: 1.0 },
  fuzzy: { enabled: false, maxDistance: 1 },
};

// Expand query by synonyms (phrase + token-level)
export function expandQueryTerms(query, synonyms = {}) {
  const q = (query || "").toLowerCase().trim();
  const qTokens = slugToTokens(q);
  const expanded = new Set(qTokens);

  if (synonyms[q]) {
    synonyms[q].forEach(s => slugToTokens(s).forEach(t => expanded.add(t)));
  }
  qTokens.forEach(t => {
    if (synonyms[t]) synonyms[t].forEach(s => slugToTokens(s).forEach(u => expanded.add(u)));
  });

  return Array.from(expanded);
}

// Core scoring (neutral & config-driven)
export function scoreRow(queryTerms, row, cfg = DEFAULT_CFG) {
  const weights = cfg.weights || DEFAULT_CFG.weights;
  const fuzzy = cfg.fuzzy || DEFAULT_CFG.fuzzy;
  const tokens = row.tokens || [];

  // Overlap (with optional fuzzy)
  let overlap = 0;
  if (fuzzy.enabled) {
    const maxd = Number(fuzzy.maxDistance || 1);
    for (const qt of queryTerms) {
      const hit = tokens.some(tk => qt === tk || editDistance(qt, tk) <= maxd);
      if (hit) overlap += 1;
    }
  } else {
    const set = new Set(tokens);
    for (const qt of queryTerms) if (set.has(qt)) overlap += 1;
  }

  // Filename signal
  const file = (row.fileName || "").toLowerCase();
  const filenameHit = queryTerms.some(t => t && file.includes(t)) ? 1 : 0;

  // Category boosts (config only)
  const cat = (row.category || "").toLowerCase();
  let catBoost = 0;
  (cfg.categoryBoosts || []).forEach(rule => {
    const m = (rule.match || "").toLowerCase();
    const w = Number(rule.weight || 0);
    if (m && cat.includes(m)) catBoost += w;
  });

  return overlap * Number(weights.overlap || 2.0)
       + filenameHit * Number(weights.filename || 1.0)
       + catBoost * Number(weights.category || 1.0);
}

// Run a search over an index
export function runSearch(index, cfg, query, selectedCategories = [], topk = 60) {
  const terms = expandQueryTerms(query, cfg.synonyms);
  const useTerms = terms.length ? terms : slugToTokens(query);

  const filtered = selectedCategories.length
    ? index.filter(r => selectedCategories.includes(r.category))
    : index;

  const scored = [];
  for (const r of filtered) {
    const s = scoreRow(useTerms, r, cfg);
    if (s > 0) scored.push({ s, r });
  }
  scored.sort((a, b) => (b.s - a.s) || a.r.fileName.localeCompare(b.r.fileName));
  return scored.slice(0, topk).map(({ s, r }) => ({ ...r, _score: Number(s.toFixed(3)) }));
}

// Fetch data (icons index + config) once
export async function loadData() {
  const [idxRes, cfgRes] = await Promise.all([
    fetch('/data/icons.index.ai.json'),
    fetch('/data/search_config.json'),
  ]);
  const index = await idxRes.json();
  const cfg = { ...DEFAULT_CFG, ...(await cfgRes.json()) };
  return { index, cfg };
}

// Derive category list
export function categoriesFromIndex(index) {
  const set = new Set(index.map(x => x.category));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
