import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert, Image, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api, API_BASE } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

interface SavedHandyman {
  id: string;
  handymanId: string;
  handyman: {
    id: string;
    rating: number;
    user: { name: string; avatarUrl: string | null; city: string | null };
  };
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", city: "", state: "", zipCode: "" });
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savedHandymen, setSavedHandymen] = useState<SavedHandyman[]>([]);
  const [notifPrefs, setNotifPrefs] = useState({ notifBookingUpdates: true, notifReminders: true, notifMessages: true });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [spending, setSpending] = useState<{ totalSpent: number; bookingCount: number; byCategory: Record<string, number> } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/profile"),
      api.get("/favorites").catch(() => ({ data: [] })),
      api.get("/notifications/preferences").catch(() => ({ data: {} })),
      api.get("/referrals/my-code").catch(() => ({ data: { code: null, referredCount: 0 } })),
      api.get("/reports/spending").catch(() => ({ data: null })),
    ]).then(([profileRes, favRes, prefsRes, referralRes, spendRes]) => {
      const d = profileRes.data;
      setEmail(d.email || "");
      setAvatarUrl(d.avatarUrl || null);
      setForm({ name: d.name || "", phone: d.phone || "", address: d.address || "", city: d.city || "", state: d.state || "", zipCode: d.zipCode || "" });
      setSavedHandymen(favRes.data ?? []);
      if (prefsRes.data && typeof prefsRes.data.notifBookingUpdates === "boolean") {
        setNotifPrefs(prefsRes.data);
      }
      setReferralCode(referralRes.data?.code ?? null);
      setReferredCount(referralRes.data?.referredCount ?? 0);
      if (spendRes.data) setSpending(spendRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const removeFavorite = async (handymanId: string) => {
    try {
      await api.delete(`/favorites/${handymanId}`);
      setSavedHandymen(prev => prev.filter(f => f.handymanId !== handymanId));
    } catch { Alert.alert("Error", "Could not remove favorite"); }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Allow photo library access to change your photo."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const token = await SecureStore.getItemAsync("tarea_token");
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, type: asset.mimeType || "image/jpeg", name: "avatar.jpg" } as never);
      const res = await fetch(`${API_BASE}/upload/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatarUrl(data.url);
      Alert.alert("Photo updated!");
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert("Name is required"); return; }
    setSaving(true);
    try {
      await api.patch("/profile", form);
      Alert.alert("Saved!", "Profile updated successfully.");
    } catch { Alert.alert("Error", "Failed to save profile."); }
    setSaving(false);
  };

  const toggleNotifPref = async (key: keyof typeof notifPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try { await api.patch("/notifications/preferences", { [key]: updated[key] }); }
    catch { setNotifPrefs(notifPrefs); }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("tarea_token");
    await SecureStore.deleteItemAsync("tarea_user");
    await SecureStore.deleteItemAsync("tarea_role");
    router.replace("/(auth)/login");
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Pressable onPress={pickAndUploadAvatar} disabled={uploading} style={styles.avatarWrap}>
          {uploading ? (
            <ActivityIndicator color={colors.skyBlue} />
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{form.name[0]?.toUpperCase() || "?"}</Text>
          )}
          <View style={styles.cameraOverlay}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.name}>{form.name}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>CUSTOMER</Text></View>
      </View>

      <View style={styles.section}>
        {[
          { key: "name", label: "Full Name", icon: "person" },
          { key: "phone", label: "Phone", icon: "call", keyboardType: "phone-pad" },
          { key: "address", label: "Street Address", icon: "location" },
          { key: "city", label: "City", icon: "business" },
          { key: "state", label: "State", icon: "map" },
          { key: "zipCode", label: "ZIP Code", icon: "mail" },
        ].map(({ key, label, icon, keyboardType }) => (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name={icon as never} size={16} color={colors.inkSubtle} />
              <TextInput
                style={styles.input}
                value={(form as Record<string, string>)[key]}
                onChangeText={v => set(key, v)}
                placeholderTextColor={colors.inkSubtle}
                keyboardType={keyboardType as never}
              />
            </View>
          </View>
        ))}

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </Pressable>
      </View>

      {/* Saved Handymen */}
      {savedHandymen.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedTitle}>Saved Handymen</Text>
          {savedHandymen.map(fav => (
            <View key={fav.id} style={styles.savedCard}>
              <View style={styles.savedAvatar}>
                {fav.handyman.user.avatarUrl ? (
                  <Image source={{ uri: fav.handyman.user.avatarUrl }} style={styles.savedAvatarImg} />
                ) : (
                  <Text style={styles.savedAvatarText}>{fav.handyman.user.name[0]?.toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedName}>{fav.handyman.user.name}</Text>
                <Text style={styles.savedMeta}>
                  ⭐ {fav.handyman.rating.toFixed(1)}{fav.handyman.user.city ? ` · ${fav.handyman.user.city}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => removeFavorite(fav.handymanId)} hitSlop={8}>
                <Ionicons name="heart" size={20} color="#EF4444" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Referral */}
      <View style={styles.referralCard}>
        <Text style={styles.savedTitle}>Refer a Friend</Text>
        {referralCode ? (
          <>
            <Text style={styles.referralCode}>{referralCode}</Text>
            <Text style={styles.referralSub}>{referredCount} friend{referredCount !== 1 ? "s" : ""} referred · each gets 10% off their first booking</Text>
            <Pressable style={styles.shareBtn}
              onPress={() => Alert.alert("Your code", `Share this code:\n\n${referralCode}\n\nYour friend gets 10% off, and so do you!`)}>
              <Text style={styles.shareBtnText}>Share Code</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.referralSub}>Generating your code…</Text>
        )}
      </View>

      {/* Spend Report */}
      {spending && spending.bookingCount > 0 && (
        <View style={styles.spendCard}>
          <Text style={styles.savedTitle}>My Spending</Text>
          <View style={styles.spendRow}>
            <View style={styles.spendStat}>
              <Text style={styles.spendValue}>${spending.totalSpent.toFixed(0)}</Text>
              <Text style={styles.spendLabel}>Total spent</Text>
            </View>
            <View style={styles.spendStat}>
              <Text style={styles.spendValue}>{spending.bookingCount}</Text>
              <Text style={styles.spendLabel}>Bookings</Text>
            </View>
            <View style={styles.spendStat}>
              <Text style={styles.spendValue}>${(spending.totalSpent / spending.bookingCount).toFixed(0)}</Text>
              <Text style={styles.spendLabel}>Avg booking</Text>
            </View>
          </View>
          {Object.entries(spending.byCategory).slice(0, 3).map(([cat, amt]) => (
            <View key={cat} style={styles.catRow}>
              <Text style={styles.catLabel}>{cat.replace("_", " ")}</Text>
              <Text style={styles.catAmt}>${(amt as number).toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notification Preferences */}
      <View style={styles.notifSection}>
        <Text style={styles.savedTitle}>Notification Preferences</Text>
        {([
          { key: "notifBookingUpdates", label: "Booking updates", sub: "Status changes, acceptances, completions" },
          { key: "notifReminders", label: "Reminders", sub: "24h and 1h before your booking" },
          { key: "notifMessages", label: "Messages", sub: "New messages from handymen" },
        ] as { key: keyof typeof notifPrefs; label: string; sub: string }[]).map(({ key, label, sub }) => (
          <View key={key} style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>{label}</Text>
              <Text style={styles.notifSub}>{sub}</Text>
            </View>
            <Switch
              value={notifPrefs[key]}
              onValueChange={() => toggleNotifPref(key)}
              trackColor={{ false: colors.card, true: colors.skyBlue + "60" }}
              thumbColor={notifPrefs[key] ? colors.skyBlue : colors.inkSubtle}
            />
          </View>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.xl, paddingTop: 60, paddingBottom: 100, gap: spacing.xl },
  header: { alignItems: "center", gap: spacing.sm },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.skyBlue + "30", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.skyBlue, overflow: "hidden", position: "relative" },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.skyBlue },
  cameraOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  name: { fontSize: fontSize.xl, fontWeight: "800", color: colors.white },
  email: { color: colors.inkSubtle, fontSize: fontSize.sm },
  roleBadge: { backgroundColor: colors.skyBlue + "20", borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  roleText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
  section: { gap: spacing.md },
  field: { gap: 6 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm, fontWeight: "600" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder },
  input: { flex: 1, color: colors.white, fontSize: fontSize.base },
  saveBtn: { backgroundColor: colors.skyBlue, borderRadius: radius.xl, paddingVertical: 16, alignItems: "center", marginTop: spacing.sm },
  saveBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.lg },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger + "40" },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: fontSize.base },
  savedSection: { gap: spacing.sm },
  savedTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  savedCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  savedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.skyBlue + "30", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  savedAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  savedAvatarText: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.base },
  savedName: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  savedMeta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  referralCard: { backgroundColor: "rgba(167,139,250,0.08)", borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)" },
  referralCode: { fontFamily: "monospace", color: "#A78BFA", fontWeight: "700", fontSize: fontSize.xl, letterSpacing: 3 },
  referralSub: { color: colors.inkSubtle, fontSize: fontSize.xs },
  shareBtn: { backgroundColor: "#A78BFA20", borderRadius: radius.lg, borderWidth: 1, borderColor: "#A78BFA40", paddingVertical: 10, alignItems: "center" },
  shareBtnText: { color: "#A78BFA", fontWeight: "700", fontSize: fontSize.sm },
  spendCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  spendRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm },
  spendStat: { alignItems: "center", gap: 4 },
  spendValue: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.xl },
  spendLabel: { color: colors.inkSubtle, fontSize: fontSize.xs },
  catRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  catLabel: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.xs },
  catAmt: { color: colors.white, fontWeight: "600", fontSize: fontSize.xs },
  notifSection: { gap: spacing.sm },
  notifRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  notifLabel: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  notifSub: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
});
