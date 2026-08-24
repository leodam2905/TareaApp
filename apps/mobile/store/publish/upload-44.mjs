// Uploads the 1.0.21+44 bundles to Play and stages a PRODUCTION release as a
// DRAFT.
//
// Draft on purpose. `status: "completed"` starts an immediate 100% rollout to
// every existing user, which cannot be recalled — the only remedy is shipping
// another build. A draft puts the release in the console with everything filled
// in, and leaves the single irreversible click to a person.
import { google } from "googleapis";
import fs from "node:fs";

const KEY = "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json";
const BUILD = "/Users/monsegueadah/TareaApp/apps/mobile-flutter/build/app/outputs/bundle";

const NOTES = `Hiring a pro now includes payment, so a job is confirmed the moment you hire.
Pros can see the jobs they have applied to.
Job timer can be paused and resumed, and the customer sees it.
Distances now shown in miles.`;

const apps = [
  { pkg: "com.taptarea.customer", name: "Tarea Home", aab: `${BUILD}/homeRelease/app-home-release.aab` },
  { pkg: "com.taptarea.handyman", name: "Tarea Pro", aab: `${BUILD}/proRelease/app-pro-release.aab` },
];

const auth = new google.auth.GoogleAuth({
  keyFile: KEY,
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const ap = google.androidpublisher({ version: "v3", auth });

for (const app of apps) {
  if (!fs.existsSync(app.aab)) {
    console.error(`${app.name}: ✖ missing bundle ${app.aab}`);
    continue;
  }
  try {
    const { data: edit } = await ap.edits.insert({ packageName: app.pkg });
    const editId = edit.id;

    const { data: uploaded } = await ap.edits.bundles.upload({
      packageName: app.pkg,
      editId,
      media: { mimeType: "application/octet-stream", body: fs.createReadStream(app.aab) },
    });
    console.log(`${app.name}: uploaded versionCode ${uploaded.versionCode}`);

    await ap.edits.tracks.update({
      packageName: app.pkg,
      editId,
      track: "production",
      requestBody: {
        track: "production",
        releases: [
          {
            name: "1.0.21",
            versionCodes: [String(uploaded.versionCode)],
            status: "draft",
            releaseNotes: [{ language: "en-US", text: NOTES }],
          },
        ],
      },
    });

    const { data: committed } = await ap.edits.commit({ packageName: app.pkg, editId });
    console.log(`${app.name}: ✅ production release staged as DRAFT (edit ${committed.id})`);
  } catch (e) {
    console.error(`${app.name}: ✖`, e?.response?.data?.error?.message || e.message);
  }
}
