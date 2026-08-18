import { Stack } from "expo-router";

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Deck",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sessions" options={{ title: "Session history" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
    </Stack>
  );
}
