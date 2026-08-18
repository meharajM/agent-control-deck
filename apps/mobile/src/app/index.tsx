import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { connectToBridge } from "../services/bridge-connection";
import { loadSavedBridgeConnection } from "../services/bridge-preferences";
import { createMobileCrypto } from "../services/mobile-crypto";
import { useConnectionStore } from "../store/connection-store";

export default function Index() {
  const [ready, setReady] = useState(false);
  const setPairingStatus = useConnectionStore((state) => state.setPairingStatus);

  useEffect(() => {
    let active = true;
    void loadSavedBridgeConnection().then((saved) => {
      if (!active) return;
      if (saved) {
        setPairingStatus("pairing");
        connectToBridge(saved.url, { ...saved, crypto: createMobileCrypto() });
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [setPairingStatus]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="Loading saved bridge connection" />
      </View>
    );
  }

  return <Redirect href="/(tabs)" />;
}
