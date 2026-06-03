import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Landing route for the `questioncall://payment/return` deep link.
 *
 * In the normal flow `WebBrowser.openAuthSessionAsync` intercepts the deep link
 * and resolves in `openWebCheckout`, so this screen is rarely mounted. It exists
 * as a safety net for cold deep-link opens (e.g. the browser hands the link to
 * the OS instead of the custom tab): show a toast and return the user somewhere
 * sensible.
 */
export default function PaymentReturn() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const { backgroundColor, primaryColor } = useAppTheme();

  useEffect(() => {
    if (status === "success") {
      Toast.show({ type: "success", text1: "Payment complete" });
    } else if (status === "submitted") {
      Toast.show({
        type: "info",
        text1: "Payment submitted — pending review",
        text2: "We'll email you once your access is activated.",
      });
    } else {
      Toast.show({ type: "info", text1: "Checkout cancelled" });
    }
    router.replace("/(tabs)/menu");
  }, [status]);

  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor }}
    >
      <ActivityIndicator size="large" color={primaryColor} />
    </View>
  );
}
