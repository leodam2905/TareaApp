// Promotes the staged 1.0.21+44 draft to a live production rollout.
import { google } from "googleapis";
const auth = new google.auth.GoogleAuth({
  keyFile: "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json",
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const ap = google.androidpublisher({ version: "v3", auth });

const NOTES = `Hiring a pro now includes payment, so a job is confirmed the moment you hire.
Pros can see the jobs they have applied to.
Job timer can be paused and resumed, and the customer sees it.
Distances now shown in miles.`;

for (const [name, pkg] of [["Tarea Home", "com.taptarea.customer"], ["Tarea Pro", "com.taptarea.handyman"]]) {
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;
    const { data: prod } = await ap.edits.tracks.get({ packageName: pkg, editId, track: "production" });
    const draft = prod.releases?.find((r) => r.status === "draft");
    if (!draft) { console.log(`${name}: ✖ no draft release found`); await ap.edits.delete({ packageName: pkg, editId }); continue; }

    await ap.edits.tracks.update({
      packageName: pkg, editId, track: "production",
      requestBody: {
        track: "production",
        releases: [{
          name: draft.name ?? "1.0.21",
          versionCodes: draft.versionCodes,
          status: "completed",           // 100% rollout
          releaseNotes: [{ language: "en-US", text: NOTES }],
        }],
      },
    });
    const { data: c } = await ap.edits.commit({ packageName: pkg, editId });
    console.log(`${name}: ✅ LIVE — vc ${draft.versionCodes?.join(",")} rolled out 100% (edit ${c.id})`);
  } catch (e) {
    console.error(`${name}: ✖`, e?.response?.data?.error?.message || e.message);
  }
}
