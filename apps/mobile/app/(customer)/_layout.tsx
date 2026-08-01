import { Stack } from "expo-router";
import { C } from "@/constants/colors";

export default function CustomerLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />;
}
