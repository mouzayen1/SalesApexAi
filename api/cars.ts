import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";

/**
 * Very small CSV parser that handles:
 * - commas
 * - quoted fields with commas
 * - newlines
 * It does not handle every edge case in the universe, but it’s perfect for a demo inventory.
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalize newlines
  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      // Handle escaped quotes ("")
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (c === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\n" && !inQuotes) {
      row.push(field);
      field = "";
      // ignore totally empty trailing lines
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += c;
  }

  // last field/row
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1);

  return data.map((cells) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (cells[i] ?? "").trim();
    }
    return obj;
  });
}

// helper conversions
const toNum = (v: string) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const toInt = (v: string) => {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // This path is inside your repo and WILL be bundled into the serverless function
    const csvPath = path.join(process.cwd(), "client", "public", "inventory.csv");

    if (!fs.existsSync(csvPath)) {
      return res.status(200).json({
        cars: [],
        source: "csv",
        message: `inventory.csv not found at ${csvPath}`,
      });
    }

    const csvText = fs.readFileSync(csvPath, "utf-8");
    const rows = parseCSV(csvText);

    // IMPORTANT: map CSV columns to the fields your UI expects.
    // Your CSV header should include at least:
    // id,year,make,model,trim,price,miles,body,drivetrain,transmission,fuel,color,seats,mpg_city,mpg_hwy,features,image_url
    const cars = rows.map((r) => ({
      id: r.id || r._id || `${r.year}-${r.make}-${r.model}-${Math.random().toString(16).slice(2)}`,
      year: toInt(r.year) ?? 0,
      make: r.make || "",
      model: r.model || "",
      trim: r.trim || "",
      price: toNum(r.price) ?? 0,
      miles: toNum(r.miles) ?? 0,
      body: r.body || r.body_style || "",
      drivetrain: (r.drivetrain || "").toUpperCase(),
      transmission: r.transmission || "",
      fuel: r.fuel || "",
      color: r.color || "",
      seats: toInt(r.seats) ?? undefined,
      mpg_city: toNum(r.mpg_city) ?? undefined,
      mpg_hwy: toNum(r.mpg_hwy) ?? undefined,
      features: (r.features || "")
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
      image_url: r.image_url || "",
    }));

    // Helpful for debugging in your UI
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      cars,
      source: "csv",
      count: cars.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      cars: [],
      source: "csv",
      error: err?.message || "Unknown error",
    });
  }
}
