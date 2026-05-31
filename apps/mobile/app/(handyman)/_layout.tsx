import { Stack } from "expo-router";
import { C } from "@/constants/colors";

export default function HandymanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ink } }} />
  );
}
