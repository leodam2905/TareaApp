import { google } from "googleapis";
import fs from "node:fs";
const KEY = "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json";
const AAB = "/Users/monsegueadah/TareaApp/apps/mobile-flutter/build/app/outputs/bundle/proRelease/app-pro-release.aab";
const PKG = "com.taptarea.handyman";
const NOTES = `A redesigned dashboard showing your earnings, jobs, schedule and rating at a glance, with money still clearing shown up front. You can now hide your earnings figure with a tap. Cleaner launch screen, and the back button now returns you to Home instead of closing the app.`;
const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
const ap = google.androidpublisher({ version: "v3", auth });

// The first attempt died on a socket hang up partway through an 84MB upload.
// Retry the whole edit rather than resuming: a half-finished edit is discarded
// by Play, so each attempt starts clean.
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const { data: edit } = await ap.edits.insert({ packageName: PKG });
    const { data: up } = await ap.edits.bundles.upload({
      packageName: PKG, editId: edit.id,
      media: { mimeType: "application/octet-stream", body: fs.createReadStream(AAB) },
    });
    console.log(`Tarea Pro: uploaded versionCode ${up.versionCode}`);
    await ap.edits.tracks.update({
      packageName: PKG, editId: edit.id, track: "production",
      requestBody: { track: "production", releases: [{
        name: "1.0.28", versionCodes: [String(up.versionCode)],
        status: "draft", releaseNotes: [{ language: "en-US", text: NOTES }] }] },
    });
    const { data: c } = await ap.edits.commit({ packageName: PKG, editId: edit.id });
    console.log(`Tarea Pro: production release staged as DRAFT (edit ${c.id})`);
    break;
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e.message;
    console.error(`attempt ${attempt}: ${msg}`);
    if (attempt === 3) process.exitCode = 1;
  }
}
