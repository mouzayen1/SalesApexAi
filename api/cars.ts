import type { VercelRequest, VercelResponse } from "@vercel/node";
import Papa from "papaparse";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const csvUrl = `${protocol}://${host}/inventory.csv`;

    const response = await fetch(csvUrl);
    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(parsed.data);
  } catch (error) {
    console.error("CSV load error:", error);
    res.status(500).json({ error: "Failed to load inventory" });
  }
}
