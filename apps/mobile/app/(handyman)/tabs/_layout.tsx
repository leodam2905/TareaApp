import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";

export default function HandymanTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1E293B",
          borderTopColor: "rgba(255,255,255,0.08)",
          paddingBottom: 0,
          paddingTop: 6,
          height: 54,
        },
        tabBarActiveTintColor: colors.skyBlue,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="find-jobs"
        options={{ title: "Find Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{ title: "My Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: "Calendar", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: "Services", tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
