import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

interface Message {
  id: string; content: string; createdAt: string;
  sender: { id: string; name: string };
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const res = await api.get(`/bookings/${id}/messages`);
    setMessages(res.data);
  }, [id]);

  useEffect(() => {
    const init = async () => {
      const userStr = await SecureStore.getItemAsync("tarea_user");
      if (userStr) setMyId(JSON.parse(userStr).id);
      await load();
      setLoading(false);
    };
    init();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await api.post(`/bookings/${id}/messages`, { content });
      setMessages(prev => [...prev, res.data]);
    } catch { /**/ }
    setSending(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Chat</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello!</Text>}
        renderItem={({ item: msg }) => {
          const isMine = msg.sender.id === myId;
          return (
            <View style={[styles.msgRow, isMine && styles.msgRowRight]}>
              {!isMine && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{msg.sender.name[0]}</Text>
                </View>
              )}
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                {!isMine && <Text style={styles.senderName}>{msg.sender.name}</Text>}
                <Text style={[styles.msgText, isMine && { color: colors.ink }]}>{msg.content}</Text>
                <Text style={[styles.msgTime, isMine && { color: colors.ink + "80" }]}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor={colors.inkSubtle}
          multiline
          maxLength={1000}
        />
        <Pressable style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          onPress={send} disabled={!input.trim() || sending}>
          <Ionicons name="send" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.lg },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: 20 },
  empty: { color: colors.inkSubtle, textAlign: "center", paddingTop: 60 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  msgRowRight: { flexDirection: "row-reverse" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.skyBlue + "30", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatarText: { color: colors.skyBlue, fontWeight: "700", fontSize: 11 },
  bubble: { maxWidth: "72%", borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 3 },
  bubbleMine: { backgroundColor: colors.skyBlue, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.cardBorder },
  senderName: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  msgText: { color: colors.white, fontSize: fontSize.sm, lineHeight: 20 },
  msgTime: { color: "rgba(255,255,255,0.5)", fontSize: 10, alignSelf: "flex-end" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  textInput: { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.white, fontSize: fontSize.sm, maxHeight: 100, borderWidth: 1, borderColor: colors.cardBorder },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.skyBlue, alignItems: "center", justifyContent: "center" },
});
