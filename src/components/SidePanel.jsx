import React, { useEffect, useMemo, useState } from "react";
const SIZE_OPTIONS = [16, 20, 24, 32, 48, 64, 96, 128];
const STROKE_OPTIONS = [1, 1.5, 2];

export default function SidePanel({ item, onClose, onCopied }) {
  const [copied, setCopied] = useState(false);
  function fileBaseName(name = "") {
    return name.replace(/\.svg$/i, "");
  }
  function slugId(name = "") {
    return fileBaseName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  }

  // how many to show in the panel
  const MAX_TAGS = 24;

  // prettify + filter tokens a bit
  const prettyTag = (t = "") =>
    t.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const TAG_STOP = new Set([
    "svg",
    "line",
    "linear",
    "outline",
    "icon",
    "icons",
    "v1",
    "v2",
    "u",
    "id",
    "2",
    "3",
    "4",
  ]);

  const tags = useMemo(() => {
    const raw = Array.isArray(item?.tokens) ? item.tokens : [];
    const cleaned = raw
      .map((x) => String(x).toLowerCase())
      .filter((x) => x && x.length > 1 && !/^\d+$/.test(x) && !TAG_STOP.has(x));

    // de-dupe while keeping order
    const seen = new Set();
    const uniq = [];
    for (const t of cleaned) {
      if (!seen.has(t)) {
        seen.add(t);
        uniq.push(t);
      }
    }

    return uniq.slice(0, MAX_TAGS).map(prettyTag);
  }, [item]);

  // lock Size–Stroke scaling (optional)
  const [lockScale, setLockScale] = useState(false);
  const [sizeRef, setSizeRef] = useState(
    () => +localStorage.getItem("ui.size") || 24
  );
  const [strokeRef, setStrokeRef] = useState(
    () => +(localStorage.getItem("ui.stroke") || 1.5)
  );

  function clampStroke(v) {
    if (Number.isNaN(v)) return 1;
    return Math.max(0.1, Math.min(6, v));
  }

  function handleSizeChange(next) {
    if (!Number.isFinite(next) || next < 1) next = 1;
    // if locked, keep stroke roughly proportional to size change
    if (lockScale) {
      const ratio = next / (sizeRef || 1);
      const newStroke = clampStroke(parseFloat((strokeRef * ratio).toFixed(1)));
      setStroke(newStroke);
      // also push to localStorage via your existing useEffect
    }
    setSize(next);
    setSizeRef(next);
  }

  function handleStrokeChange(next) {
    if (!Number.isFinite(next) || next < 0.1) next = 0.1;
    setStroke(clampStroke(next));
    setStrokeRef(clampStroke(next));
  }

  // reset the flag when the selected icon changes
  useEffect(() => {
    setCopied(false);
  }, [item]);

  // avoid lingering timer if component unmounts
  useEffect(() => {
    let t;
    if (copied) t = setTimeout(() => setCopied(false), 10000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copySvg() {
    const s = bakeSvgForExport(); // your existing function
    await navigator.clipboard.writeText(s);
    setCopied(true);
    onCopied?.(item);
  }

  const [rawSvg, setRawSvg] = useState("");
  const [size, setSize] = useState(
    () => +localStorage.getItem("ui.size") || 24
  );
  const [stroke, setStroke] = useState(
    () => +(localStorage.getItem("ui.stroke") || 1.5)
  );
  const [colorMode, setColorMode] = useState(
    localStorage.getItem("ui.colorMode") || "black"
  );
  const [customHex, setCustomHex] = useState(
    localStorage.getItem("ui.customHex") || "#0b0d0f"
  );

  useEffect(() => {
    localStorage.setItem("ui.size", String(size));
  }, [size]);
  useEffect(() => {
    localStorage.setItem("ui.stroke", String(stroke));
  }, [stroke]);
  useEffect(() => {
    localStorage.setItem("ui.colorMode", colorMode);
  }, [colorMode]);
  useEffect(() => {
    localStorage.setItem("ui.customHex", customHex);
  }, [customHex]);

  const strokeColor = useMemo(
    () =>
      colorMode === "black"
        ? "#0b0d0f"
        : colorMode === "white"
        ? "#ffffff"
        : customHex || "#0b0d0f",
    [colorMode, customHex]
  );

  useEffect(() => {
    if (!item) return;
    fetch(item.fullPath)
      .then((r) => r.text())
      .then(setRawSvg)
      .catch(console.error);
  }, [item]);

  function bakeSvgForExport() {
    if (!rawSvg) return "";
    let s = rawSvg;

    // --- name hints for Figma ---
    const base = fileBaseName(item?.fileName || "icon");
    const rootId = slugId(base);

    // remove any existing <title> and add a new one right after <svg ...>
    s = s.replace(/<title>[\s\S]*?<\/title>/i, "");
    s = s.replace(/<svg([^>]*)>/i, (m, attrs) => {
      // ensure id + aria-label exist (merge if already present)
      let a = attrs;
      a = /id="/i.test(a)
        ? a.replace(/id="[^"]*"/i, `id="${rootId}"`)
        : `${a} id="${rootId}"`;
      a = /aria-label="/i.test(a)
        ? a.replace(/aria-label="[^"]*"/i, `aria-label="${base}"`)
        : `${a} aria-label="${base}"`;
      // we’ll set stroke/size later; just return svg open with title injected
      return `<svg${a}><title>${base}</title>`;
    });

    // --- style overrides (as you already had) ---
    s = s.replace(/stroke-width="[^"]*"/gi, `stroke-width="${stroke}"`);
    if (!/stroke-width="/i.test(s))
      s = s.replace(/<svg/i, `<svg stroke-width="${stroke}"`);

    s = s.replace(/stroke="[^"]*"/gi, `stroke="${strokeColor}"`);
    if (!/stroke="/i.test(s))
      s = s.replace(/<svg/i, `<svg stroke="${strokeColor}"`);

    // keep line look
    s = s.replace(/fill="[^"]*"/gi, `fill="none"`);

    // set explicit export size
    s = s.replace(/<svg([^>]*?)width="[^"]*"/i, `<svg$1`);
    s = s.replace(/<svg([^>]*?)height="[^"]*"/i, `<svg$1`);
    s = s.replace(/<svg/i, `<svg width="${size}" height="${size}"`);

    return s;
  }

  function bakeSvgForPreview() {
    if (!rawSvg) return "";
    let s = rawSvg;
    s = s.replace(/stroke-width="[^"]*"/gi, `stroke-width="${stroke}"`);
    if (!/stroke-width="/i.test(s))
      s = s.replace(/<svg/i, `<svg stroke-width="${stroke}"`);
    s = s.replace(/stroke="[^"]*"/gi, `stroke="${strokeColor}"`);
    if (!/stroke="/i.test(s))
      s = s.replace(/<svg/i, `<svg stroke="${strokeColor}"`);
    s = s.replace(/fill="[^"]*"/gi, `fill="none"`);
    s = s.replace(/<svg([^>]*?)\swidth="[^"]*"/i, `<svg$1`);
    s = s.replace(/<svg([^>]*?)\sheight="[^"]*"/i, `<svg$1`);
    return s;
  }

  function downloadSvg() {
    const s = bakeSvgForExport();
    const blob = new Blob([s], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = item?.fileName || "icon.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const previewUrl = useMemo(() => {
    const s = bakeSvgForPreview();
    return s ? `data:image/svg+xml;utf8,${encodeURIComponent(s)}` : "";
  }, [rawSvg, stroke, strokeColor]);

  if (!item) {
    return (
      <aside className="h-screen border-l border-tile-border bg-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold">Details</h3>
        </div>
        <p className="text-sm text-muted">
          Select an icon to edit stroke/size (export only), color, copy or
          download.
        </p>
      </aside>
    );
  }
  function prettyName(fileName = "") {
    const base = fileName.replace(/\.svg$/i, "").replace(/[-_]+/g, " ");
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const isWhite = colorMode === "white";

  return (
    <aside className="overflow-y-scroll h-screen border-l border-tile-border bg-white  flex flex-col">
      <div className=" bg-tile border-b border-tile-border">
        <h3 className="text-base font-semibold">{prettyName(item.fileName)}</h3>
        {/* <button
          className="h-9 px-3 rounded-lg border border-tile-border bg-panel"
          onClick={onClose}
        >
          Close
        </button> */}
        <div className="text-xs text-muted ">{item.category}</div>
      </div>
      {/* Icon-Display */}
      <div
        className="grid place-items-center bg-white
       bg-checker bg-[length:theme(backgroundSize.checker)] h-[260px] p-4"
      >
        {previewUrl ? (
          <img
            className={isWhite ? "img-white" : ""}
            src={previewUrl}
            alt={item.fileName}
            style={{ maxHeight: 200 }}
          />
        ) : (
          <img
            className={isWhite ? "img-white" : ""}
            src={item.fullPath}
            alt={item.fileName}
            style={{ maxHeight: 220 }}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center">
        <button
          className={`text-sm font-semibold py-4 w-full px-3 border-r-2 border-accent-border
    ${
      copied
        ? "bg-accent hover:bg-accent text-fg cursor-default"
        : "bg-accent hover:bg-accent-hover hover:text-accent cursor-pointer"
    }`}
          onClick={copySvg}
          disabled={copied || !rawSvg} // optional: disable until SVG loaded
          aria-live="polite"
        >
          {copied ? "COPIED!" : "COPY"}
        </button>

        <button
          className="py-4 text-sm font-semibold px-3 border-l border-accent-border bg-accent hover:bg-accent-hover hover:text-accent w-full cursor-pointer"
          onClick={downloadSvg}
        >
          DOWNLOAD
        </button>
      </div>

      {/* Settings */}
      {/* Size & Stroke – compact number inputs with px suffix + constraint button */}

      <div className="relative flex w-full flex-nowrap items-center gap-3 sm:justify-between max-sm:space-x-3 px-4 py-6">
        {/* SIZE */}
        <div className="flex flex-col w-full">
          <div className="min-h-5 underline-offset-4 hover:underline hover:decoration-dashed">
            <p className="flex text-left text-xs font-medium text-fg/70">
              Size
            </p>
          </div>

          <div className="max-h-[36px] w-full">
            <div className="group w-full relative bg-panel flex items-center justify-center h-8 rounded-[5px] border border-tile-border text-sm focus-within:border focus-within:border-fg/70 hover:border-fg/60">
              <input
                type="number"
                name="inputSize"
                min={1}
                step={1}
                title=""
                className="h-full w-7/12 rounded-[5px] bg-transparent font-semibold outline-none [appearance:textfield] text-fg
                     selection:bg-accent/40
                     [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={size}
                onChange={(e) =>
                  handleSizeChange(parseInt(e.target.value || "0", 10))
                }
              />
              <span className="text-fg/60">px</span>
            </div>
          </div>
        </div>

        {/* CONSTRAINT / LINK BUTTON */}
        <div className="relative ">
          <button
            type="button"
            onClick={() => setLockScale((v) => !v)}
            className={`flex size-8 items-center justify-center rounded
                  ${
                    lockScale
                      ? "text-fg bg-accent/60"
                      : "text-fg/60 bg-tile hover:text-fg"
                  }`}
            title={
              lockScale ? "Unlock size–stroke link" : "Lock size–stroke link"
            }
          >
            {/* link-like chevrons */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 12 21"
              fill="none"
              className="inline w-[12px]"
            >
              <path
                d="M2.6511 13.3411L2.65481 15.6166C2.65584 16.601 3.04771 17.5448 3.74428 18.2404C4.44086 18.9361 5.38514 19.3267 6.36958 19.3264C6.85745 19.3265 7.34057 19.2306 7.79133 19.0439C8.24209 18.8573 8.65166 18.5837 8.99664 18.2387C9.34161 17.8937 9.61524 17.4841 9.80187 17.0334C9.9885 16.5826 10.0845 16.0995 10.0844 15.6116L10.0844 13.3399"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.0831 8.38655L10.0855 6.12474C10.088 4.07102 8.42324 2.40625 6.37076 2.40501C5.3856 2.40454 4.44057 2.79534 3.7435 3.49149C3.04642 4.18764 2.65435 5.13214 2.65352 6.11731L2.65228 8.38531"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* STROKE */}
        <div className="flex flex-col w-full">
          <div className="min-h-5 underline-offset-4 hover:underline hover:decoration-dashed">
            <p className="flex text-left text-xs font-medium text-fg/70">
              Stroke
            </p>
          </div>

          <div className="max-h-[36px] w-full">
            <div className="group relative bg-panel flex items-center justify-center h-8 rounded-[5px] border border-tile-border text-sm focus-within:border focus-within:border-fg/70 hover:border-fg/60 w-full">
              <input
                type="number"
                name="inputStroke"
                min={0.1}
                step={0.1}
                title=""
                className="h-full w-7/12 rounded-[5px] bg-transparent font-semibold outline-none [appearance:textfield] text-fg
                     selection:bg-accent/40
                     [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={stroke}
                onChange={(e) =>
                  handleStrokeChange(parseFloat(e.target.value || "0"))
                }
              />
              <span className="text-fg/60">px</span>
            </div>
          </div>
        </div>
      </div>

      {/* COLOR group (unchanged from your current block) */}
      {/* <div className="flex items-center gap-2 bg-control rounded-lg px-3 py-1.5">
        <span className="text-xs text-muted">Color</span>
        <div className="flex gap-2">
          <button
            className="w-7 h-7 rounded-md border border-tileBorder bg-black"
            onClick={() => setColorMode("black")}
            title="Black"
          />
          <button
            className="w-7 h-7 rounded-md border border-tileBorder bg-white"
            onClick={() => setColorMode("white")}
            title="White"
          />
          <button
            className="w-7 h-7 rounded-md border border-tileBorder"
            style={{
              background: "linear-gradient(135deg, #4da3ff, #d94dff)",
            }}
            onClick={() => setColorMode("custom")}
            title="Custom"
          />
        </div>
        {colorMode === "custom" && (
          <input
            type="color"
            className="h-9 rounded-lg border border-tileBorder bg-panel px-2"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
          />
        )}
      </div> */}

      {/* TAGS */}
      <div className="px-4 py-6 border-t border-tile-border mt-2 border-b">
        <div className="flex items-center justify-between">
          <span className="flex text-left text-xs font-medium text-fg/70 underline-offset-4 hover:underline hover:decoration-dashed">
            TAGS
          </span>
          {/* <span className="flex text-left text-xs font-medium text-fg/70">
            All tags
          </span> */}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.length ? (
            tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-tile-border bg-white px-3 py-1 text-xs text-fg/70"
              >
                {t}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">No tags</span>
          )}
        </div>
      </div>

      {/* <div className="text-xs px-4 pt-4 text-muted">
        Preview stays fixed. Copy/Download apply your selected Stroke & Size.
      </div> */}
    </aside>
  );
}
