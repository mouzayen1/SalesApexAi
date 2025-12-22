import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";

/**
 * Minimal CSV parser that supports quoted fields with commas.
 * Good enough for inventory.csv style files.
 */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = splitCSVLine(lines[0]).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 0) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = (cols[j] ?? "").trim();
    }
    rows.push(row);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
      // toggle quote mode (handles standard CSV quotes)
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);

  return out;
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function splitFeatures(value: string): string[] {
  // Your CSV "features" column is usually comma-separated inside quotes.
  // We’ll split by comma and trim.
  return value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // In this repo, the CSV is stored in client/public/inventory.csv
    const csvPath = path.join(process.cwd(), "client", "public", "inventory.csv");
    const csvText = fs.readFileSync(csvPath, "utf8");

    const raw = parseCSV(csvText);

    // Normalize into the shape your UI expects
    const vehicles = raw.map((r) => ({
      id: r.id || r._id || `${r.make ?? ""}-${r.model ?? ""}-${r.year ?? ""}-${Math.random()}`,
      year: toNumber(r.year) ?? undefined,
      make: r.make || "",
      model: r.model || "",
      trim: r.trim || "",
      price: toNumber(r.price) ?? undefined,
      miles: toNumber(r.miles) ?? undefined,
      body: r.body || r.body_style || "",
      drivetrain: (r.drivetrain || "").toUpperCase(),
      transmission: r.transmission || "",
      fuel: r.fuel || "",
      color: r.color || "",
      seats: toNumber(r.seats) ?? undefined,
      mpg_city: toNumber(r.mpg_city) ?? undefined,
      mpg_hwy: toNumber(r.mpg_hwy) ?? undefined,
      features: splitFeatures(r.features || ""),
      image_url: r.image_url || "",
    }));

    res.status(200).json({ vehicles, count: vehicles.length });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to load inventory.csv",
      detail: err?.message ?? String(err),
    });
  }
}
