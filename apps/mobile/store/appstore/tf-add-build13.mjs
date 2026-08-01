import fs from "fs";
import jwt from "jsonwebtoken";

const KEY_ID = "54F786QLW9";
const ISSUER = "d4043b84-ff32-4cd9-bef8-a0d183c13991";
const APP_ID = "6784023441"; // customer (Tarea Home)
const KEY = fs.readFileSync(new URL("./AuthKey_54F786QLW9.p8", import.meta.url), "utf8");
const TARGET_BUILD = process.argv[2] || "13";

const token = jwt.sign({}, KEY, {
  algorithm: "ES256",
  keyid: KEY_ID,
  issuer: ISSUER,
  expiresIn: "18m",
  audience: "appstoreconnect-v1",
});

const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const base = "https://api.appstoreconnect.apple.com/v1";

async function j(url, opts = {}) {
  const r = await fetch(url, { headers: H, ...opts });
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
}

// 1) find build 13 for this app
const builds = await j(`${base}/builds?filter[app]=${APP_ID}&limit=20&sort=-version&include=preReleaseVersion`);
const list = builds.body.data || [];
const b13 = list.find((b) => b.attributes.version === TARGET_BUILD);
if (!b13) {
  console.log("Build 13 NOT found yet. Recent builds:", list.map((b) => b.attributes.version).join(", "));
  console.log("(Apple may still be ingesting the upload — try again in a couple minutes.)");
  process.exit(0);
}
console.log(`Build 13 -> id=${b13.id} | processingState=${b13.attributes.processingState} | expired=${b13.attributes.expired}`);

// 2) internal beta groups
const groups = await j(`${base}/betaGroups?filter[app]=${APP_ID}&limit=50`);
const internal = (groups.body.data || []).filter((g) => g.attributes.isInternalGroup);
console.log("Internal groups:", internal.map((g) => `${g.attributes.name}(allBuilds=${g.attributes.hasAccessToAllBuilds})`).join(", ") || "(none)");

// 3) ensure build 13 is in each internal group
for (const g of internal) {
  if (g.attributes.hasAccessToAllBuilds) { console.log(`- ${g.attributes.name}: auto-includes all builds ✓`); continue; }
  const res = await j(`${base}/betaGroups/${g.id}/relationships/builds`, {
    method: "POST",
    body: JSON.stringify({ data: [{ type: "builds", id: b13.id }] }),
  });
  console.log(`- ${g.attributes.name}: add build 13 -> HTTP ${res.status}${res.status >= 400 ? " " + JSON.stringify(res.body).slice(0, 200) : " ✓"}`);
}

if (b13.attributes.processingState !== "VALID") {
  console.log(`\nNote: processingState is ${b13.attributes.processingState}. It must reach VALID before it's installable in TestFlight.`);
}
