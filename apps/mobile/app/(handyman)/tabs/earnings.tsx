import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { createBankAccountToken, createCardToken } from "@/lib/stripe";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

type EarningsData = { totalEarnings: number; pendingEarnings: number; totalJobs: number; stripeAccountStatus: string | null };
type Card         = { id: string; brand: string; last4: string; expMonth: number; expYear: number; funding: string; isDefault: boolean };
type Bank         = { id: string; bankName: string | null; last4: string; routingNumber: string | null; isDefault: boolean };
type Methods      = { cards: Card[]; banks: Bank[] };

export default function EarningsScreen() {
  const [data, setData]         = useState<EarningsData | null>(null);
  const [methods, setMethods]   = useState<Methods | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);

  // Add-bank modal
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ holderName: "", routing: "", account: "", accountConfirm: "" });
  const [addingBank, setAddingBank] = useState(false);

  // Add-debit-card modal
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [addingCard, setAddingCard] = useState(false);

  const load = useCallback(async () => {
    const [earningsRes, methodsRes] = await Promise.all([
      api.get("/handyman/earnings"),
      api.get("/handyman/payout-methods"),
    ]);
    if (earningsRes.ok) setData(await earningsRes.json());
    if (methodsRes.ok)  setMethods(await methodsRes.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const connectStripe = async () => {
    setConnecting(true);
    try {
      const res = await api.post("/stripe/connect", {});
      if (res.ok) {
        const { url } = await res.json();
        if (url) await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Could not start Stripe setup. Try again.");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    }
    setConnecting(false);
  };

  const setBankField = (k: keyof typeof bankForm, v: string) => setBankForm(f => ({ ...f, [k]: v }));

  const submitBank = async () => {
    const holderName = bankForm.holderName.trim();
    const routing    = bankForm.routing.trim();
    const account    = bankForm.account.trim();

    if (!holderName)                        { Alert.alert("Required", "Enter the account holder's name."); return; }
    if (!/^\d{9}$/.test(routing))           { Alert.alert("Invalid routing number", "The routing number must be exactly 9 digits."); return; }
    if (account.length < 4)                 { Alert.alert("Invalid account number", "Enter a valid account number."); return; }
    if (account !== bankForm.accountConfirm.trim()) { Alert.alert("Account numbers don't match", "Re-enter your account number so both fields match."); return; }

    setAddingBank(true);
    // 1) Tokenize with Stripe (raw details never hit our backend)
    const tok = await createBankAccountToken({ routingNumber: routing, accountNumber: account, accountHolderName: holderName });
    if (tok.error || !tok.id) {
      setAddingBank(false);
      Alert.alert("Couldn't add bank", tok.error ?? "Please check your details and try again.");
      return;
    }
    // 2) Attach to the connected account (becomes the new default automatically)
    const res = await api.post("/handyman/payout-methods", { token: tok.id, type: "bank_account" });
    setAddingBank(false);
    if (res.ok) {
      setShowAddBank(false);
      setBankForm({ holderName: "", routing: "", account: "", accountConfirm: "" });
      Alert.alert("Bank added", "Your new bank account is now your default payout method.");
      load();
    } else {
      let msg = "Failed to add bank account.";
      try { msg = (await res.json())?.error ?? msg; } catch {}
      Alert.alert("Couldn't add bank", msg);
    }
  };

  const setCardField = (k: keyof typeof cardForm, v: string) => setCardForm(f => ({ ...f, [k]: v }));

  const submitCard = async () => {
    const name   = cardForm.name.trim();
    const number = cardForm.number.replace(/\s/g, "");
    const cvc    = cardForm.cvc.trim();
    const [mm, yy] = cardForm.exp.split("/").map(s => s.trim());

    if (number.length < 15)                     { Alert.alert("Invalid card number", "Enter the full card number."); return; }
    if (!mm || !yy || !/^\d{1,2}$/.test(mm) || !/^\d{2,4}$/.test(yy)) {
      Alert.alert("Invalid expiry", "Enter the expiry date as MM/YY.");
      return;
    }
    if (!/^\d{3,4}$/.test(cvc))                 { Alert.alert("Invalid CVC", "Enter the 3- or 4-digit security code."); return; }

    setAddingCard(true);
    // 1) Tokenize with Stripe (raw card details never hit our backend)
    const tok = await createCardToken({ number, expMonth: mm, expYear: yy, cvc, name: name || undefined });
    if (tok.error || !tok.id) {
      setAddingCard(false);
      Alert.alert("Couldn't add card", tok.error ?? "Please check your details and try again.");
      return;
    }
    // 2) Attach to the connected account (becomes the new default automatically)
    const res = await api.post("/handyman/payout-methods", { token: tok.id, type: "card" });
    setAddingCard(false);
    if (res.ok) {
      setShowAddCard(false);
      setCardForm({ name: "", number: "", exp: "", cvc: "" });
      Alert.alert("Debit card added", "Your debit card is set up for instant payouts.");
      load();
    } else {
      let msg = "Failed to add debit card.";
      try { msg = (await res.json())?.error ?? msg; } catch {}
      Alert.alert("Couldn't add card", msg);
    }
  };

  const removeMethod = (id: string, label: string) => {
    Alert.alert(
      "Remove payout method",
      `Remove ${label}? Payouts will no longer be sent here.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            setBusyId(id);
            const res = await api.delete(`/handyman/payout-methods/${id}`);
            setBusyId(null);
            if (res.ok) load();
            else Alert.alert("Couldn't remove", "You can't remove your only default method. Add another first, then remove this one.");
          },
        },
      ]
    );
  };

  const setDefault = async (id: string) => {
    setBusyId(id);
    const res = await api.patch(`/handyman/payout-methods/${id}`, {});
    setBusyId(null);
    if (res.ok) load();
    else Alert.alert("Error", "Could not set as default. Try again.");
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  const stripeActive = data?.stripeAccountStatus === "active";
  const debitCards   = (methods?.cards ?? []).filter(c => c.funding === "debit");
  const banks        = methods?.banks ?? [];
  const hasNoMethods = debitCards.length === 0 && banks.length === 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Earnings</Text>
        </View>

        {/* Stats */}
        <View style={s.statsCol}>
          <View style={s.bigStat}>
            <Text style={s.bigLabel}>Total Earned</Text>
            <Text style={s.bigValue}>${(data?.totalEarnings ?? 0).toFixed(2)}</Text>
          </View>
          <View style={s.statsRow}>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Pending</Text>
              <Text style={[s.statValue, { color: C.amber }]}>${(data?.pendingEarnings ?? 0).toFixed(2)}</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Jobs Done</Text>
              <Text style={[s.statValue, { color: C.sky }]}>{data?.totalJobs ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Payout Methods */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payout Methods</Text>

          {/* Stripe identity status */}
          {!stripeActive ? (
            <View style={s.stripeSetup}>
              <Text style={s.stripeSetupText}>
                Verify your identity with Stripe to enable payouts and add a bank account.
              </Text>
              <TouchableOpacity
                style={[s.stripeBtn, connecting && s.stripeBtnDisabled]}
                onPress={connectStripe}
                disabled={connecting}
              >
                <Text style={s.stripeBtnText}>{connecting ? "Opening Stripe…" : "Verify Identity →"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Info chips */}
              <View style={s.infoRow}>
                <View style={[s.infoChip, { borderColor: "#7C3AED44", backgroundColor: "#7C3AED11" }]}>
                  <Text style={[s.infoChipText, { color: "#A78BFA" }]}>⚡ Debit — Instant (1% fee)</Text>
                </View>
                <View style={[s.infoChip, { borderColor: "#38BDF844", backgroundColor: "#38BDF811" }]}>
                  <Text style={[s.infoChipText, { color: C.sky }]}>🏦 Bank — Weekly, free</Text>
                </View>
              </View>

              {/* Bank accounts */}
              <View style={s.methodSection}>
                <View style={s.sectionHeader}>
                  <Text style={s.methodSectionLabel}>BANK ACCOUNTS</Text>
                  <TouchableOpacity onPress={() => setShowAddBank(true)} style={s.addBtn}>
                    <Text style={s.addBtnText}>+ Add bank</Text>
                  </TouchableOpacity>
                </View>
                {banks.length === 0 ? (
                  <Text style={s.emptyLine}>No bank account yet. Add one for free weekly payouts.</Text>
                ) : banks.map(bank => (
                  <View key={bank.id} style={s.methodRow}>
                    <View style={[s.methodIcon, { backgroundColor: "#38BDF811", borderColor: "#38BDF844" }]}>
                      <Text style={{ fontSize: 16 }}>🏦</Text>
                    </View>
                    <View style={s.methodInfo}>
                      <Text style={s.methodName}>{bank.bankName ?? "Bank"} ···· {bank.last4}</Text>
                      {bank.routingNumber && (
                        <Text style={s.methodSub}>Routing ···{bank.routingNumber.slice(-4)}</Text>
                      )}
                    </View>
                    {bank.isDefault ? (
                      <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Default</Text></View>
                    ) : (
                      <TouchableOpacity onPress={() => setDefault(bank.id)} disabled={busyId === bank.id} style={s.linkBtn}>
                        <Text style={s.linkBtnText}>Set default</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeMethod(bank.id, `${bank.bankName ?? "bank"} ···· ${bank.last4}`)} disabled={busyId === bank.id} style={s.removeBtn}>
                      {busyId === bank.id ? <ActivityIndicator color={C.red} size="small" /> : <Text style={s.removeBtnText}>Remove</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Debit cards */}
              {debitCards.length > 0 && (
                <View style={s.methodSection}>
                  <Text style={s.methodSectionLabel}>DEBIT CARDS</Text>
                  {debitCards.map(card => (
                    <View key={card.id} style={s.methodRow}>
                      <View style={[s.methodIcon, { backgroundColor: "#7C3AED11", borderColor: "#7C3AED44" }]}>
                        <Text style={{ fontSize: 16 }}>💳</Text>
                      </View>
                      <View style={s.methodInfo}>
                        <Text style={s.methodName}>{card.brand} ···· {card.last4}</Text>
                        <Text style={s.methodSub}>Expires {card.expMonth}/{card.expYear}</Text>
                      </View>
                      {card.isDefault ? (
                        <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Default</Text></View>
                      ) : (
                        <TouchableOpacity onPress={() => setDefault(card.id)} disabled={busyId === card.id} style={s.linkBtn}>
                          <Text style={s.linkBtnText}>Set default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => removeMethod(card.id, `${card.brand} ···· ${card.last4}`)} disabled={busyId === card.id} style={s.removeBtn}>
                        {busyId === card.id ? <ActivityIndicator color={C.red} size="small" /> : <Text style={s.removeBtnText}>Remove</Text>}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add a debit card (native, tokenized directly with Stripe) */}
              <TouchableOpacity onPress={() => setShowAddCard(true)} style={s.addBtn}>
                <Text style={s.addBtnText}>+ Add debit card</Text>
              </TouchableOpacity>

              {hasNoMethods && (
                <Text style={s.emptyMethodsText}>Add a bank account above to start receiving payouts.</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Add bank account modal */}
      <Modal visible={showAddBank} animationType="slide" transparent onRequestClose={() => setShowAddBank(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Bank Account</Text>
              <TouchableOpacity onPress={() => setShowAddBank(false)} disabled={addingBank}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>US bank accounts only. Your details go directly to Stripe — Tarea never stores your account number.</Text>

            <Text style={s.modalLabel}>Account holder name</Text>
            <TextInput style={s.modalInput} value={bankForm.holderName} onChangeText={v => setBankField("holderName", v)}
              placeholder="Full name on the account" placeholderTextColor={C.slate500} autoCapitalize="words" />

            <Text style={s.modalLabel}>Routing number (9 digits)</Text>
            <TextInput style={s.modalInput} value={bankForm.routing} onChangeText={v => setBankField("routing", v.replace(/[^0-9]/g, ""))}
              placeholder="123456789" placeholderTextColor={C.slate500} keyboardType="number-pad" maxLength={9} />

            <Text style={s.modalLabel}>Account number</Text>
            <TextInput style={s.modalInput} value={bankForm.account} onChangeText={v => setBankField("account", v.replace(/[^0-9]/g, ""))}
              placeholder="Account number" placeholderTextColor={C.slate500} keyboardType="number-pad" secureTextEntry />

            <Text style={s.modalLabel}>Confirm account number</Text>
            <TextInput style={s.modalInput} value={bankForm.accountConfirm} onChangeText={v => setBankField("accountConfirm", v.replace(/[^0-9]/g, ""))}
              placeholder="Re-enter account number" placeholderTextColor={C.slate500} keyboardType="number-pad" />

            <TouchableOpacity style={[s.modalBtn, addingBank && s.stripeBtnDisabled]} onPress={submitBank} disabled={addingBank}>
              {addingBank ? <ActivityIndicator color={C.ink} /> : <Text style={s.modalBtnText}>Add Bank Account</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add debit card modal */}
      <Modal visible={showAddCard} animationType="slide" transparent onRequestClose={() => setShowAddCard(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Debit Card</Text>
              <TouchableOpacity onPress={() => setShowAddCard(false)} disabled={addingCard}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>Debit cards only, for instant payouts (1% fee). Your card details go directly to Stripe — Tarea never stores them.</Text>

            <Text style={s.modalLabel}>Name on card (optional)</Text>
            <TextInput style={s.modalInput} value={cardForm.name} onChangeText={v => setCardField("name", v)}
              placeholder="Full name on the card" placeholderTextColor={C.slate500} autoCapitalize="words" />

            <Text style={s.modalLabel}>Card number</Text>
            <TextInput style={s.modalInput} value={cardForm.number}
              onChangeText={v => setCardField("number", v.replace(/[^0-9]/g, "").slice(0, 19))}
              placeholder="Debit card number" placeholderTextColor={C.slate500} keyboardType="number-pad" />

            <View style={s.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalLabel}>Expiry (MM/YY)</Text>
                <TextInput style={s.modalInput} value={cardForm.exp}
                  onChangeText={v => {
                    const d = v.replace(/[^0-9]/g, "").slice(0, 4);
                    setCardField("exp", d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                  }}
                  placeholder="MM/YY" placeholderTextColor={C.slate500} keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalLabel}>CVC</Text>
                <TextInput style={s.modalInput} value={cardForm.cvc}
                  onChangeText={v => setCardField("cvc", v.replace(/[^0-9]/g, "").slice(0, 4))}
                  placeholder="123" placeholderTextColor={C.slate500} keyboardType="number-pad" secureTextEntry />
              </View>
            </View>

            <TouchableOpacity style={[s.modalBtn, addingCard && s.stripeBtnDisabled]} onPress={submitCard} disabled={addingCard}>
              {addingCard ? <ActivityIndicator color={C.ink} /> : <Text style={s.modalBtnText}>Add Debit Card</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.bg },
  scroll:             { flex: 1 },
  center:             { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  header:             { padding: 24, paddingBottom: 12 },
  title:              { color: C.text, fontSize: 28, fontWeight: "900" },
  statsCol:           { padding: 16, gap: 10 },
  bigStat:            { backgroundColor: C.surface, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.line },
  bigLabel:           { color: C.textMuted, fontSize: 14, fontWeight: "600" },
  bigValue:           { color: C.emerald, fontSize: 44, fontWeight: "900", marginTop: 4 },
  statsRow:           { flexDirection: "row", gap: 10 },
  statCard:           { backgroundColor: C.surface, borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statLabel:          { color: C.textMuted, fontSize: 12 },
  statValue:          { fontSize: 24, fontWeight: "900", marginTop: 4 },
  card:               { margin: 16, backgroundColor: C.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.line },
  cardTitle:          { color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 14 },
  stripeSetup:        { gap: 14 },
  stripeSetupText:    { color: C.textMuted, fontSize: 14, lineHeight: 20 },
  stripeBtn:          { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  stripeBtnDisabled:  { opacity: 0.5 },
  stripeBtnText:      { color: C.ink, fontWeight: "800", fontSize: 15 },
  infoRow:            { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  infoChip:           { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  infoChipText:       { fontSize: 12, fontWeight: "600" },
  methodSection:      { marginBottom: 14 },
  sectionHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  methodSectionLabel: { color: C.slate500, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  addBtn:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.08)" },
  addBtnText:         { color: C.sky, fontSize: 12, fontWeight: "700" },
  emptyLine:          { color: C.textMuted, fontSize: 13, paddingVertical: 6 },
  methodRow:          { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  methodIcon:         { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  methodInfo:         { flex: 1 },
  methodName:         { color: C.text, fontWeight: "700", fontSize: 14 },
  methodSub:          { color: C.textMuted, fontSize: 11, marginTop: 1 },
  defaultBadge:       { backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeText:   { color: C.emerald, fontSize: 10, fontWeight: "700" },
  linkBtn:            { paddingHorizontal: 8, paddingVertical: 4 },
  linkBtnText:        { color: C.sky, fontSize: 11, fontWeight: "700" },
  removeBtn:          { paddingHorizontal: 8, paddingVertical: 4, minWidth: 54, alignItems: "center" },
  removeBtnText:      { color: C.red, fontSize: 11, fontWeight: "700" },
  webLink:            { marginTop: 6, paddingVertical: 8 },
  webLinkText:        { color: C.textMuted, fontSize: 12, textDecorationLine: "underline" },
  emptyMethodsText:   { color: C.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  // Modal
  modalWrap:          { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:          { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, borderWidth: 1, borderColor: C.line },
  modalHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle:         { color: C.text, fontSize: 20, fontWeight: "900" },
  modalClose:         { color: C.textMuted, fontSize: 20, fontWeight: "700", padding: 4 },
  modalSub:           { color: C.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  modalLabel:         { color: C.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  modalInput:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  modalRow:           { flexDirection: "row", gap: 12 },
  modalBtn:           { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  modalBtnText:       { color: C.ink, fontWeight: "800", fontSize: 16 },
});
