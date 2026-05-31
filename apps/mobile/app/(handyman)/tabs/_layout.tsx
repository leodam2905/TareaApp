import { Tabs } from "expo-router";
import { C } from "@/constants/colors";
import { View, Text } from "react-native";
import { usePushNotifications } from "@/lib/usePushNotifications";

function Icon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 2, paddingTop: 6 }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ fontSize: 9, color: focused ? C.sky : C.slate500, fontWeight: focused ? "700" : "400" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function HandymanTabs() {
  usePushNotifications();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "rgba(255,255,255,0.08)", height: 110 },
      tabBarItemStyle: { paddingBottom: 55 },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="dashboard"     options={{ tabBarIcon: ({ focused }) => <Icon emoji="🏠" label="Home" focused={focused} /> }} />
      <Tabs.Screen name="find-jobs"     options={{ tabBarIcon: ({ focused }) => <Icon emoji="🔍" label="Find Jobs" focused={focused} /> }} />
      <Tabs.Screen name="jobs"          options={{ tabBarIcon: ({ focused }) => <Icon emoji="📋" label="My Jobs" focused={focused} /> }} />
      <Tabs.Screen name="earnings"      options={{ tabBarIcon: ({ focused }) => <Icon emoji="💰" label="Earnings" focused={focused} /> }} />
      <Tabs.Screen name="notifications" options={{ tabBarIcon: ({ focused }) => <Icon emoji="🔔" label="Alerts" focused={focused} /> }} />
      <Tabs.Screen name="profile"       options={{ href: null }} />
    </Tabs>
  );
}
