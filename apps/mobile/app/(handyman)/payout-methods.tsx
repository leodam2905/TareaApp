import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useStripe, CardField, CardFieldInput } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

interface Card { id: string; brand: string; last4: string; expMonth: number; expYear: number; funding: string; isDefault: boolean }
interface Bank { id: string; bankName: string | null; last4: string; routingNumber: string | null; isDefault: boolean }

export default function PayoutMethodsScreen() {
  const router = useRouter();
  const { createToken } = useStripe();

  const [cards, setCards] = useState<Card[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [holderName, setHolderName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/handyman/payout-methods");
      setCards(res.data.cards ?? []);
      setBanks(res.data.banks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCard = async () => {
    if (!cardDetails?.complete) {
      Alert.alert("Error", "Please enter your full card details.");
      return;
    }
    setSavingCard(true);
    const { token, error } = await createToken({ type: "Card" });
    if (error) {
      Alert.alert("Card Error", error.message);
      setSavingCard(false);
      return;
    }
    if ((token as { card?: { funding?: string } })?.card?.funding !== "debit") {
      Alert.alert("Debit Card Required", "Only debit cards are accepted for instant payouts. Please use a debit card.");
      setSavingCard(false);
      return;
    }
    try {
      await api.post("/handyman/payout-methods", { token: token!.id, type: "card" });
      Alert.alert("Done!", "Debit card added successfully.");
      setShowAddCard(false);
      load();
    } catch {
      Alert.alert("Error", "Failed to save card.");
    } finally {
      setSavingCard(false);
    }
  };

  const addBank = async () => {
    if (!holderName || !routing || !account) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (account !== accountConfirm) {
      Alert.alert("Error", "Account numbers do not match.");
      return;
    }
    setSavingBank(true);
    const { token, error } = await createToken({
      type: "BankAccount",
      accountNumber: account,
      routingNumber: routing,
      country: "US",
      currency: "usd",
      accountHolderName: holderName,
      accountHolderType: "Individual",
    });
    if (error) {
      Alert.alert("Bank Error", error.message);
      setSavingBank(false);
      return;
    }
    try {
      await api.post("/handyman/payout-methods", { token: token!.id, type: "bank_account" });
      Alert.alert("Done!", "Bank account added successfully.");
      setShowAddBank(false);
      setHolderName(""); setRouting(""); setAccount(""); setAccountConfirm("");
      load();
    } catch {
      Alert.alert("Error", "Failed to save bank account.");
    } finally {
      setSavingBank(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert("Remove", "Remove this payout method?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          setRemoving(id);
          try {
            await api.delete(`/handyman/payout-methods/${id}`);
            load();
          } catch {
            Alert.alert("Error", "Failed to remove.");
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  };

  const setDefault = async (id: string) => {
    try {
      await api.patch(`/handyman/payout-methods/${id}`);
      load();
    } catch {
      Alert.alert("Error", "Failed to update.");
    }
  };

  const debitCards = cards.filter(c => c.funding === "debit");
  const inputCls = styles.input;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <View>
          <Text style={styles.title}>Payout Methods</Text>
          <Text style={styles.subtitle}>Manage your debit card and bank account</Text>
        </View>
      </View>

      {/* Info cards */}
      <View style={styles.infoRow}>
        <View style={[styles.infoCard, { borderColor: "#7C3AED40" }]}>
          <Ionicons name="flash" size={16} color="#A78BFA" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Debit Card</Text>
            <Text style={styles.infoSub}>Instant · 1% fee · ~30 min</Text>
          </View>
        </View>
        <View style={[styles.infoCard, { borderColor: colors.skyBlue + "40" }]}>
          <Ionicons name="calendar" size={16} color={colors.skyBlue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Bank Account</Text>
            <Text style={styles.infoSub}>Weekly · Free · 1–2 days</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.skyBlue} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* ── Debit cards ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <Ionicons name="card" size={18} color="#A78BFA" />
                <Text style={styles.sectionTitle}>Debit Cards</Text>
              </View>
              <Pressable onPress={() => { setShowAddCard(v => !v); setShowAddBank(false); }} style={styles.addBtn}>
                <Ionicons name={showAddCard ? "close" : "add"} size={16} color="#A78BFA" />
                <Text style={[styles.addBtnText, { color: "#A78BFA" }]}>{showAddCard ? "Cancel" : "Add"}</Text>
              </Pressable>
            </View>

            {debitCards.length === 0 && !showAddCard && (
              <View style={styles.emptyBox}>
                <Ionicons name="card-outline" size={32} color={colors.inkSubtle} />
                <Text style={styles.emptyText}>No debit card added</Text>
              </View>
            )}

            {debitCards.map(card => (
              <View key={card.id} style={styles.methodRow}>
                <View style={[styles.methodIcon, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED30" }]}>
                  <Ionicons name="card" size={18} color="#A78BFA" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.methodName}>{card.brand} ···· {card.last4}</Text>
                    {card.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.methodSub}>Expires {card.expMonth}/{card.expYear}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {!card.isDefault && (
                    <Pressable onPress={() => setDefault(card.id)} style={styles.iconBtn}>
                      <Ionicons name="star-outline" size={16} color={colors.inkSubtle} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => remove(card.id)} style={styles.iconBtn} disabled={removing === card.id}>
                    {removing === card.id
                      ? <ActivityIndicator size="small" color={colors.danger} />
                      : <Ionicons name="trash-outline" size={16} color={colors.danger} />}
                  </Pressable>
                </View>
              </View>
            ))}

            {showAddCard && (
              <View style={styles.addForm}>
                <Text style={styles.formLabel}>Card details</Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholder={{ number: "4242 4242 4242 4242" }}
                  cardStyle={{
                    backgroundColor: colors.background,
                    textColor: colors.white,
                    placeholderColor: colors.inkSubtle,
                    borderColor: "rgba(255,255,255,0.12)",
                    borderWidth: 1,
                    borderRadius: radius.md,
                  }}
                  style={styles.cardField}
                  onCardChange={setCardDetails}
                />
                <Text style={styles.formHint}>Only debit cards accepted for instant payouts.</Text>
                <Pressable
                  style={[styles.submitBtn, { backgroundColor: "#7C3AED" }, savingCard && styles.submitBtnDisabled]}
                  onPress={addCard}
                  disabled={savingCard}
                >
                  {savingCard
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="add-circle" size={18} color="#fff" />}
                  <Text style={styles.submitBtnText}>Add Debit Card</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Bank accounts ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <Ionicons name="business" size={18} color={colors.skyBlue} />
                <Text style={styles.sectionTitle}>Bank Accounts</Text>
              </View>
              <Pressable onPress={() => { setShowAddBank(v => !v); setShowAddCard(false); }} style={styles.addBtn}>
                <Ionicons name={showAddBank ? "close" : "add"} size={16} color={colors.skyBlue} />
                <Text style={[styles.addBtnText, { color: colors.skyBlue }]}>{showAddBank ? "Cancel" : "Add"}</Text>
              </Pressable>
            </View>

            {banks.length === 0 && !showAddBank && (
              <View style={styles.emptyBox}>
                <Ionicons name="business-outline" size={32} color={colors.inkSubtle} />
                <Text style={styles.emptyText}>No bank account added</Text>
              </View>
            )}

            {banks.map(bank => (
              <View key={bank.id} style={styles.methodRow}>
                <View style={[styles.methodIcon, { backgroundColor: colors.skyBlue + "15", borderColor: colors.skyBlue + "30" }]}>
                  <Ionicons name="business" size={18} color={colors.skyBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.methodName}>{bank.bankName ?? "Bank"} ···· {bank.last4}</Text>
                    {bank.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.skyBlue + "20", borderColor: colors.skyBlue + "40" }]}>
                        <Text style={[styles.defaultBadgeText, { color: colors.skyBlue }]}>Default</Text>
                      </View>
                    )}
                  </View>
                  {bank.routingNumber && <Text style={styles.methodSub}>Routing ···{bank.routingNumber.slice(-4)}</Text>}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {!bank.isDefault && (
                    <Pressable onPress={() => setDefault(bank.id)} style={styles.iconBtn}>
                      <Ionicons name="star-outline" size={16} color={colors.inkSubtle} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => remove(bank.id)} style={styles.iconBtn} disabled={removing === bank.id}>
                    {removing === bank.id
                      ? <ActivityIndicator size="small" color={colors.danger} />
                      : <Ionicons name="trash-outline" size={16} color={colors.danger} />}
                  </Pressable>
                </View>
              </View>
            ))}

            {showAddBank && (
              <View style={styles.addForm}>
                <Text style={styles.formLabel}>US bank account (routing + account number)</Text>
                <TextInput style={inputCls} placeholder="Account holder name" placeholderTextColor={colors.inkSubtle} value={holderName} onChangeText={setHolderName} />
                <TextInput style={inputCls} placeholder="Routing number (9 digits)" placeholderTextColor={colors.inkSubtle} value={routing} onChangeText={setRouting} keyboardType="number-pad" maxLength={9} />
                <TextInput style={inputCls} placeholder="Account number" placeholderTextColor={colors.inkSubtle} value={account} onChangeText={setAccount} keyboardType="number-pad" secureTextEntry />
                <TextInput style={inputCls} placeholder="Confirm account number" placeholderTextColor={colors.inkSubtle} value={accountConfirm} onChangeText={setAccountConfirm} keyboardType="number-pad" secureTextEntry />
                <Pressable
                  style={[styles.submitBtn, { backgroundColor: colors.skyBlue }, savingBank && styles.submitBtnDisabled]}
                  onPress={addBank}
                  disabled={savingBank}
                >
                  {savingBank
                    ? <ActivityIndicator size="small" color={colors.ink} />
                    : <Ionicons name="add-circle" size={18} color={colors.ink} />}
                  <Text style={[styles.submitBtnText, { color: colors.ink }]}>Add Bank Account</Text>
                </Pressable>
              </View>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Platform.OS === "ios" ? 60 : 40, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  subtitle: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },

  infoRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  infoCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1 },
  infoTitle: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700" },
  infoSub: { color: colors.inkSubtle, fontSize: 10, marginTop: 1 },

  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 100 },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  addBtnText: { fontSize: fontSize.xs, fontWeight: "600" },

  emptyBox: { alignItems: "center", paddingVertical: spacing.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius.xl, borderStyle: "dashed" },
  emptyText: { color: colors.inkSubtle, marginTop: spacing.sm, fontSize: fontSize.sm },

  methodRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  methodIcon: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  methodName: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  methodSub: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  defaultBadge: { backgroundColor: "#10B98120", borderColor: "#10B98140", borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { color: colors.success, fontSize: 10, fontWeight: "700" },
  iconBtn: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },

  addForm: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, gap: spacing.sm },
  formLabel: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  formHint: { color: colors.inkSubtle, fontSize: 10 },
  cardField: { width: "100%", height: 50 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: fontSize.sm },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 13, borderRadius: radius.lg },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
});
