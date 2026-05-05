import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Switch, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { api, API_BASE } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const CATEGORIES = [
  { key: "PLUMBING", emoji: "🔧", label: "Plumbing" },
  { key: "ELECTRICAL", emoji: "⚡", label: "Electrical" },
  { key: "CARPENTRY", emoji: "🔨", label: "Carpentry" },
  { key: "PAINTING", emoji: "🎨", label: "Painting" },
  { key: "CLEANING", emoji: "🧹", label: "Cleaning" },
  { key: "HVAC", emoji: "❄️", label: "HVAC" },
  { key: "ROOFING", emoji: "🏠", label: "Roofing" },
  { key: "LANDSCAPING", emoji: "🌿", label: "Landscaping" },
  { key: "MOVING", emoji: "📦", label: "Moving" },
  { key: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair" },
  { key: "GENERAL", emoji: "🛠️", label: "General" },
];

type Service = {
  id: string; title: string; description: string; category: string;
  minPrice: number; maxPrice: number; duration: number; isActive: boolean; imageUrl?: string;
};

const EMPTY = { title: "", description: "", category: "PLUMBING", minPrice: "", maxPrice: "", duration: "", imageUrl: "" };

export default function HandymanServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/services?mine=1&limit=100");
      setServices(Array.isArray(res.data.services) ? res.data.services : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ title: s.title, description: s.description, category: s.category, minPrice: String(s.minPrice), maxPrice: String(s.maxPrice), duration: String(s.duration), imageUrl: s.imageUrl ?? "" });
    setShowForm(true);
  };

  const pickServiceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Allow photo library access to add a service image."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingImage(true);
    try {
      const token = await SecureStore.getItemAsync("tarea_token");
      const formData = new FormData();
      formData.append("file", { uri: result.assets[0].uri, type: result.assets[0].mimeType || "image/jpeg", name: "service.jpg" } as never);
      formData.append("folder", "tarea/services");
      const res = await fetch(`${API_BASE}/upload/image`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      set("imageUrl", data.url);
    } catch (e: unknown) { Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again."); }
    setUploadingImage(false);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) { Alert.alert("Title and description required"); return; }
    const min = parseFloat(form.minPrice), max = parseFloat(form.maxPrice), dur = parseInt(form.duration);
    if (isNaN(min) || min <= 0 || isNaN(max) || max <= 0) { Alert.alert("Enter valid prices"); return; }
    if (max < min) { Alert.alert("Max price must be ≥ min price"); return; }
    if (isNaN(dur) || dur <= 0) { Alert.alert("Enter a valid duration in minutes"); return; }
    setSaving(true);
    const body = { title: form.title.trim(), description: form.description.trim(), category: form.category, minPrice: min, maxPrice: max, duration: dur, ...(form.imageUrl && { imageUrl: form.imageUrl }) };
    try {
      if (editing) {
        const res = await api.patch(`/services/${editing.id}`, body);
        setServices(prev => prev.map(s => s.id === editing.id ? { ...s, ...res.data } : s));
      } else {
        const res = await api.post("/services", body);
        setServices(prev => [res.data, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to save");
    }
    setSaving(false);
  };

  const toggleActive = async (s: Service) => {
    const prev = [...services];
    setServices(ss => ss.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
    try { await api.patch(`/services/${s.id}`, { isActive: !s.isActive }); }
    catch { setServices(prev); Alert.alert("Error", "Failed to update"); }
  };

  const remove = (s: Service) => {
    Alert.alert("Delete Service", `Delete "${s.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/services/${s.id}`);
            setServices(prev => prev.filter(x => x.id !== s.id));
          } catch { Alert.alert("Error", "Could not delete service"); }
        },
      },
    ]);
  };

  const selectedCat = CATEGORIES.find(c => c.key === form.category);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  // Form sheet
  if (showForm) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setShowForm(false)}><Ionicons name="arrow-back" size={22} color={colors.white} /></Pressable>
          <Text style={styles.topTitle}>{editing ? "Edit Service" : "New Service"}</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text style={[styles.saveLink, saving && { opacity: 0.5 }]}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formScroll}>
          {/* Service image */}
          <View style={styles.field}>
            <Text style={styles.label}>Service Image (optional)</Text>
            <Pressable style={styles.imagePicker} onPress={pickServiceImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator color={colors.skyBlue} />
              ) : form.imageUrl ? (
                <Image source={{ uri: form.imageUrl }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image" size={28} color={colors.inkSubtle} />
                  <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Category picker */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <Pressable style={styles.catPicker} onPress={() => setCatOpen(v => !v)}>
              <Text style={styles.catPickerText}>{selectedCat?.emoji} {selectedCat?.label}</Text>
              <Ionicons name={catOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.inkSubtle} />
            </Pressable>
            {catOpen && (
              <View style={styles.catList}>
                {CATEGORIES.map(c => (
                  <Pressable key={c.key} style={[styles.catOption, form.category === c.key && styles.catOptionActive]}
                    onPress={() => { set("category", c.key); setCatOpen(false); }}>
                    <Text style={styles.catOptionText}>{c.emoji} {c.label}</Text>
                    {form.category === c.key && <Ionicons name="checkmark" size={16} color={colors.skyBlue} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={v => set("title", v)} placeholder="e.g. Emergency Pipe Repair" placeholderTextColor={colors.inkSubtle} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={form.description} onChangeText={v => set("description", v)} placeholder="What's included in this service…" placeholderTextColor={colors.inkSubtle} multiline />
          </View>

          <View style={styles.row3}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Min Price ($)</Text>
              <TextInput style={styles.input} value={form.minPrice} onChangeText={v => set("minPrice", v)} placeholder="50" placeholderTextColor={colors.inkSubtle} keyboardType="numeric" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Max Price ($)</Text>
              <TextInput style={styles.input} value={form.maxPrice} onChangeText={v => set("maxPrice", v)} placeholder="200" placeholderTextColor={colors.inkSubtle} keyboardType="numeric" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Duration (min)</Text>
              <TextInput style={styles.input} value={form.duration} onChangeText={v => set("duration", v)} placeholder="60" placeholderTextColor={colors.inkSubtle} keyboardType="numeric" />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>My Services</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={20} color={colors.ink} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {services.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛠️</Text>
            <Text style={styles.emptyTitle}>No services yet</Text>
            <Text style={styles.emptyText}>Add your first service so customers can book you.</Text>
            <Pressable style={styles.addBtn2} onPress={openNew}>
              <Text style={styles.addBtn2Text}>Add Service</Text>
            </Pressable>
          </View>
        ) : services.map((s, i) => {
          const cat = CATEGORIES.find(c => c.key === s.category);
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(i * 40)}>
              <View style={[styles.card, !s.isActive && { opacity: 0.55 }]}>
                <View style={styles.cardTop}>
                  <Text style={styles.catEmoji}>{cat?.emoji || "🛠️"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.catLabel}>{cat?.label}</Text>
                  </View>
                  <Switch
                    value={s.isActive}
                    onValueChange={() => toggleActive(s)}
                    trackColor={{ false: colors.card, true: colors.success + "50" }}
                    thumbColor={s.isActive ? colors.success : colors.inkSubtle}
                  />
                </View>
                <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
                <View style={styles.meta}>
                  <Text style={styles.priceText}>${s.minPrice}–${s.maxPrice}</Text>
                  <Text style={styles.metaText}>· {s.duration} min</Text>
                  <Text style={[styles.activeTag, { color: s.isActive ? colors.success : colors.inkSubtle }]}>
                    {s.isActive ? "Active" : "Paused"}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable style={styles.editBtn} onPress={() => openEdit(s)}>
                    <Ionicons name="pencil" size={14} color={colors.skyBlue} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => remove(s)}>
                    <Ionicons name="trash" size={14} color={colors.danger} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  topTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.xl, flex: 1 },
  saveLink: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.base },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.sm },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: 100 },
  formScroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },
  empty: { alignItems: "center", paddingTop: 60, gap: spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.lg },
  emptyText: { color: colors.inkSubtle, fontSize: fontSize.sm, textAlign: "center" },
  addBtn2: { backgroundColor: colors.skyBlue, borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: 12, marginTop: spacing.sm },
  addBtn2Text: { color: colors.ink, fontWeight: "700", fontSize: fontSize.base },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catEmoji: { fontSize: 24 },
  serviceTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  catLabel: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  desc: { color: colors.inkSubtle, fontSize: fontSize.xs, lineHeight: 18 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  priceText: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.xs },
  metaText: { color: colors.inkSubtle, fontSize: fontSize.xs },
  activeTag: { marginLeft: "auto", fontSize: fontSize.xs, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.skyBlue + "40", borderRadius: radius.md, paddingVertical: 8 },
  editBtnText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "700" },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.danger + "40", borderRadius: radius.md, paddingVertical: 8 },
  deleteBtnText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: "700" },
  field: { gap: 6 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm, fontWeight: "600" },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: fontSize.base },
  row3: { flexDirection: "row", gap: spacing.sm },
  imagePicker: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, overflow: "hidden", height: 160, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  imagePreview: { width: "100%", height: 160, resizeMode: "cover" },
  imagePlaceholder: { alignItems: "center", gap: 8 },
  imagePlaceholderText: { color: colors.inkSubtle, fontSize: fontSize.sm },
  catPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  catPickerText: { color: colors.white, fontSize: fontSize.base },
  catList: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, overflow: "hidden" },
  catOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  catOptionActive: { backgroundColor: colors.skyBlue + "15" },
  catOptionText: { color: colors.white, fontSize: fontSize.sm },
});
