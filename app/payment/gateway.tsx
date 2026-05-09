import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

const ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

export default function GatewayScreen() {
  const { planSlug, courseId, mode } = useLocalSearchParams<{
    planSlug?: string;
    courseId?: string;
    mode?: "subscription" | "course";
  }>();

  const { statusBarStyle, backgroundColor, primaryColor, mutedIconColor } = useAppTheme();

  const webViewRef = useRef<WebView>(null);
  const [isInitiating, setIsInitiating] = useState(true);
  const [formHtml, setFormHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasVerified = useRef(false);

  const initiate = useCallback(async () => {
    setIsInitiating(true);
    setError(null);
    try {
      const endpoint =
        mode === "course" && courseId
          ? `/courses/${courseId}/purchase/esewa-initiate`
          : "/payments/esewa/initiate";

      const body = mode === "course" && courseId ? { courseId } : { planSlug };

      const res = await api.post(endpoint, body);
      const d = res.data;

      const html = `
        <!DOCTYPE html>
        <html><body onload="document.getElementById('f').submit()">
          <form id="f" action="${ESEWA_FORM_URL}" method="POST">
            <input name="amount" value="${d.amount}" />
            <input name="tax_amount" value="${d.tax_amount}" />
            <input name="product_service_charge" value="${d.product_service_charge}" />
            <input name="product_delivery_charge" value="${d.product_delivery_charge}" />
            <input name="total_amount" value="${d.total_amount}" />
            <input name="transaction_uuid" value="${d.transaction_uuid}" />
            <input name="product_code" value="${d.product_code}" />
            <input name="success_url" value="${d.success_url}" />
            <input name="failure_url" value="${d.failure_url}" />
            <input name="signed_field_names" value="${d.signed_field_names}" />
            <input name="signature" value="${d.signature}" />
          </form>
          <p style="text-align:center;margin-top:40%;font-family:sans-serif;color:#888;">
            Redirecting to eSewa...
          </p>
        </body></html>
      `;
      setFormHtml(html);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to initiate payment. Try again.");
    } finally {
      setIsInitiating(false);
    }
  }, [mode, courseId, planSlug]);

  useState(() => {
    void initiate();
  });

  const handleNavigationChange = useCallback(
    async (url: string) => {
      if (hasVerified.current) return;

      // eSewa redirects back with ?data=<base64> on success
      if (url.includes("data=")) {
        hasVerified.current = true;

        const match = url.match(/[?&]data=([^&]+)/);
        if (!match?.[1]) {
          Toast.show({ type: "error", text1: "Payment verification failed" });
          router.back();
          return;
        }

        const encodedData = decodeURIComponent(match[1]);

        try {
          const verifyEndpoint =
            mode === "course"
              ? "/payments/esewa/course-verify"
              : "/payments/esewa/verify";

          const res = await api.post(verifyEndpoint, { encodedData });

          if (res.data.success) {
            Toast.show({
              type: "success",
              text1: "Payment Successful",
              text2:
                mode === "course"
                  ? "Course unlocked! Happy learning."
                  : `${res.data.planSlug ?? "Plan"} activated!`,
            });
          }
        } catch (err: any) {
          Toast.show({
            type: "error",
            text1: "Verification Failed",
            text2:
              err?.response?.data?.error ??
              "Payment may have succeeded. Contact support if charged.",
          });
        }
        router.back();
        return;
      }

      // Failure redirect
      if (
        url.includes("payment/failure") ||
        url.includes("payment-failure") ||
        url.includes("status=failure")
      ) {
        hasVerified.current = true;
        Toast.show({
          type: "error",
          text1: "Payment Cancelled",
          text2: "No amount was charged.",
        });
        router.back();
      }
    },
    [mode],
  );

  if (isInitiating) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={primaryColor} />
        <Text className="mt-4 text-base text-muted-foreground">
          Connecting to eSewa...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-center text-base text-foreground">{error}</Text>
        <TouchableOpacity
          onPress={() => void initiate()}
          className="mt-4 rounded-full px-6 py-2.5"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-semibold text-white">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-3">
          <Text className="text-sm text-muted-foreground">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-foreground">eSewa Payment</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={mutedIconColor} />
        </TouchableOpacity>
      </View>

      {formHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: formHtml }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onNavigationStateChange={(navState) => {
            if (navState.url) void handleNavigationChange(navState.url);
          }}
          startInLoadingState
          renderLoading={() => (
            <View className="absolute inset-0 items-center justify-center bg-background">
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
