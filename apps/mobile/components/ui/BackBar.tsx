import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { C } from "@/constants/colors";

/** Reusable back link for pushed screens (stacks have headerShown:false). */
export default function BackBar({ fallback = "/(handyman)/tabs/dashboard" }: { fallback?: string }) {
  const router = useRouter();
  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };
  return (
    <TouchableOpacity style={s.wrap} onPress={onBack} hitSlop={12}>
      <Text style={s.txt}>← Back</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, alignSelf: "flex-start" },
  txt: { color: C.sky, fontSize: 16, fontWeight: "600" },
});
