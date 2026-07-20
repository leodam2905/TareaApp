import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  UserRound,
  Wrench,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Change these colors to match the existing Tarea theme.
 */
const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#EFF6FF",
  background: "#F6F8FC",
  card: "#FFFFFF",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#16A34A",
  warningBackground: "#FFF7ED",
  warningText: "#C2410C",
  star: "#F59E0B",
};

export type JobStatus =
  | "available"
  | "interested"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PricingType = "fixed" | "hourly";

export interface JobCustomer {
  id: string;
  name: string;
  initials: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  joinedDate: string;
}

export interface Job {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  pricingType: PricingType;
  distanceMiles: number;
  address: string;
  preferredDate: string;
  preferredTime: string;
  estimatedDuration: string;
  customerProvides: string[];
  customer: JobCustomer;
  status: JobStatus;
  isDemo?: boolean;
}

export interface JobDetailsScreenProps {
  job?: Job;
  onBack?: () => void;
  onSubmitInterest?: (job: Job) => Promise<void>;
}

export const demoJob: Job = {
  id: "TAR-DEMO-001",
  title: "Kitchen Faucet Installation",
  category: "Plumbing · Fixtures",
  description:
    "The customer needs a new kitchen faucet installed. The faucet has already been purchased. The professional should remove the existing faucet, install the new one, test the connections, and clean the work area before leaving.",
  price: 120,
  currency: "USD",
  pricingType: "fixed",
  distanceMiles: 2.4,
  address: "123 SW 8th Street, Miami, FL 33130",
  preferredDate: "Saturday, July 25",
  preferredTime: "8:00 AM – 12:00 PM",
  estimatedDuration: "1–2 hours",
  customerProvides: ["Kitchen faucet", "Installation materials"],
  customer: {
    id: "demo-customer-001",
    name: "John T.",
    initials: "JT",
    rating: 5,
    reviewCount: 24,
    verified: true,
    joinedDate: "March 2024",
  },
  status: "available",
  isDemo: true,
};

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

