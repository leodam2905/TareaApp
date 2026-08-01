import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Message = {
  id: string; content: string; createdAt: string;
  sender: { id: string; name: string; role: string };
};

export default function ChatScreen() {
  const { bookingId, otherName } = useLocalSearchParams<{ bookingId: string; otherName: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId]         = useState<string | null>(null);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const res = await api.get(`/bookings/${bookingId}/messages`);
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    AsyncStorage.getItem("userId").then(id => setMyId(id));
    load();
    // Poll for new messages every 4s
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await api.post(`/bookings/${bookingId}/messages`, { content: text.trim() });
    if (res.ok) {
      setText("");
      await load();
    }
    setSending(false);
  };

  const renderMsg = ({ item: m }: { item: Message }) => {
    const mine = m.sender.id === myId;
    return (
      <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
        {!mine && <Text style={s.senderName}>{m.sender.name}</Text>}
        <Text style={[s.msgText, mine ? s.msgMine : s.msgTheirs]}>{m.content}</Text>
        <Text style={s.time}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
          <Text style={s.title}>{otherName}</Text>
          <View style={{ width: 60 }} />
        </View>

        {loading
          ? <View style={s.center}><ActivityIndicator color={C.sky} /></View>
          : messages.length === 0
            ? <View style={s.center}><Text style={s.empty}>No messages yet. Say hello!</Text></View>
            : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={m => m.id}
                renderItem={renderMsg}
                contentContainerStyle={s.list}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              />
            )
        }

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={"#94A3B8"}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && s.sendDisabled]} onPress={send} disabled={!text.trim() || sending}>
            <Text style={s.sendIcon}>{sending ? "…" : "↑"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#FFFFFF" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:       { color: "#94A3B8", fontSize: 14 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  back:        { color: C.sky, fontSize: 15, fontWeight: "600", width: 60 },
  title:       { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  list:        { padding: 16, gap: 8, paddingBottom: 8 },
  bubble:      { maxWidth: "80%", borderRadius: 16, padding: 12 },
  bubbleMine:  { alignSelf: "flex-end", backgroundColor: C.sky, borderBottomRightRadius: 4 },
  bubbleTheirs:{ alignSelf: "flex-start", backgroundColor: "#F1F5F9", borderBottomLeftRadius: 4 },
  senderName:  { color: C.sky, fontSize: 11, fontWeight: "700", marginBottom: 3 },
  msgText:     { fontSize: 15, lineHeight: 21 },
  msgMine:     { color: C.ink },
  msgTheirs:   { color: "#0F172A" },
  time:        { fontSize: 10, marginTop: 4, opacity: 0.6, alignSelf: "flex-end", color: C.ink },
  inputRow:    { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  input:       { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: "#0F172A", fontSize: 15, maxHeight: 120, borderWidth: 1, borderColor: "#E2E8F0" },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" },
  sendDisabled:{ opacity: 0.4 },
  sendIcon:    { color: C.ink, fontWeight: "900", fontSize: 18 },
});
