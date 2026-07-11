import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, Image, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
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

  const [uris, setUris] = useState<Record<DocField, string>>({ avatar: "", idFront: "", idBack: "", licenseDoc: "", insuranceDoc: "" });
  const [urls, setUrls] = useState<Record<DocField, string>>({ avatar: "", idFront: "", idBack: "", licenseDoc: "", insuranceDoc: "" });

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
    if (res.ok) { const d = await res.json(); setUrls(p => ({ ...p, [field]: d.url })); }
    else Alert.alert("Upload failed", "Please try again");
    setUploading(false);
  };

  const next = async () => {
    if (!urls.avatar)  { Alert.alert("Required", "Please upload a profile photo"); return; }
    if (!urls.idFront) { Alert.alert("Required", "Please upload the front of your government ID"); return; }
    if (!urls.idBack)  { Alert.alert("Required", "Please upload the back of your government ID"); return; }
    if (!bio.trim())   { Alert.alert("Required", "Please write a short bio"); return; }
    setSaving(true);
    // Save ID + docs via PATCH
    const patchBody: Record<string, string> = { idFrontUrl: urls.idFront, idBackUrl: urls.idBack };
    if (urls.licenseDoc)  patchBody.licenseDocUrl  = urls.licenseDoc;
    if (urls.insuranceDoc) patchBody.insuranceDocUrl = urls.insuranceDoc;
    if (licenseNum.trim()) patchBody.licenseNumber  = licenseNum.trim();
    await api.patch("/handyman/onboarding", patchBody);
    // Store profile data for next step
    await SecureStore.setItemAsync("ob_bio",   bio);
    await SecureStore.setItemAsync("ob_rate",  rate);
    await SecureStore.setItemAsync("ob_years", years);
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
            placeholder="License number (optional)" placeholderTextColor={C.slate500} />
          <View style={s.docRow}>
            <DocTile field="licenseDoc" label="License Doc" />
            <DocTile field="insuranceDoc" label="Insurance Cert" />
          </View>

          {/* Bio */}
          <Text style={[s.sectionTitle, { marginTop: 20 }]}>Bio *</Text>
          <TextInput style={[s.input, s.inputMulti]} value={bio} onChangeText={setBio}
            placeholder="Describe your experience and skills…" placeholderTextColor={C.slate500} multiline numberOfLines={4} />

          {/* Rate & Experience */}
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Hourly Rate ($)</Text>
              <TextInput style={s.input} value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="50" placeholderTextColor={C.slate500} />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>Years Exp.</Text>
              <TextInput style={s.input} value={years} onChangeText={setYears} keyboardType="numeric" placeholder="1" placeholderTextColor={C.slate500} />
            </View>
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
  safe:             { flex: 1, backgroundColor: C.ink },
  scroll:           { flex: 1 },
  header:           { padding: 24, paddingBottom: 12 },
  title:            { color: C.white, fontSize: 24, fontWeight: "900" },
  sub:              { color: C.slate400, fontSize: 13, marginTop: 2 },
  avatarWrap:       { alignSelf: "center", marginBottom: 8 },
  avatar:           { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder:{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#1E293B", borderWidth: 2, borderColor: C.sky, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  avatarIcon:       { fontSize: 24 },
  avatarLabel:      { color: C.sky, fontSize: 11, fontWeight: "700", marginTop: 4 },
  avatarDone:       { position: "absolute", bottom: 0, right: 0, backgroundColor: C.emerald, borderRadius: 11, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  avatarDoneText:   { color: C.white, fontWeight: "900", fontSize: 12 },
  card:             { margin: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sectionTitle:     { color: C.white, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  sectionSub:       { color: C.slate500, fontSize: 12, marginBottom: 12 },
  docRow:           { flexDirection: "row", gap: 10 },
  docTile:          { flex: 1, height: 100, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed", overflow: "hidden" },
  docPreview:       { width: "100%", height: "100%" },
  docPlaceholder:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  docIcon:          { fontSize: 22 },
  docLabel:         { color: C.slate400, fontSize: 11, fontWeight: "600", textAlign: "center" },
  docDone:          { position: "absolute", top: 6, right: 6, backgroundColor: C.emerald, borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  docDoneText:      { color: C.white, fontSize: 11, fontWeight: "900" },
  input:            { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.white, fontSize: 14, marginBottom: 10 },
  inputMulti:       { minHeight: 90, textAlignVertical: "top" },
  row:              { flexDirection: "row", gap: 10 },
  rowItem:          { flex: 1 },
  label:            { color: C.slate400, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  uploadingBanner:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, padding: 10 },
  uploadingText:    { color: C.slate400, fontSize: 13 },
  btn:              { margin: 16, backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled:      { opacity: 0.5 },
  btnText:          { color: C.ink, fontWeight: "800", fontSize: 16 },
});
