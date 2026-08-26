// Generates the copy for the /fix/[city]/[problem] pages.
//
// RUN OFFLINE, COMMIT THE OUTPUT. Nothing here executes at request time: the
// pages are static, so a visitor costs nothing and a crawler cannot run up an
// Anthropic bill.
//
// PRICES ARE NOT WRITTEN BY THE MODEL. The range on every page is computed here
// from lib/pricing-config (grossHourlyFor x the hour band in the catalogue) and
// passed to Claude as a fixed fact it must repeat verbatim. A model inventing
// prices would be inventing a quote a customer can hold Tarea to.
//
//   node scripts/generate-seo-pages.mjs            # everything missing
//   node scripts/generate-seo-pages.mjs --limit 4  # a slice, to eyeball first
//   node scripts/generate-seo-pages.mjs --force    # regenerate existing pages
//
// Needs ANTHROPIC_API_KEY. Roughly $8-20 per 1,000 pages on Sonnet 5; prompt
// caching keeps the stable instructions off the per-page input cost.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Anthropic from "@anthropic-ai/sdk";

// The catalogue and the rate card are TypeScript with extensionless imports,
// which node --experimental-strip-types cannot resolve. jiti (already present —
// Next uses it) loads them with the project's own resolution, so prices come
// from lib/pricing-config rather than a second copy that drifts.
const require_ = createRequire(import.meta.url);
const jiti = require_("jiti")(import.meta.url, { interopDefault: true, esmResolve: true });
const { SEO_CITIES, SEO_PROBLEMS } = jiti("../lib/seo/catalog.ts");
const { grossHourlyFor, grossTravel, grossMinimum } = jiti("../lib/pricing-config.ts");
const { SERVICE_CATEGORY_LABELS } = jiti("../lib/utils.ts");

const OUT_DIR = path.join(process.cwd(), "content", "fix");
const args = process.argv.slice(2);
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const force = args.includes("--force");

const client = new Anthropic();

// Stable across every page, so it caches. Volatile per-page facts go in the
// user turn, after the cache breakpoint.
const SYSTEM = `You write short, factual service pages for Tarea, a home-repair marketplace in the Los Angeles area.

Rules that matter more than style:
- The price range you are given is FIXED. Repeat it exactly. Never invent, round, or "estimate" a different number — it is a quote a customer can hold Tarea to.
- Never promise a timeline, a warranty, or that a specific pro is available.
- No superlatives, no "best in LA", no invented statistics or review counts.
- If a job can be dangerous (gas, water damage, panel work), say so plainly.
- British or American spelling is irrelevant; write plain American English.
- Write for somebody who just noticed the problem and does not know the vocabulary.`;

// EXACTLY what /api/ai/price-estimate and /api/ai/instant-quote compute:
//   round5( max( rate x hours + travel, minimum ) )
//
// The first version of this multiplied rate by hours and stopped, which left
// out the call-out charge AND the floor — a leaky faucet page advertised $95
// while the app quoted $135. A public price is a quote a customer can hold
// Tarea to, so this has to be the same arithmetic, not a similar one.
const round5 = (n) => Math.round(n / 5) * 5;

function priceRange(problem) {
  const hourly = grossHourlyFor(problem.category);
  const quote = (h) => round5(Math.max(hourly * h + grossTravel(), grossMinimum()));
  return { low: quote(problem.hoursLow), high: quote(problem.hoursHigh), hourly: Math.round(hourly) };
}

const SCHEMA = {
  type: "object",
  properties: {
    metaTitle: { type: "string", description: "Under 60 characters, includes the city" },
    metaDescription: { type: "string", description: "Under 155 characters" },
    intro: { type: "string", description: "2-3 sentences on the problem, mentioning the city naturally" },
    causes: { type: "array", items: { type: "string" }, description: "3-5 likely causes, one sentence each" },
    whatProDoes: { type: "array", items: { type: "string" }, description: "3-5 steps a pro actually performs" },
    diyOrPro: { type: "string", description: "2-3 sentences: when this is safe to attempt and when it is not" },
    priceNote: { type: "string", description: "2 sentences explaining what drives the range. Repeat the given figures exactly." },
    faqs: {
      type: "array",
      items: {
        type: "object",
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
        additionalProperties: false,
      },
      description: "3 questions a homeowner would actually ask",
    },
  },
  required: ["metaTitle", "metaDescription", "intro", "causes", "whatProDoes", "diyOrPro", "priceNote", "faqs"],
  additionalProperties: false,
};

async function generate(city, problem) {
  const { low, high, hourly } = priceRange(problem);
  const category = SERVICE_CATEGORY_LABELS[problem.category] ?? problem.category;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Write the page for:

Job: ${problem.title}
Category: ${category}
City: ${city.name}, California — ${city.context}
FIXED price range for this job in this city: $${low} to $${high} (based on $${hourly}/hour, typically ${problem.hoursLow}-${problem.hoursHigh} hours)

Use the city detail above to make the page genuinely specific — not the same text with a different city name pasted in.`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  const data = JSON.parse(block.text);
  return { ...data, price: { low, high, hourly }, category: problem.category, categoryLabel: category };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let done = 0, skipped = 0, failed = 0;

for (const city of SEO_CITIES) {
  for (const problem of SEO_PROBLEMS) {
    if (done >= limit) break;
    const file = path.join(OUT_DIR, `${city.slug}__${problem.slug}.json`);
    if (fs.existsSync(file) && !force) { skipped++; continue; }
    try {
      const page = await generate(city, problem);
      fs.writeFileSync(file, JSON.stringify({
        city: city.slug, cityName: city.name, problem: problem.slug, problemTitle: problem.title,
        generatedAt: new Date().toISOString(), ...page,
      }, null, 2));
      done++;
      console.log(`✓ ${city.slug}/${problem.slug}  $${page.price.low}-${page.price.high}`);
    } catch (err) {
      failed++;
      console.error(`✖ ${city.slug}/${problem.slug}: ${err.message?.slice(0, 120)}`);
    }
  }
}
console.log(`\ngenerated ${done}, skipped ${skipped}, failed ${failed}`);
