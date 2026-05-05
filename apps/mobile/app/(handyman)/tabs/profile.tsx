import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Switch, ActivityIndicator, Alert, Image, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { api, API_BASE } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

interface PortfolioPhoto {
  id: string;
  url: string;
  caption: string | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  handymanReply: string | null;
  handymanRepliedAt: string | null;
  createdAt: string;
  author: { name: string };
}

export default function HandymanProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ notifBookingUpdates: true, notifReminders: true, notifMessages: true });
  const [verificationStatus, setVerificationStatus] = useState("none");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [stripeStatus, setStripeStatus] = useState<"not_connected" | "pending" | "active">("not_connected");
  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [serviceRadius, setServiceRadius] = useState("50");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", address: "", city: "", state: "", zipCode: "",
    bio: "", hourlyRate: "", isAvailable: true,
  });

  const APP_URL = process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:3000";

  useEffect(() => {
    Promise.all([
      api.get("/profile"),
      api.get("/stripe/connect"),
      api.get("/portfolio").catch(() => ({ data: [] })),
      api.get("/stripe/subscription").catch(() => ({ data: { isPremium: false } })),
      api.get("/reviews/received").catch(() => ({ data: [] })),
      api.get("/notifications/preferences").catch(() => ({ data: {} })),
      api.get("/verification").catch(() => ({ data: { verificationStatus: "none" } })),
      api.get("/referrals/my-code").catch(() => ({ data: { code: null, referredCount: 0 } })),
    ]).then(([profileRes, stripeRes, portfolioRes, subRes, reviewsRes, prefsRes, verifyRes, referralRes]) => {
      const d = profileRes.data;
      setEmail(d.email || "");
      setRating(d.handymanProfile?.rating ?? 0);
      setTotalJobs(d.handymanProfile?.totalJobs ?? 0);
      setIsVerified(d.isVerified ?? false);
      setAvatarUrl(d.avatarUrl || null);
      setStripeStatus(stripeRes.data?.status ?? "not_connected");
      setServiceRadius(String(d.handymanProfile?.serviceRadius ?? 50));
      setPortfolioPhotos(portfolioRes.data ?? []);
      setIsPremium(subRes.data?.isPremium ?? false);
      setReviews((reviewsRes.data ?? []).slice(0, 5));
      if (prefsRes.data && typeof prefsRes.data.notifBookingUpdates === "boolean") {
        setNotifPrefs(prefsRes.data);
      }
      setVerificationStatus(verifyRes.data?.verificationStatus ?? "none");
      setReferralCode(referralRes.data?.code ?? null);
      setReferredCount(referralRes.data?.referredCount ?? 0);
      setForm({
        name: d.name || "", phone: d.phone || "",
        address: d.address || "", city: d.city || "",
        state: d.state || "", zipCode: d.zipCode || "",
        bio: d.handymanProfile?.bio || "",
        hourlyRate: String(d.handymanProfile?.hourlyRate || ""),
        isAvailable: d.handymanProfile?.isAvailable ?? true,
      });
    }).finally(() => setLoading(false));
  }, []);

  const connectStripe = async () => {
    setConnecting(true);
    try {
      const res = await api.post("/stripe/connect", {});
      await WebBrowser.openBrowserAsync(res.data.url);
      // Re-fetch status after browser closes
      const statusRes = await api.get("/stripe/connect");
      setStripeStatus(statusRes.data?.status ?? "not_connected");
    } catch { Alert.alert("Error", "Could not start Stripe onboarding"); }
    setConnecting(false);
  };

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow photo library access to change your photo.");
      return;
    }

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
      formData.append("file", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: "avatar.jpg",
      } as never);

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
      await api.patch("/profile", { ...form, serviceRadius: parseInt(serviceRadius) || 50 });
      Alert.alert("Saved!", "Profile updated successfully.");
    } catch { Alert.alert("Error", "Failed to save."); }
    setSaving(false);
  };

  const addPortfolioPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow photo library access to add portfolio photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const token = await SecureStore.getItemAsync("tarea_token");
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, type: asset.mimeType || "image/jpeg", name: "photo.jpg" } as never);
      formData.append("folder", "tarea/portfolio");
      const uploadRes = await fetch(`${API_BASE}/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      const portfolioRes = await api.post("/portfolio", { url: uploadData.url });
      setPortfolioPhotos(prev => [portfolioRes.data, ...prev]);
      Alert.alert("Photo added!");
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    }
    setUploadingPhoto(false);
  };

  const deletePortfolioPhoto = (photoId: string) => {
    Alert.alert("Delete photo", "Remove this photo from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/portfolio/${photoId}`);
            setPortfolioPhotos(prev => prev.filter(p => p.id !== photoId));
          } catch { Alert.alert("Error", "Could not delete photo"); }
        },
      },
    ]);
  };

  const uploadVerificationDoc = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Allow photo library access to upload your ID."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingDoc(true);
    try {
      const token = await SecureStore.getItemAsync("tarea_token");
      const formData = new FormData();
      formData.append("file", { uri: result.assets[0].uri, type: result.assets[0].mimeType || "image/jpeg", name: "id.jpg" } as never);
      const res = await fetch(`${API_BASE}/verification`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setVerificationStatus("pending");
      Alert.alert("Submitted!", "Your ID is under review. We'll notify you when it's approved.");
    } catch (e: unknown) { Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again."); }
    setUploadingDoc(false);
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
      <View style={styles.heroCard}>
        <Pressable onPress={pickAndUploadAvatar} disabled={uploading} style={styles.avatarWrap}>
          {uploading ? (
            <ActivityIndicator color={colors.skyBlue} />
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{form.name[0]?.toUpperCase() || "?"}</Text>
          )}
          <View style={styles.cameraOverlay}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{form.name}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>⭐ {rating.toFixed(1)}</Text>
            <Text style={styles.stat}>🔨 {totalJobs} jobs</Text>
            {isVerified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
          </View>
        </View>
        <View style={styles.availRow}>
          <Text style={[styles.availLabel, { color: form.isAvailable ? colors.success : colors.inkSubtle }]}>
            {form.isAvailable ? "Available" : "Offline"}
          </Text>
          <Switch
            value={form.isAvailable}
            onValueChange={v => set("isAvailable", v)}
            trackColor={{ false: colors.card, true: colors.success + "50" }}
            thumbColor={form.isAvailable ? colors.success : colors.inkSubtle}
          />
        </View>
      </View>

      <View style={styles.section}>
        {[
          { key: "name", label: "Full Name", icon: "person" },
          { key: "phone", label: "Phone", icon: "call" },
          { key: "hourlyRate", label: "Hourly Rate ($)", icon: "cash", keyboardType: "numeric" },
          { key: "bio", label: "Bio", icon: "document-text", multiline: true },
          { key: "address", label: "Street Address", icon: "location" },
          { key: "city", label: "City", icon: "business" },
          { key: "state", label: "State", icon: "map" },
          { key: "zipCode", label: "ZIP Code", icon: "mail" },
        ].map(({ key, label, icon, keyboardType, multiline }) => (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputWrap, multiline && { alignItems: "flex-start" }]}>
              <Ionicons name={icon as never} size={16} color={colors.inkSubtle} style={multiline ? { marginTop: 2 } : {}} />
              <TextInput
                style={[styles.input, multiline && { height: 64, textAlignVertical: "top" }]}
                value={(form as Record<string, string | boolean>)[key] as string}
                onChangeText={v => set(key, v)}
                placeholderTextColor={colors.inkSubtle}
                keyboardType={keyboardType as never}
                multiline={multiline}
              />
            </View>
          </View>
        ))}

        {/* Service Radius field */}
        <View style={styles.field}>
          <Text style={styles.label}>Service Radius (miles)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="navigate" size={16} color={colors.inkSubtle} />
            <TextInput
              style={styles.input}
              value={serviceRadius}
              onChangeText={setServiceRadius}
              placeholderTextColor={colors.inkSubtle}
              keyboardType="numeric"
              placeholder="50"
            />
          </View>
        </View>

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </Pressable>
      </View>

      {/* Stripe Connect */}
      <View style={styles.stripeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stripeTitle}>Bank Account (Payouts)</Text>
          <Text style={styles.stripeStatus}>
            {stripeStatus === "active" ? "✓ Connected — payouts active" :
              stripeStatus === "pending" ? "⏳ Onboarding in progress" :
                "Not connected — you won't receive payouts"}
          </Text>
        </View>
        {stripeStatus !== "active" && (
          <Pressable style={[styles.stripeBtn, connecting && { opacity: 0.6 }]} onPress={connectStripe} disabled={connecting}>
            {connecting ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={styles.stripeBtnText}>Connect</Text>}
          </Pressable>
        )}
      </View>

      {/* Pro Membership */}
      <View style={styles.stripeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stripeTitle}>Pro Membership</Text>
          {isPremium ? (
            <Text style={[styles.stripeStatus, { color: colors.success }]}>✓ Pro Member — $29/month</Text>
          ) : (
            <>
              <Text style={styles.stripeStatus}>Go Pro — $29/mo</Text>
              <Text style={[styles.stripeStatus, { marginTop: 2, fontSize: 10 }]}>
                Top search ranking · Featured badge · Unlimited applications
              </Text>
            </>
          )}
        </View>
        {isPremium ? (
          <Pressable
            style={[styles.stripeBtn, { backgroundColor: colors.success + "30", borderWidth: 1, borderColor: colors.success }]}
            onPress={() => WebBrowser.openBrowserAsync(`${APP_URL}/handyman/profile`)}
          >
            <Text style={[styles.stripeBtnText, { color: colors.success }]}>Manage</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.stripeBtn}
            onPress={async () => {
              try {
                const res = await api.post("/stripe/subscription", {});
                if (res.data?.url) await WebBrowser.openBrowserAsync(res.data.url);
                // Refresh subscription status after browser closes
                const subRes = await api.get("/stripe/subscription").catch(() => ({ data: { isPremium: false } }));
                setIsPremium(subRes.data?.isPremium ?? false);
              } catch { Alert.alert("Error", "Could not start subscription"); }
            }}
          >
            <Text style={styles.stripeBtnText}>Go Pro</Text>
          </Pressable>
        )}
      </View>

      {/* ID Verification */}
      {!isVerified && (
        <View style={styles.stripeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stripeTitle}>ID Verification</Text>
            <Text style={styles.stripeStatus}>
              {verificationStatus === "pending" ? "⏳ Under review — we'll notify you" :
               verificationStatus === "rejected" ? "❌ Rejected — please resubmit" :
               "Upload a photo of your ID or license"}
            </Text>
          </View>
          {verificationStatus !== "pending" && (
            <Pressable style={[styles.stripeBtn, uploadingDoc && { opacity: 0.6 }]} onPress={uploadVerificationDoc} disabled={uploadingDoc}>
              {uploadingDoc ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={styles.stripeBtnText}>Upload</Text>}
            </Pressable>
          )}
        </View>
      )}

      {/* Referral */}
      <View style={styles.stripeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stripeTitle}>Refer a Friend</Text>
          {referralCode ? (
            <>
              <Text style={[styles.stripeStatus, { fontFamily: "monospace", color: colors.skyBlue, fontWeight: "700", letterSpacing: 2 }]}>{referralCode}</Text>
              <Text style={styles.stripeStatus}>{referredCount} friend{referredCount !== 1 ? "s" : ""} referred · each gets 10% off</Text>
            </>
          ) : (
            <Text style={styles.stripeStatus}>Generating your code…</Text>
          )}
        </View>
        {referralCode && (
          <Pressable style={[styles.stripeBtn, { backgroundColor: "#A78BFA20", borderWidth: 1, borderColor: "#A78BFA50" }]}
            onPress={() => Alert.alert("Your code", `Share this code with friends:\n\n${referralCode}\n\nThey'll get 10% off their first booking, and so will you!`)}>
            <Text style={[styles.stripeBtnText, { color: "#A78BFA" }]}>Share</Text>
          </Pressable>
        )}
      </View>

      {/* Portfolio Photos */}
      <View style={styles.portfolioCard}>
        <View style={styles.portfolioHeader}>
          <Text style={styles.portfolioTitle}>Portfolio Photos</Text>
          {portfolioPhotos.length < 6 && (
            <Pressable onPress={addPortfolioPhoto} disabled={uploadingPhoto} style={styles.addPhotoBtn}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={colors.ink} />
                : <Ionicons name="add" size={20} color={colors.ink} />}
            </Pressable>
          )}
        </View>
        {portfolioPhotos.length === 0 ? (
          <Text style={styles.portfolioEmpty}>No photos yet. Tap + to add up to 6.</Text>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={portfolioPhotos.slice(0, 6)}
            keyExtractor={p => p.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item: photo }) => (
              <Pressable onLongPress={() => deletePortfolioPhoto(photo.id)} style={styles.photoThumb}>
                <Image source={{ uri: photo.url }} style={styles.photoImg} />
                <View style={styles.photoDeleteHint}>
                  <Ionicons name="trash" size={10} color="rgba(255,255,255,0.7)" />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Recent Reviews */}
      <View style={styles.portfolioCard}>
        <Text style={styles.portfolioTitle}>Recent Reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.portfolioEmpty}>No reviews yet.</Text>
        ) : (
          reviews.map(review => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.reviewStars}>{"⭐".repeat(review.rating)}</Text>
                <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
              </View>
              {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              <Text style={styles.reviewAuthor}>— {review.author.name}</Text>
              {review.handymanReply ? (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>Your reply:</Text>
                  <Text style={styles.replyText}>{review.handymanReply}</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.replyBtn}
                  onPress={() =>
                    Alert.prompt(
                      "Reply to Review",
                      "Write your response:",
                      async (text) => {
                        if (!text?.trim()) return;
                        try {
                          const res = await api.patch(`/reviews/${review.id}/reply`, { reply: text.trim() });
                          setReviews(prev => prev.map(r => r.id === review.id ? { ...r, handymanReply: res.data.handymanReply, handymanRepliedAt: res.data.handymanRepliedAt } : r));
                        } catch {
                          Alert.alert("Error", "Could not post reply");
                        }
                      },
                      "plain-text"
                    )
                  }
                >
                  <Text style={styles.replyBtnText}>Reply</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </View>

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>
        {([
          { key: "notifBookingUpdates", label: "Booking updates", sub: "Status changes and customer actions" },
          { key: "notifReminders", label: "Reminders", sub: "24h and 1h before scheduled jobs" },
          { key: "notifMessages", label: "Messages", sub: "New messages from customers" },
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
  heroCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.skyBlue + "30", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.skyBlue, overflow: "hidden", position: "relative" },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: fontSize.xl, fontWeight: "800", color: colors.skyBlue },
  cameraOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontWeight: "800", fontSize: fontSize.base },
  email: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  stat: { color: colors.inkSubtle, fontSize: fontSize.xs },
  availRow: { alignItems: "center" },
  availLabel: { fontSize: fontSize.xs, fontWeight: "700", marginBottom: 4 },
  section: { gap: spacing.md },
  field: { gap: 6 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm, fontWeight: "600" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder },
  input: { flex: 1, color: colors.white, fontSize: fontSize.base },
  saveBtn: { backgroundColor: colors.skyBlue, borderRadius: radius.xl, paddingVertical: 16, alignItems: "center", marginTop: spacing.sm },
  saveBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.lg },
  sectionTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base, marginBottom: 4 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  notifLabel: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  notifSub: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger + "40" },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: fontSize.base },
  verifiedBadge: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
  stripeCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  stripeTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  stripeStatus: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  stripeBtn: { backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 8 },
  stripeBtnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.sm },
  portfolioCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, gap: spacing.sm },
  portfolioHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  portfolioTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  addPhotoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.skyBlue, alignItems: "center", justifyContent: "center" },
  portfolioEmpty: { color: colors.inkSubtle, fontSize: fontSize.xs, textAlign: "center", paddingVertical: spacing.sm },
  photoThumb: { width: 80, height: 80, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.cardBorder, position: "relative" },
  photoImg: { width: 80, height: 80 },
  photoDeleteHint: { position: "absolute", bottom: 2, right: 2, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 6, padding: 2 },
  reviewItem: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.sm, gap: 4 },
  reviewStars: { fontSize: fontSize.sm },
  reviewDate: { color: colors.inkSubtle, fontSize: fontSize.xs },
  reviewComment: { color: colors.white, fontSize: fontSize.sm },
  reviewAuthor: { color: colors.inkSubtle, fontSize: fontSize.xs, fontStyle: "italic" },
  replyBox: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  replyLabel: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
  replyText: { color: colors.inkSubtle, fontSize: fontSize.xs },
  replyBtn: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.skyBlue + "60" },
  replyBtnText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
});
