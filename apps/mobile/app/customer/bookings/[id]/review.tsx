import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "@/constants/Colors";
import api from "@/constants/api";

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (rating === 0) {
      Alert.alert("Select a rating", "Please tap a star before submitting.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/reviews", { bookingId: id, rating, comment: comment.trim() || undefined });
      Alert.alert("Thank you!", "Your review has been submitted.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Leave a Review</Text>
        <Text style={styles.subtitle}>How did your handyman do?</Text>

        {/* Star rating */}
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable key={n} onPress={() => setRating(n)} style={styles.star}>
              <Text style={[styles.starText, { color: n <= rating ? "#F59E0B" : colors.cardBorder }]}>
                ★
              </Text>
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
          </Text>
        )}

        {/* Comment */}
        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Share details about your experience..."
          placeholderTextColor={colors.inkSubtle}
          multiline
          numberOfLines={5}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>

        <Pressable
          style={[styles.btn, (loading || rating === 0) && styles.btnDisabled]}
          onPress={submit}
          disabled={loading || rating === 0}
        >
          {loading
            ? <ActivityIndicator color={colors.ink} />
            : <Text style={styles.btnText}>Submit Review</Text>
          }
        </Pressable>

        <Pressable style={styles.skip} onPress={() => router.back()}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  title: { fontSize: fontSize["3xl"], fontWeight: "800", color: colors.white, textAlign: "center", marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.base, color: colors.inkSubtle, textAlign: "center", marginBottom: spacing.xl },
  stars: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.sm },
  star: { padding: spacing.xs },
  starText: { fontSize: 48 },
  ratingLabel: { textAlign: "center", fontSize: fontSize.lg, fontWeight: "700", color: "#F59E0B", marginBottom: spacing.xl },
  label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.inkSubtle, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radius.lg, padding: spacing.md, color: colors.white,
    fontSize: fontSize.base, minHeight: 120,
  },
  charCount: { fontSize: fontSize.xs, color: colors.inkSubtle, textAlign: "right", marginTop: spacing.xs, marginBottom: spacing.xl },
  btn: {
    backgroundColor: colors.skyBlue, borderRadius: radius.xl,
    paddingVertical: spacing.md, alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.base },
  skip: { marginTop: spacing.md, alignItems: "center" },
  skipText: { color: colors.inkSubtle, fontSize: fontSize.sm },
});
