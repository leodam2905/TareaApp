import fs from "node:fs";
import path from "node:path";

// Reads the generated pages off disk at build time. They are committed, so a
// build never depends on the Anthropic API being reachable — and a page that
// was never generated simply does not exist, rather than 500ing.
export interface FixPage {
  city: string; cityName: string; problem: string; problemTitle: string;
  generatedAt: string; metaTitle: string; metaDescription: string;
  intro: string; causes: string[]; whatProDoes: string[]; diyOrPro: string;
  priceNote: string; faqs: { q: string; a: string }[];
  price: { low: number; high: number; hourly: number };
  category: string; categoryLabel: string;
}

const DIR = path.join(process.cwd(), "content", "fix");

export function allFixPages(): FixPage[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as FixPage);
}

export function getFixPage(city: string, problem: string): FixPage | null {
  const file = path.join(DIR, `${city}__${problem}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as FixPage;
}
