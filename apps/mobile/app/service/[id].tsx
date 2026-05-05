import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const CATEGORIES: Record<string, { icon: string; label: string }> = {
  PLUMBING: { icon: "🔧", label: "Plumbing" },
  ELECTRICAL: { icon: "⚡", label: "Electrical" },
  CARPENTRY: { icon: "🪚", label: "Carpentry" },
  PAINTING: { icon: "🎨", label: "Painting" },
  CLEANING: { icon: "🧹", label: "Cleaning" },
  HVAC: { icon: "❄️", label: "HVAC" },
  ROOFING: { icon: "🏠", label: "Roofing" },
  LANDSCAPING: { icon: "🌿", label: "Landscaping" },
  MOVING: { icon: "📦", label: "Moving" },
  APPLIANCE_REPAIR: { icon: "🔌", label: "Appliance" },
  GENERAL: { icon: "🛠️", label: "General" },
};

interface PortfolioPhoto {
  id: string;
  url: string;
  caption: string | null;
}

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  duration: number;
  handyman: {
    id: string;
    rating: number;
    totalJobs: number;
    isPremium: boolean;
    user: {
      id: string;
      name: string;
      isVerified: boolean;
      avatarUrl: string | null;
      city: string | null;
      state: string | null;
    };
  } | null;
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Booking form
  const [dateInput, setDateInput] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{
    valid: boolean; discountType?: string; discountValue?: number; error?: string;
  } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  useEffect(() => {
    api.get(`/services/${id}`)
      .then(res => {
        setService(res.data);
        if (res.data.handyman?.id) {
          api.get(`/portfolio/handyman/${res.data.handyman.id}`)
            .then(pr => setPortfolio(pr.data ?? []))
            .catch(() => {});
        }
      })
      .catch(() => {
        Alert.alert("Error", "Could not load service");
        router.back();
      })
      .finally(() => setLoading(false));
  }, [id]);

  const checkPromo = async () => {
    if (!promoCode.trim()) return;
    setCheckingPromo(true);
    try {
      const res = await api.post("/promo-codes/validate", { code: promoCode.trim().toUpperCase() });
      setPromoResult(res.data);
      if (res.data.valid) {
        // Auto-apply discount to price field if already filled
        if (price) {
          const numPrice = parseFloat(price);
          if (!isNaN(numPrice)) {
            let discounted = numPrice;
            if (res.data.discountType === "PERCENT") {
              discounted = numPrice * (1 - res.data.discountValue / 100);
            } else {
              discounted = Math.max(0, numPrice - res.data.discountValue);
            }
            setPrice(discounted.toFixed(2));
          }
        }
      }
    } catch {
      setPromoResult({ valid: false, error: "Failed to validate code" });
    }
    setCheckingPromo(false);
  };

  const handleBook = async () => {
    if (!service?.handyman) {
      Alert.alert("Error", "This service has no handyman assigned.");
      return;
    }
    if (!dateInput.trim()) { Alert.alert("Required", "Please enter a date and time."); return; }
    if (!address.trim()) { Alert.alert("Required", "Please enter your address."); return; }
    if (!city.trim()) { Alert.alert("Required", "Please enter your city."); return; }
    if (!price.trim()) { Alert.alert("Required", "Please enter the agreed price."); return; }

    const scheduledAt = new Date(dateInput.trim()).toISOString();
    if (isNaN(new Date(scheduledAt).getTime())) {
      Alert.alert("Invalid date", "Use format: 2026-05-15 09:00");
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return;
    }

    // Build notes with promo prefix if applicable
    let finalNotes = notes.trim();
    if (promoResult?.valid && promoCode.trim()) {
      finalNotes = `[PROMO:${promoCode.trim().toUpperCase()}]${finalNotes ? " " + finalNotes : ""}`;
    }

    setBooking(true);
    try {
      const res = await api.post("/bookings", {
        serviceId: service.id,
        handymanUserId: service.handyman.user.id,
        scheduledAt,
        address: address.trim(),
        city: city.trim(),
        notes: finalNotes || undefined,
        totalPrice: numPrice,
      });
      Alert.alert(
        "Booking sent!",
        "The handyman will confirm shortly.",
        [{ text: "OK", onPress: () => router.push(`/booking/${res.data.id}` as never) }]
      );
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Booking failed. Please try again.");
    }
    setBooking(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.skyBlue} size="large" />
      </View>
    );
  }

  if (!service) return null;

  const cat = CATEGORIES[service.category] ?? { icon: "🛠️", label: service.category };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{service.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Service Info */}
        <View style={styles.card}>
          <Text style={styles.catLabel}>{cat.icon} {cat.label}</Text>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.description}>{service.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={14} color={colors.skyBlue} />
              <Text style={styles.metaValue}>${service.minPrice}–${service.maxPrice}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.skyBlue} />
              <Text style={styles.metaValue}>{service.duration} min</Text>
            </View>
          </View>
        </View>

        {/* Handyman Card */}
        {service.handyman && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Your Handyman</Text>
            <View style={styles.handymanRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {service.handyman.user.name[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.handyName}>{service.handyman.user.name}</Text>
                  {service.handyman.user.isVerified && (
                    <Text style={styles.verifiedBadge}>✓</Text>
                  )}
                  {service.handyman.isPremium && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>⭐ PRO</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: 4 }}>
                  <Text style={styles.handyMeta}>⭐ {service.handyman.rating.toFixed(1)}</Text>
                  <Text style={styles.handyMeta}>🔨 {service.handyman.totalJobs} jobs</Text>
                </View>
              </View>
            </View>

            {/* Portfolio */}
            {portfolio.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
              >
                {portfolio.map(p => (
                  <Image
                    key={p.id}
                    source={{ uri: p.url }}
                    style={styles.portfolioPhoto}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Booking Form */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Book This Service</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date & Time</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="calendar-outline" size={16} color={colors.inkSubtle} />
              <TextInput
                style={styles.input}
                placeholder="2026-05-15 09:00"
                placeholderTextColor={colors.inkSubtle}
                value={dateInput}
                onChangeText={setDateInput}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="home-outline" size={16} color={colors.inkSubtle} />
              <TextInput
                style={styles.input}
                placeholder="123 Main St"
                placeholderTextColor={colors.inkSubtle}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>City</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="business-outline" size={16} color={colors.inkSubtle} />
              <TextInput
                style={styles.input}
                placeholder="Miami"
                placeholderTextColor={colors.inkSubtle}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <View style={[styles.inputWrap, { alignItems: "flex-start" }]}>
              <Ionicons name="document-text-outline" size={16} color={colors.inkSubtle} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.input, { height: 64, textAlignVertical: "top" }]}
                placeholder="Any special instructions..."
                placeholderTextColor={colors.inkSubtle}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Agreed Price (Between ${service.minPrice}–${service.maxPrice})
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons name="cash-outline" size={16} color={colors.inkSubtle} />
              <TextInput
                style={styles.input}
                placeholder={`${service.minPrice}`}
                placeholderTextColor={colors.inkSubtle}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Promo Code */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Promo Code (optional)</Text>
            <View style={styles.promoRow}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Ionicons name="pricetag-outline" size={16} color={colors.inkSubtle} />
                <TextInput
                  style={styles.input}
                  placeholder="SAVE10"
                  placeholderTextColor={colors.inkSubtle}
                  value={promoCode}
                  onChangeText={text => {
                    setPromoCode(text.toUpperCase());
                    setPromoResult(null);
                  }}
                  onSubmitEditing={checkPromo}
                  autoCapitalize="characters"
                />
              </View>
              <Pressable
                style={[styles.promoBtn, checkingPromo && { opacity: 0.6 }]}
                onPress={checkPromo}
                disabled={checkingPromo || !promoCode.trim()}
              >
                {checkingPromo
                  ? <ActivityIndicator size="small" color={colors.ink} />
                  : <Text style={styles.promoBtnText}>Apply</Text>}
              </Pressable>
            </View>
            {promoResult && (
              <Text style={[styles.promoFeedback, { color: promoResult.valid ? colors.success : colors.danger }]}>
                {promoResult.valid
                  ? promoResult.discountType === "PERCENT"
                    ? `✓ ${promoResult.discountValue}% off applied!`
                    : `✓ -$${promoResult.discountValue} applied!`
                  : `✗ ${promoResult.error ?? "Invalid code"}`}
              </Text>
            )}
          </View>
        </View>

        {/* Book Now Button */}
        <Pressable
          style={[styles.bookBtn, booking && { opacity: 0.7 }]}
          onPress={handleBook}
          disabled={booking}
        >
          {booking
            ? <ActivityIndicator color={colors.ink} />
            : <Ionicons name="checkmark-circle" size={20} color={colors.ink} />}
          <Text style={styles.bookBtnText}>{booking ? "Booking…" : "Book Now"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  topTitle: { flex: 1, color: colors.white, fontWeight: "800", fontSize: fontSize.base },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  catLabel: { color: colors.inkSubtle, fontSize: fontSize.xs },
  serviceTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.xl },
  description: { color: colors.inkSubtle, fontSize: fontSize.sm, lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaValue: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.sm },
  sectionLabel: {
    color: "rgba(255,255,255,0.5)", fontSize: fontSize.xs,
    fontWeight: "700", textTransform: "uppercase", letterSpacing: 1,
  },
  handymanRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.skyBlue + "30",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.lg },
  handyName: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  verifiedBadge: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.sm },
  proBadge: { backgroundColor: "#F59E0B20", borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  proBadgeText: { color: "#F59E0B", fontWeight: "700", fontSize: fontSize.xs },
  handyMeta: { color: colors.inkSubtle, fontSize: fontSize.xs },
  portfolioPhoto: { width: 80, height: 80, borderRadius: 8 },
  field: { gap: 6 },
  fieldLabel: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  input: { flex: 1, color: colors.white, fontSize: fontSize.base },
  promoRow: { flexDirection: "row", gap: spacing.sm },
  promoBtn: {
    backgroundColor: colors.skyBlue, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
  },
  promoBtnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.sm },
  promoFeedback: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
  bookBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, backgroundColor: colors.skyBlue,
    borderRadius: radius.xl, paddingVertical: 18,
  },
  bookBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.lg },
});
