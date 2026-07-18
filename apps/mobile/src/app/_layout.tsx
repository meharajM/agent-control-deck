import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sessions/index" options={{ title: "Sessions" }} />
        <Stack.Screen name="sessions/[id]" options={{ title: "Session" }} />
        <Stack.Screen name="approvals/[id]" options={{ title: "Approval" }} />
        <Stack.Screen
          name="(pairing)/index"
          options={{ title: "Pair a Host", presentation: "modal" }}
        />
      </Stack>
    </>
  );
}
