import React, { useEffect, useRef, useState } from "react";
import ResultCard from "./components/ResultCard.jsx";
import SidePanel from "./components/SidePanel.jsx";
import { loadData, runSearch } from "./lib/search.js";

const LS_RECENTS = "recent.icons";
const LS_QUERY = "ui.query";
const LS_SELECTED_ID = "ui.selectedId";

export default function App() {
  const [index, setIndex] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [concepts, setConcepts] = useState({});
  const [query, setQuery] = useState(localStorage.getItem(LS_QUERY) || "");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("loading");
  const [gridColorMode, setGridColorMode] = useState("black");
  const [selected, setSelected] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recents, setRecents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_RECENTS) || "[]");
    } catch {
      return [];
    }
  });
  const gridRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { index, cfg, concepts } = await loadData();
        const base = import.meta.env.BASE_URL || "/";
        const norm = index.map((r) => {
          const cleaned = (r.fullPath || "")
            .replaceAll("\\", "/")
            .replace(/^([A-Za-z]:)?\/?Icons/i, "/icons")
            .replace(/^\/+/, "");
          return { ...r, fullPath: base + cleaned };
        });
        setIndex(norm);
        setCfg(cfg);
        if (concepts) setConcepts(concepts);
        setStatus("ready");
      } catch (e) {
        console.error(e);
        setStatus("error");
      }
    })();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !cfg) return;
    const out = runSearch(index, cfg, query, [], 300, concepts || {});
    setResults(out);
    localStorage.setItem(LS_QUERY, query);

    const savedId = localStorage.getItem(LS_SELECTED_ID);
    if (savedId && out.length) {
      const idx = out.findIndex((x) => x.id === savedId);
      if (idx >= 0) {
        setSelected(out[idx]);
        setSelectedIndex(idx);
        return;
      }
    }
    setSelected(null);
    setSelectedIndex(-1);
  }, [status, cfg, index, query]);

  useEffect(() => {
    localStorage.setItem(LS_RECENTS, JSON.stringify(recents.slice(0, 30)));
  }, [recents]);

  function handleSelect(item, idx) {
    setSelected(item);
    setSelectedIndex(idx ?? results.findIndex((r) => r.id === item.id));
    localStorage.setItem(LS_SELECTED_ID, item.id);
  }
  function handleCopied(item) {
    setRecents((prev) =>
      [
        { id: item.id, ...item, ts: Date.now() },
        ...prev.filter((x) => x.id !== item.id),
      ].slice(0, 30)
    );
  }
  function removeRecent(item) {
    setRecents((prev) => prev.filter((x) => x.id !== item.id));
  }

  // keyboard nav
  useEffect(() => {
    function onKeyDown(e) {
      if (!results.length) return;
      const columns = computeColumns(gridRef.current);
      let next = selectedIndex;
      if (e.key === "ArrowRight")
        next = Math.min(
          (selectedIndex < 0 ? 0 : selectedIndex) + 1,
          results.length - 1
        );
      if (e.key === "ArrowLeft")
        next = Math.max((selectedIndex < 0 ? 0 : selectedIndex) - 1, 0);
      if (e.key === "ArrowDown")
        next = Math.min(
          (selectedIndex < 0 ? 0 : selectedIndex) + columns,
          results.length - 1
        );
      if (e.key === "ArrowUp")
        next = Math.max((selectedIndex < 0 ? 0 : selectedIndex) - columns, 0);
      if (next !== selectedIndex) {
        e.preventDefault();
        handleSelect(results[next], next);
        scrollCardIntoView(next);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [results, selectedIndex]);

  function computeColumns(container) {
    if (!container) return 6;
    const w = container.clientWidth;
    const card = 132; // ~min tile + gap
    return Math.max(1, Math.floor(w / card));
  }
  function scrollCardIntoView(idx) {
    const c = gridRef.current;
    if (!c) return;
    c.querySelectorAll(".card")[idx]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }

  const GRID_ICON_SIZE = 96;
  const showRecents = !query && recents.length > 0;

  return (
    <div className="grid grid-cols-[1fr_360px] h-screen ">
      {/* <div className="justify-between w-[30vw] rounded-lg border-2 border-[#97dc1f]  bg-[#EFFFD3] px-2 py-2 outline-none mt-3 flex gap-2"></div> */}
      {/* LEFT */}
      <div className="overflow-auto p-8">
        <div className=" w-full justify-between items-center pb-4 border-b border-tile-border mb-6">
          {/* <img className="h-20" src="public\data\kadak logo.png" alt="" />{" "} */}
          <div className="justify-between w-[30vw] rounded-lg border-2 border-tile-border px-2 py-2 outline-none flex gap-2">
            <input
              className="focus:outline-none w-full"
              placeholder="Search from 2000+ icons"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="text-sm underline text-fg/60 hover:text-fg/90 hover:cursor-pointer"
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          </div>
          <div className="flex gap-1 pb-2 pt-6 text-3xl text-fg/90">
            {/* <div className="flex items-center gap-2 bg-control rounded-lg px-3 py-1.5">
            <span className="text-xs text-muted">Color</span>
            <div className="flex gap-2">
              <button
                className="w-7 h-7 rounded-md border border-tileBorder bg-black"
                title="Black"
                onClick={() => setGridColorMode("black")}
              />
              <button
                className="w-7 h-7 rounded-md border border-tileBorder bg-white"
                title="White"
                onClick={() => setGridColorMode("white")}
              />
            </div>
          </div> */}
            <span className="font-bold ">
              {results.length} result{results.length === 1 ? "" : "s"}
            </span>
            {query && (
              <>
                {" "}
                <span>
                  for <span className="">“{query}”</span>
                </span>
              </>
            )}
          </div>
        </div>

        {showRecents && (
          <>
            {/* <h4 className="mt-2 mb-6 text-sm  ">Recently Copied</h4> */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-3 mb-4">
              {recents.map((r) => (
                <ResultCard
                  key={`recent-${r.id}`}
                  item={r}
                  selected={selected?.id === r.id}
                  onSelect={(it) => handleSelect(it)}
                  previewSize={GRID_ICON_SIZE}
                  colorMode={gridColorMode}
                  onRemove={removeRecent}
                />
              ))}
            </div>
          </>
        )}

        <div
          ref={gridRef}
          className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-3"
        >
          {results.map((item, i) => (
            <ResultCard
              key={item.id}
              item={item}
              selected={i === selectedIndex}
              onSelect={(it) => handleSelect(it, i)}
              previewSize={GRID_ICON_SIZE}
              colorMode={gridColorMode}
            />
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <SidePanel
        item={selected}
        onClose={() => setSelected(null)}
        onCopied={handleCopied}
      />
    </div>
  );
}
