import React from "react";

function prettyName(fileName = "") {
  const base = fileName.replace(/\.svg$/i, "").replace(/[-_]+/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ResultCard({
  item,
  onSelect,
  previewSize = 96,
  colorMode,
  selected,
  onRemove,
}) {
  const title = prettyName(item.fileName);
  const isWhite = colorMode === "white";

  return (
    <div
      className={`card relative cursor-pointer rounded-lg bg-tile p-4 hover:ring-1 hover:ring-fg/70 hover:ring-inset  ${
        selected ? " ring-1 ring-fg/70 ring-inset " : ""
      }`}
      onClick={() => onSelect?.(item)}
      tabIndex={-1}
      data-id={item.id}
    >
      {/* {onRemove && (
        <button
          className="absolute right-1.5 top-1.5 h-[16px] w-[16px] rounded-full border-2 border-fg/860 text-fg/80 flex items-center font-semibold justify-center border-tileBorder bg-white text-sm cursor-pointer hover:border-fg/80 hover:border-fg/80 hover:text-fg/80"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item);
          }}
          title="Remove from recents"
        >
          ×
        </button>
      )} */}

      <div className="grid place-items-center ">
        <img
          className={isWhite ? "img-white" : ""}
          style={{
            height: 40,
            maxHeight: `${previewSize}px`,
            maxWidth: "100%",
          }}
          src={item.fullPath}
          alt={item.fileName}
        />
      </div>

      {/* <div className="truncate text-[12px]" title={title}>
        {title}
      </div>
      <div className="text-[11px] text-muted">{item.category}</div> */}
    </div>
  );
}
