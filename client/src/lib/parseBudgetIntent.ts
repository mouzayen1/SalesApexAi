export type BudgetIntent = {
  down?: number;
  targetMonthly?: number;
  termMonths?: number;
  apr?: number;
};

function parseNumberToken(raw: string): number | null {
  const t = raw.toLowerCase().replace(/[$,]/g, "").trim();

  const kMatch = t.match(/^(\d+(\.\d+)?)\s*(k|grand)$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function findMoneyBefore(text: string, keyword: string): number | null {
  // "5k down", "400 a month"
  const re = new RegExp(`(\\d+[\\d,]*\\.?\\d*\\s*(k|grand)?)\\s+${keyword}`, "i");
  const m = text.toLowerCase().match(re);
  if (!m) return null;
  return parseNumberToken(m[1]);
}

function findAPR(text: string): number | null {
  const t = text.toLowerCase();
  const pct = t.match(/(\d+(\.\d+)?)\s*%/);
  if (pct) return Number(pct[1]);

  const pct2 = t.match(/(\d+(\.\d+)?)\s*(percent)\b/);
  if (pct2) return Number(pct2[1]);

  const apr = t.match(/\bapr\s*(\d+(\.\d+)?)/);
  if (apr) return Number(apr[1]);

  return null;
}

function findTermMonths(text: string): number | null {
  const t = text.toLowerCase();
  const m1 = t.match(/(\d+)\s*(months|month|mos|mo)\b/);
  if (m1) return Number(m1[1]);
  const y1 = t.match(/(\d+)\s*(years|year|yrs|yr)\b/);
  if (y1) return Number(y1[1]) * 12;
  return null;
}

export function parseBudgetIntent(transcript: string): BudgetIntent | null {
  const t = transcript.toLowerCase();

  const down = findMoneyBefore(t, "down");
  const monthly =
    findMoneyBefore(t, "month") ??
    findMoneyBefore(t, "monthly") ??
    findMoneyBefore(t, "a month");

  const termMonths = findTermMonths(t);
  const apr = findAPR(t);

  // Only trigger budget intent if it includes BOTH down + monthly target
  if (down == null || monthly == null) return null;

  return {
    down,
    targetMonthly: monthly,
    termMonths: termMonths ?? undefined,
    apr: apr ?? undefined
  };
}
