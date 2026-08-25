// Adds Morocco to Play availability, keeping the US.
//
// The apps are built for the US — USD charges, Connect payouts that do not
// reach Moroccan banks, a CSLB cap enforced in matching, an LA rate card, and
// pros matched by distance. Listing in MA makes the app installable there; it
// does not make a job completable there.
import { google } from "googleapis";
const auth = new google.auth.GoogleAuth({
  keyFile: "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json",
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const ap = google.androidpublisher({ version: "v3", auth });

for (const [name, pkg] of [["Tarea Home", "com.taptarea.customer"], ["Tarea Pro", "com.taptarea.handyman"]]) {
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;
    const { data: before } = await ap.edits.countryavailability.get({ packageName: pkg, editId, track: "production" });
    const codes = new Set((before.countries ?? []).map((c) => c.countryCode));
    codes.add("MA");

    const { data: prod } = await ap.edits.tracks.get({ packageName: pkg, editId, track: "production" });
    const rel = prod.releases?.[0];
    await ap.edits.tracks.update({
      packageName: pkg, editId, track: "production",
      requestBody: {
        track: "production",
        releases: [{
          name: rel?.name,
          versionCodes: rel?.versionCodes,
          status: rel?.status,
          releaseNotes: rel?.releaseNotes,
          countryTargeting: { countries: [...codes].sort(), includeRestOfWorld: false },
        }],
      },
    });
    const { data: c } = await ap.edits.commit({ packageName: pkg, editId });
    console.log(`${name}: ✅ countries now ${[...codes].sort().join(",")} (edit ${c.id})`);
  } catch (e) {
    console.error(`${name}: ✖`, e?.response?.data?.error?.message || e.message);
  }
}
