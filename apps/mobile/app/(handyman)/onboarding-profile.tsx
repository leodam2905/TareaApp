import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, Image, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { api, API_BASE } from "@/lib/api";
import { getToken } from "@/lib/storage";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

type DocField = "idFront" | "idBack" | "licenseDoc" | "insuranceDoc" | "avatar";

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const [bio, setBio]               = useState("");
  const [rate, setRate]             = useState("50");
  const [years, setYears]           = useState("1");
  const [licenseNum, setLicenseNum] = useState("");
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  // Work area
  const [address, setAddress]       = useState("");
  const [radius, setRadius]         = useState("50");
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy]       = useState(false);

  const [uris, setUris] = useState<Record<DocField, string>>({ avatar: "", idFront: "", idBack: "", licenseDoc: "", insuranceDoc: "" });
  const [urls, setUrls] = useState<Record<DocField, string>>({ avatar: "", idFront: "", idBack: "", licenseDoc: "", insuranceDoc: "" });

  // Restore already-saved profile + documents so users don't start over after logging out.
  // Backend is the source of truth; SecureStore is a fallback for fields typed but
  // not yet persisted server-side (e.g. left mid-step).
  useEffect(() => {
    (async () => {
      let hp: any = {};
      let avatarUrl = "";
      try {
        const res = await api.get("/profile");
        if (res.ok) {
          const d = await res.json();
          hp = d.handymanProfile || {};
          avatarUrl = d.avatarUrl || "";
          const loaded: Record<DocField, string> = {
            avatar: avatarUrl,
            idFront: hp.idFrontUrl || "",
            idBack: hp.idBackUrl || "",
            licenseDoc: hp.licenseDocUrl || "",
            insuranceDoc: hp.insuranceDocUrl || "",
          };
          setUrls(loaded);
          setUris(loaded); // remote URLs render fine in <Image>
          if (d.address) setAddress(d.address);
          if (d.latitude != null && d.longitude != null) setCoords({ lat: d.latitude, lng: d.longitude });
          if (hp.serviceRadius != null) setRadius(String(hp.serviceRadius));
        }
      } catch { /* ignore — fall back to local */ }
      setBio(hp.bio || (await SecureStore.getItemAsync("ob_bio")) || "");
      setRate(hp.hourlyRate != null ? String(hp.hourlyRate) : (await SecureStore.getItemAsync("ob_rate")) || "50");
      setYears(hp.yearsExperience != null && hp.yearsExperience !== 0 ? String(hp.yearsExperience) : (await SecureStore.getItemAsync("ob_years")) || "1");
      setLicenseNum(hp.licenseNumber || (await SecureStore.getItemAsync("ob_license")) || "");
    })();
  }, []);

  const pickAndUpload = async (field: DocField, aspect?: [number, number]) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo Access Required",
        "Please allow Tarea to access your photos in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: !!aspect, aspect, quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUris(p => ({ ...p, [field]: asset.uri }));
    setUploading(true);
    const form = new FormData();
    form.append("file", { uri: asset.uri, name: `${field}.jpg`, type: "image/jpeg" } as any);
    form.append("folder", "tarea/id-docs");
    const token = await getToken();
    const endpoint = field === "avatar" ? "/api/upload/avatar" : "/api/upload/image";
    const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setUrls(p => ({ ...p, [field]: d.url }));
      // Persist the document to the backend right away so it survives logout
      // even if the user leaves before tapping "Next". (avatar is persisted by
      // its own upload endpoint.)
      if (field !== "avatar") {
        api.patch("/handyman/onboarding", { [`${field}Url`]: d.url }).catch(() => {});
      }
    } else Alert.alert("Upload failed", "Please try again");
    setUploading(false);
  };

  // Persist a typed field locally the moment the user leaves it, so nothing is
  // lost if they navigate away mid-step.
  const persistField = (key: string, value: string) => { SecureStore.setItemAsync(key, value).catch(() => {}); };

  // Discrete "use my location": grab GPS + fill the address field.
  const useMyLocation = async () => {
    setLocBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { Alert.alert("Location off", "Allow location access, or just type your work address."); setLocBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const g = geo[0];
      if (g) {
        const line = [g.streetNumber, g.street].filter(Boolean).join(" ");
        const full = [line || g.name, g.city, g.region].filter(Boolean).join(", ");
        if (full) setAddress(full);
      }
    } catch { Alert.alert("Couldn't get location", "Please type your work address instead."); }
    setLocBusy(false);
  };

  // Save the work area — geocode the typed address to coordinates (the radius is
  // measured from here) and store city/state + radius.
  const saveWorkArea = async () => {
    if (!address.trim()) return;
    let loc = coords;
    let city: string | undefined, state: string | undefined;
    try {
      if (!loc) {
        const g = await Location.geocodeAsync(address.trim());
        if (g[0]) loc = { lat: g[0].latitude, lng: g[0].longitude };
      }
      if (loc) {
        const rev = await Location.reverseGeocodeAsync({ latitude: loc.lat, longitude: loc.lng });
        if (rev[0]) { city = rev[0].city || undefined; state = rev[0].region || undefined; }
      }
    } catch { /* geocode may fail offline — still save the text address + radius */ }
    await api.patch("/profile", {
      address: address.trim(),
      ...(city && { city }),
      ...(state && { state }),
      ...(loc && { latitude: loc.lat, longitude: loc.lng }),
      serviceRadius: radius,
    }).catch(() => {});
  };

  const next = async () => {
    if (!urls.avatar)  { Alert.alert("Required", "Please upload a profile photo"); return; }
    if (!urls.idFront) { Alert.alert("Required", "Please upload the front of your government ID"); return; }
    if (!urls.idBack)  { Alert.alert("Required", "Please upload the back of your government ID"); return; }
    if (!bio.trim())   { Alert.alert("Required", "Please write a short bio"); return; }
    setSaving(true);
    // Save ID + docs via PATCH
    const patchBody: Record<string, string> = {
      idFrontUrl: urls.idFront, idBackUrl: urls.idBack,
      bio: bio.trim(), hourlyRate: rate, yearsExperience: years,
    };
    if (urls.licenseDoc)  patchBody.licenseDocUrl  = urls.licenseDoc;
    if (urls.insuranceDoc) patchBody.insuranceDocUrl = urls.insuranceDoc;
    if (licenseNum.trim()) patchBody.licenseNumber  = licenseNum.trim();
    const res = await api.patch("/handyman/onboarding", patchBody);
    if (!res.ok) {
      setSaving(false);
      Alert.alert("Couldn't save", "Your documents didn't save. Please check your connection and try again.");
      return;
    }
    // Store profile data for next step
    await SecureStore.setItemAsync("ob_bio",   bio);
    await SecureStore.setItemAsync("ob_rate",  rate);
    await SecureStore.setItemAsync("ob_years", years);
    await saveWorkArea();
    setSaving(false);
    router.push("/(handyman)/onboarding-services");
  };

  const DocTile = ({ field, label, required }: { field: DocField; label: string; required?: boolean }) => (
    <TouchableOpacity style={s.docTile} onPress={() => pickAndUpload(field)} disabled={uploading}>
      {uris[field]
        ? <Image source={{ uri: uris[field] }} style={s.docPreview} />
        : <View style={s.docPlaceholder}>
            <Text style={s.docIcon}>📄</Text>
            <Text style={s.docLabel}>{label}{required ? " *" : ""}</Text>
          </View>}
      {urls[field] ? <View style={s.docDone}><Text style={s.docDoneText}>✓</Text></View> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <BackBar />
      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.title}>Profile & Documents</Text>
          <Text style={s.sub}>Step 1 of 3 · Required fields marked *</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity style={s.avatarWrap} onPress={() => pickAndUpload("avatar", [1, 1])} disabled={uploading}>
          {uris.avatar
            ? <Image source={{ uri: uris.avatar }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}><Text style={s.avatarIcon}>📷</Text><Text style={s.avatarLabel}>Profile Photo *</Text></View>}
          {urls.avatar && <View style={s.avatarDone}><Text style={s.avatarDoneText}>✓</Text></View>}
        </TouchableOpacity>

        <View style={s.card}>
          {/* Gov ID */}
          <Text style={s.sectionTitle}>Government-Issued ID *</Text>
          <Text style={s.sectionSub}>Both sides of your driver's license, passport, or state ID.</Text>
          <View style={s.docRow}>
            <DocTile field="idFront" label="Front (Recto)" required />
            <DocTile field="idBack"  label="Back (Verso)"  required />
          </View>

          {/* License */}
          <Text style={[s.sectionTitle, { marginTop: 20 }]}>License</Text>
          <TextInput style={s.input} value={licenseNum} onChangeText={setLicenseNum}
            onBlur={() => persistField("ob_license", licenseNum)}
            placeholder="License number (optional)" placeholderTextColor={C.slate500} />
          <View style={s.docRow}>
            <DocTile field="licenseDoc" label="License Doc" />
            <DocTile field="insuranceDoc" label="Insurance Cert" />
          </View>

          {/* Bio */}
          <Text style={[s.sectionTitle, { marginTop: 20 }]}>Bio *</Text>
          <TextInput style={[s.input, s.inputMulti]} value={bio} onChangeText={setBio}
            onBlur={() => persistField("ob_bio", bio)}
            placeholder="Describe your experience and skills…" placeholderTextColor={C.slate500} multiline numberOfLines={4} />

          {/* Rate & Experience */}
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Hourly Rate ($)</Text>
              <TextInput style={s.input} value={rate} onChangeText={setRate} onBlur={() => persistField("ob_rate", rate)} keyboardType="numeric" placeholder="50" placeholderTextColor={C.slate500} />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>Years Exp.</Text>
              <TextInput style={s.input} value={years} onChangeText={setYears} onBlur={() => persistField("ob_years", years)} keyboardType="numeric" placeholder="1" placeholderTextColor={C.slate500} />
            </View>
          </View>
        </View>

        {/* Work Area */}
        <View style={s.card}>
          <View style={s.waHead}>
            <Text style={s.sectionTitle}>Work Area</Text>
            <TouchableOpacity onPress={useMyLocation} disabled={locBusy}>
              <Text style={s.useLoc}>{locBusy ? "Locating…" : "📍 Use my location"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.sectionSub}>Where you take jobs. Customers within your travel distance can find you.</Text>
          <TextInput style={s.input} value={address}
            onChangeText={t => { setAddress(t); setCoords(null); }}
            placeholder="Address, city or ZIP" placeholderTextColor={C.slate500} />
          <Text style={[s.label, { marginTop: 12 }]}>Travel distance from here</Text>
          <View style={s.radiusRow}>
            {["10", "25", "50", "75"].map(r => (
              <TouchableOpacity key={r} style={[s.radiusChip, radius === r && s.radiusChipOn]} onPress={() => setRadius(r)}>
                <Text style={[s.radiusChipText, radius === r && s.radiusChipTextOn]}>{r} mi</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {uploading && (
          <View style={s.uploadingBanner}>
            <ActivityIndicator color={C.sky} size="small" />
            <Text style={s.uploadingText}>Uploading…</Text>
          </View>
        )}

        <TouchableOpacity style={[s.btn, (saving || uploading) && s.btnDisabled]} onPress={next} disabled={saving || uploading}>
          {saving ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Next — Choose Services →</Text>}
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.bg },
  scroll:           { flex: 1 },
  header:           { padding: 24, paddingBottom: 12 },
  title:            { color: C.text, fontSize: 24, fontWeight: "900" },
  sub:              { color: C.textMuted, fontSize: 13, marginTop: 2 },
  avatarWrap:       { alignSelf: "center", marginBottom: 8 },
  avatar:           { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder:{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.surface, borderWidth: 2, borderColor: C.sky, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  avatarIcon:       { fontSize: 24 },
  avatarLabel:      { color: C.sky, fontSize: 11, fontWeight: "700", marginTop: 4 },
  avatarDone:       { position: "absolute", bottom: 0, right: 0, backgroundColor: C.emerald, borderRadius: 11, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  avatarDoneText:   { color: C.text, fontWeight: "900", fontSize: 12 },
  card:             { margin: 16, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line },
  sectionTitle:     { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  sectionSub:       { color: C.slate500, fontSize: 12, marginBottom: 12 },
  waHead:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  useLoc:           { color: "#2563EB", fontSize: 13, fontWeight: "700" },
  radiusRow:        { flexDirection: "row", gap: 8, marginTop: 6 },
  radiusChip:       { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  radiusChipOn:     { backgroundColor: "#EFF5FF", borderColor: "#2563EB" },
  radiusChipText:   { color: C.textMuted, fontWeight: "700", fontSize: 13 },
  radiusChipTextOn: { color: "#2563EB" },
  docRow:           { flexDirection: "row", gap: 10 },
  docTile:          { flex: 1, height: 100, borderRadius: 14, borderWidth: 2, borderColor: C.line, borderStyle: "dashed", overflow: "hidden" },
  docPreview:       { width: "100%", height: "100%" },
  docPlaceholder:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  docIcon:          { fontSize: 22 },
  docLabel:         { color: C.textMuted, fontSize: 11, fontWeight: "600", textAlign: "center" },
  docDone:          { position: "absolute", top: 6, right: 6, backgroundColor: C.emerald, borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  docDoneText:      { color: C.text, fontSize: 11, fontWeight: "900" },
  input:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 14, marginBottom: 10 },
  inputMulti:       { minHeight: 90, textAlignVertical: "top" },
  row:              { flexDirection: "row", gap: 10 },
  rowItem:          { flex: 1 },
  label:            { color: C.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  uploadingBanner:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, padding: 10 },
  uploadingText:    { color: C.textMuted, fontSize: 13 },
  btn:              { margin: 16, backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled:      { opacity: 0.5 },
  btnText:          { color: C.ink, fontWeight: "800", fontSize: 16 },
});
