import { Tabs } from "expo-router";
import { C } from "@/constants/colors";
import { View, Text } from "react-native";
import { usePushNotifications } from "@/lib/usePushNotifications";

function Icon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 3, marginBottom: 8 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, color: focused ? C.sky : C.slate500, fontWeight: focused ? "700" : "400" }} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </View>
  );
}

export default function CustomerTabs() {
  usePushNotifications();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "rgba(255,255,255,0.08)", height: 80, paddingBottom: 10, paddingTop: 8 },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="dashboard"     options={{ tabBarIcon: ({ focused }) => <Icon emoji="🏠" label="Home"         focused={focused} /> }} />
      <Tabs.Screen name="bookings"      options={{ tabBarIcon: ({ focused }) => <Icon emoji="📊" label="Dashboard"   focused={focused} /> }} />
      <Tabs.Screen name="favorites"     options={{ tabBarIcon: ({ focused }) => <Icon emoji="❤️" label="Favorite"    focused={focused} /> }} />
      <Tabs.Screen name="refer-earn"    options={{ tabBarIcon: ({ focused }) => <Icon emoji="🎁" label="Refer & Earn" focused={focused} /> }} />
      <Tabs.Screen name="browse"        options={{ href: null }} />
      <Tabs.Screen name="post-job"      options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="spending"      options={{ href: null }} />
      <Tabs.Screen name="profile"       options={{ href: null }} />
    </Tabs>
  );
}
