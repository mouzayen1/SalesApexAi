import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Car } from "@shared/schema";
import type { Filters } from "../lib/extractFilters";

type SortMode = "best" | "price_asc" | "miles_asc" | "year_desc";

function chipLabel(filters: Filters): string[] {
  const chips: string[] = [];
  if (filters.bodyStyle && filters.bodyStyle.length > 0) chips.push(...filters.bodyStyle.map(s => s.toUpperCase()));
  if (filters.drivetrain && filters.drivetrain.length > 0) chips.push(...filters.drivetrain.map(d => d.toUpperCase()));
  if (filters.make && filters.make.length > 0) chips.push(...filters.make.map(m => m.toUpperCase()));
  if (typeof filters.minYear === "number") chips.push(`${filters.minYear}+`);
  if (typeof filters.maxMiles === "number") chips.push(`≤${filters.maxMiles.toLocaleString()} mi`);
  if (typeof filters.maxPrice === "number") chips.push(`≤$${filters.maxPrice.toLocaleString()}`);
  if (typeof filters.minPrice === "number") chips.push(`≥$${filters.minPrice.toLocaleString()}`);
  if (filters.features && filters.features.length > 0) filters.features.forEach((f) => chips.push(f));
  return chips;
}

function formatTitle(title: string) {
  return title?.trim() || "Results";
}

export default function ResultsBottomSheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  filters: Filters;
  cars: Car[];
  onClear: () => void;
  onChangeSort: (mode: SortMode) => void;
  sortMode: SortMode;
}) {
  const { open, onClose, title, subtitle, filters, cars, onClear, onChangeSort, sortMode } = props;

  const [snap, setSnap] = useState<0 | 1 | 2>(1);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const startSnap = useRef<0 | 1 | 2>(1);

  const snapHeights = useMemo(() => [25, 55, 90] as const, []);

  useEffect(() => {
    if (open) setSnap(1);
  }, [open]);

  const chips = useMemo(() => chipLabel(filters), [filters]);

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    startSnap.current = snap;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;

    if (dy > 60) {
      if (startSnap.current === 2) setSnap(1);
      else if (startSnap.current === 1) setSnap(0);
      else if (startSnap.current === 0) onClose();
      startY.current = null;
    } else if (dy < -60) {
      if (startSnap.current === 0) setSnap(1);
      else if (startSnap.current === 1) setSnap(2);
      startY.current = null;
    }
  }

  function onPointerUp() {
    startY.current = null;
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 50,
        }}
      />

      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${snapHeights[snap]}vh`,
          background: "rgba(15, 23, 42, 0.98)",
          color: "white",
          zIndex: 60,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: "0 -12px 30px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            padding: "10px 14px 8px",
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.28)", margin: "0 auto 10px" }} />
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{formatTitle(title)}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{subtitle}</div>
            </div>

            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "rgba(255,255,255,0.10)",
                color: "white",
                padding: "8px 10px",
                borderRadius: 10,
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {chips.length ? (
              chips.map((c, idx) => (
                <span key={`${c}-${idx}`} style={{ fontSize: 12, whiteSpace: "nowrap", background: "rgba(255,255,255,0.10)", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)" }}>
                  {c}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 12, opacity: 0.75 }}>No filters detected</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <select
              value={sortMode}
              onChange={(e) => onChangeSort(e.target.value as SortMode)}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
              }}
            >
              <option value="best">Best match</option>
              <option value="price_asc">Lowest price</option>
              <option value="miles_asc">Lowest miles</option>
              <option value="year_desc">Newest year</option>
            </select>

            <button
              onClick={onClear}
              style={{
                background: "rgba(239,68,68,0.18)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "white",
                borderRadius: 10,
                padding: "10px 12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={{ padding: "10px 14px 14px", overflow: "auto" }}>
          {cars.length === 0 ? (
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 14, fontSize: 14, opacity: 0.9 }}>
              No matches found. Try changing budget, body type, or mileage.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {cars.map((car, i) => {
                const featuresList = car.features ? car.features.split(';') : [];
                return (
                  <div
                    key={car.id || `${car.make}-${car.model}-${i}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "104px 1fr",
                      gap: 12,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.04)" }}>
                      {car.imageUrl ? (
                        <img src={car.imageUrl} alt={`${car.year} ${car.make} ${car.model}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", opacity: 0.55 }}>No image</div>
                      )}
                    </div>

                    <div style={{ padding: 12, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, lineHeight: 1.2 }}>
                        {car.year} {car.make} {car.model}
                        {car.trim ? ` ${car.trim}` : ""}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, opacity: 0.9 }}>
                        <span>${car.price.toLocaleString()}</span>
                        <span>•</span>
                        <span>{car.mileage.toLocaleString()} mi</span>
                        {car.body_style ? (
                          <>
                            <span>•</span>
                            <span>{car.body_style}</span>
                          </>
                        ) : null}
                        {car.drivetrain ? (
                          <>
                            <span>•</span>
                            <span>{car.drivetrain}</span>
                          </>
                        ) : null}
                        {car.transmission ? (
                          <>
                            <span>•</span>
                            <span>{car.transmission}</span>
                          </>
                        ) : null}
                      </div>

                      {featuresList.length ? (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {featuresList.slice(0, 5).map((f) => (
                            <span key={f} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", opacity: 0.95 }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 10 }} />
        </div>
      </div>
    </>
  );
}