export default function JobDetailsScreen({
  job: incomingJob,
  onBack,
  onSubmitInterest,
}: JobDetailsScreenProps) {
  const job = useMemo(() => incomingJob ?? demoJob, [incomingJob]);
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<JobStatus>(job.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSubmittedInterest = status === "interested";

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    console.log("Back pressed");
  };

  const handleSubmitInterest = async () => {
    if (hasSubmittedInterest || isSubmitting) return;
    try {
      setIsSubmitting(true);
      if (onSubmitInterest) {
        await onSubmitInterest({ ...job, status });
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
      }
      setStatus("interested");
      Alert.alert(
        "Interest submitted",
        "The customer will be able to review your profile. We'll notify you if you are selected.",
      );
    } catch (error) {
      console.error("Unable to submit interest:", error);
      Alert.alert(
        "Something went wrong",
        "Your interest could not be submitted. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonLabel = isSubmitting
    ? "Submitting..."
    : hasSubmittedInterest
      ? "Interest submitted"
      : "I'm interested";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
          <ArrowLeft color={COLORS.text} size={23} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job details</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {job.isDemo && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerTitle}>DEMO JOB</Text>
            <Text style={styles.demoBannerText}>This is preview data and is not a real customer request.</Text>
          </View>
        )}

        <View style={styles.heroCard}>
          <View style={styles.categoryIcon}>
            <Wrench color={COLORS.primary} size={25} strokeWidth={2.2} />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.category}>{job.category}</Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <View style={styles.distanceRow}>
              <MapPin color={COLORS.textMuted} size={16} strokeWidth={2} />
              <Text style={styles.distanceText}>{job.distanceMiles} miles away</Text>
            </View>
          </View>
        </View>

        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceLabel}>Customer budget</Text>
            <Text style={styles.price}>{formatCurrency(job.price, job.currency)}</Text>
          </View>
          <View style={styles.priceTypeBadge}>
            <Text style={styles.priceTypeText}>{job.pricingType === "fixed" ? "Fixed price" : "Hourly"}</Text>
          </View>
        </View>

        <Section title="Job description">
          <Text style={styles.description}>{job.description}</Text>
        </Section>

        <Section title="Schedule">
          <InformationRow icon={<CalendarDays color={COLORS.primary} size={21} strokeWidth={2} />} label="Preferred date" value={job.preferredDate} />
          <View style={styles.rowDivider} />
          <InformationRow icon={<Clock3 color={COLORS.primary} size={21} strokeWidth={2} />} label="Preferred time" value={job.preferredTime} />
          <View style={styles.rowDivider} />
          <InformationRow icon={<Clock3 color={COLORS.primary} size={21} strokeWidth={2} />} label="Estimated duration" value={job.estimatedDuration} />
        </Section>

        <Section title="Location">
          <TouchableOpacity activeOpacity={0.75} onPress={() => Alert.alert("Location", "Map navigation can be enabled after the professional is assigned.")} style={styles.locationRow}>
            <View style={styles.locationIconContainer}>
              <MapPin color={COLORS.primary} size={22} strokeWidth={2} />
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.locationAddress}>{job.address}</Text>
              <Text style={styles.locationNote}>The exact access details are shared after assignment.</Text>
            </View>
            <ChevronRight color={COLORS.textMuted} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </Section>

        {job.customerProvides.length > 0 && (
          <Section title="Customer provides">
            <View style={styles.providesList}>
              {job.customerProvides.map((item) => (
                <View key={item} style={styles.providesItem}>
                  <View style={styles.checkIcon}><Check color={COLORS.success} size={15} strokeWidth={3} /></View>
                  <Text style={styles.providesText}>{item}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="About the customer">
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitials}>{job.customer.initials}</Text>
            </View>
            <View style={styles.customerInfo}>
              <View style={styles.customerNameRow}>
                <Text style={styles.customerName}>{job.customer.name}</Text>
                {job.customer.verified && <ShieldCheck color={COLORS.primary} size={18} strokeWidth={2.3} />}
              </View>
              {job.customer.reviewCount > 0 && (
                <View style={styles.ratingRow}>
                  <Star color={COLORS.star} fill={COLORS.star} size={16} strokeWidth={2} />
                  <Text style={styles.ratingText}>{job.customer.rating.toFixed(1)}</Text>
                  <Text style={styles.reviewText}>({job.customer.reviewCount} reviews)</Text>
                </View>
              )}
              {job.customer.joinedDate ? (
                <View style={styles.memberRow}>
                  <UserRound color={COLORS.textMuted} size={15} strokeWidth={2} />
                  <Text style={styles.memberText}>Member since {job.customer.joinedDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Section>

        {hasSubmittedInterest && (
          <View style={styles.successCard}>
            <CheckCircle2 color={COLORS.success} size={25} strokeWidth={2.2} />
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Your interest was submitted</Text>
              <Text style={styles.successText}>We will notify you if the customer selects you for this job.</Text>
            </View>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Do not share payment information outside Tarea. Confirm the scope and final price before starting the job.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.bottomPrice}>
          <Text style={styles.bottomPriceLabel}>Potential earnings</Text>
          <Text style={styles.bottomPriceValue}>{formatCurrency(job.price, job.currency)}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} disabled={hasSubmittedInterest || isSubmitting} onPress={handleSubmitInterest}
          style={[styles.interestButton, (hasSubmittedInterest || isSubmitting) && styles.interestButtonDisabled]}>
          {hasSubmittedInterest && <Check color="#FFFFFF" size={19} strokeWidth={3} />}
          <Text style={styles.interestButtonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InformationRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.informationRow}>
      <View style={styles.informationIcon}>{icon}</View>
      <View style={styles.informationText}>
        <Text style={styles.informationLabel}>{label}</Text>
        <Text style={styles.informationValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { alignItems: "center", backgroundColor: COLORS.card, borderBottomColor: COLORS.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 58, justifyContent: "space-between", paddingHorizontal: 16 },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  headerPlaceholder: { height: 40, width: 40 },
  scrollContent: { paddingBottom: 160, paddingHorizontal: 16, paddingTop: 16 },
  demoBanner: { backgroundColor: COLORS.warningBackground, borderRadius: 14, marginBottom: 14, paddingHorizontal: 15, paddingVertical: 12 },
  demoBannerTitle: { color: COLORS.warningText, fontSize: 12, fontWeight: "800", letterSpacing: 0.7, marginBottom: 3 },
  demoBannerText: { color: COLORS.warningText, fontSize: 13, lineHeight: 19 },
  heroCard: { alignItems: "flex-start", backgroundColor: COLORS.card, borderColor: COLORS.border, borderRadius: 20, borderWidth: 1, flexDirection: "row", padding: 18 },
  categoryIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 15, height: 52, justifyContent: "center", marginRight: 14, width: 52 },
  heroContent: { flex: 1 },
  category: { color: COLORS.primary, fontSize: 13, fontWeight: "700", marginBottom: 5 },
  jobTitle: { color: COLORS.text, fontSize: 22, fontWeight: "800", lineHeight: 28, marginBottom: 9 },
  distanceRow: { alignItems: "center", flexDirection: "row" },
  distanceText: { color: COLORS.textMuted, fontSize: 14, marginLeft: 5 },
  priceCard: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 20, flexDirection: "row", justifyContent: "space-between", marginTop: 14, padding: 18 },
  priceLabel: { color: "#DBEAFE", fontSize: 13, fontWeight: "600", marginBottom: 3 },
  price: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  priceTypeBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  priceTypeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  section: { marginTop: 22 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginBottom: 10, marginLeft: 2 },
  sectionCard: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, padding: 16 },
  description: { color: COLORS.textMuted, fontSize: 15, lineHeight: 23 },
  informationRow: { alignItems: "center", flexDirection: "row", minHeight: 54 },
  informationIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 13, width: 42 },
  informationText: { flex: 1 },
  informationLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 3 },
  informationValue: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  rowDivider: { backgroundColor: COLORS.border, height: StyleSheet.hairlineWidth, marginVertical: 10 },
  locationRow: { alignItems: "center", flexDirection: "row" },
  locationIconContainer: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 13, height: 46, justifyContent: "center", marginRight: 13, width: 46 },
  locationContent: { flex: 1, paddingRight: 8 },
  locationAddress: { color: COLORS.text, fontSize: 15, fontWeight: "700", lineHeight: 21, marginBottom: 4 },
  locationNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  providesList: { gap: 13 },
  providesItem: { alignItems: "center", flexDirection: "row" },
  checkIcon: { alignItems: "center", backgroundColor: "#DCFCE7", borderRadius: 999, height: 25, justifyContent: "center", marginRight: 10, width: 25 },
  providesText: { color: COLORS.text, flex: 1, fontSize: 15, fontWeight: "600" },
  customerRow: { alignItems: "center", flexDirection: "row" },
  customerAvatar: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 999, height: 58, justifyContent: "center", marginRight: 14, width: 58 },
  customerInitials: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  customerInfo: { flex: 1 },
  customerNameRow: { alignItems: "center", flexDirection: "row", gap: 6, marginBottom: 6 },
  customerName: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  ratingRow: { alignItems: "center", flexDirection: "row", marginBottom: 7 },
  ratingText: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginLeft: 5 },
  reviewText: { color: COLORS.textMuted, fontSize: 14, marginLeft: 4 },
  memberRow: { alignItems: "center", flexDirection: "row" },
  memberText: { color: COLORS.textMuted, fontSize: 12, marginLeft: 5 },
  successCard: { alignItems: "flex-start", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderRadius: 17, borderWidth: 1, flexDirection: "row", marginTop: 20, padding: 15 },
  successContent: { flex: 1, marginLeft: 11 },
  successTitle: { color: "#166534", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  successText: { color: "#15803D", fontSize: 13, lineHeight: 19 },
  disclaimer: { marginTop: 18, paddingHorizontal: 8 },
  disclaimerText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  bottomBar: { alignItems: "center", backgroundColor: COLORS.card, borderTopColor: COLORS.border, borderTopWidth: 1, bottom: 0, flexDirection: "row", left: 0, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 12, position: "absolute", right: 0 },
  bottomPrice: { marginRight: 14 },
  bottomPriceLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  bottomPriceValue: { color: COLORS.text, fontSize: 20, fontWeight: "800" },
  interestButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, flex: 1, flexDirection: "row", gap: 7, height: 52, justifyContent: "center", paddingHorizontal: 15 },
  interestButtonDisabled: { backgroundColor: COLORS.success },
  interestButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
