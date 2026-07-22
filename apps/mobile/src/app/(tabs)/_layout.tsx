import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarAccessibilityLabel: "Main navigation",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Attention" }}
      />
      <Tabs.Screen
        name="sessions"
        options={{ title: "Sessions" }}
      />
      <Tabs.Screen
        name="diagnostics"
        options={{ title: "Diagnostics" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}
