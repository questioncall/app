import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePlatformConfig } from "@/hooks/use-platform-config";
import { api } from "@/lib/api";

export default function ManualPaymentScreen() {
  const { planSlug: paramPlan } = useLocalSearchParams<{ planSlug?: string }>();
  const user = useAppSelector((s) => s.user.data);
  const { config } = usePlatformConfig();
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const plans = config?.plans ?? [];
  const adminEsewa = config?.adminEsewaNumber ?? "";
  const qrCodeUrl = config?.manualPaymentQrCodeUrl ?? "";

  const [selectedPlan, setSelectedPlan] = useState(paramPlan ?? "");
  const [transactionId, setTransactionId] = useState("");
  const [transactorName, setTransactorName] = useState(user?.name ?? "");
  const [screenshot, setScreenshot] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plan = useMemo(
    () => plans.find((p) => p.slug === selectedPlan) ?? null,
    [plans, selectedPlan],
  );

  const canSubmit =
    selectedPlan.length > 0 &&
    transactionId.trim().length > 0 &&
    transactorName.trim().length > 0 &&
    !isSubmitting;

  const pickScreenshot = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setScreenshot(result.assets[0]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    Alert.alert(
      "Confirm Payment",
      `Submit payment for ${plan?.name ?? selectedPlan} plan (NPR ${plan?.price ?? "—"})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const formData = new FormData();
              formData.append("transactionId", transactionId.trim());
              formData.append("transactorName", transactorName.trim());
              formData.append("planSlug", selectedPlan);

              if (screenshot) {
                const uri = screenshot.uri;
                const ext = uri.split(".").pop() ?? "jpg";
                formData.append("screenshot", {
                  uri,
                  name: `payment-screenshot.${ext}`,
                  type: `image/${ext === "png" ? "png" : "jpeg"}`,
                } as any);
              }

              await api.post("/payments/manual", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 30000,
              });

              Toast.show({
                type: "success",
                text1: "Payment Submitted",
                text2: "We'll verify your payment shortly.",
              });

              router.back();
            } catch (err: any) {
              const status = err?.response?.status;
              const msg = err?.response?.data?.error ?? "Payment submission failed.";

              if (status === 409) {
                Toast.show({
                  type: "error",
                  text1: "Duplicate Transaction",
                  text2: msg,
                });
              } else {
                Toast.show({ type: "error", text1: "Error", text2: msg });
              }
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }, [canSubmit, plan, selectedPlan, transactionId, transactorName, screenshot]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Manual Payment</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Payment info */}
          <View
            className="rounded-2xl border p-4"
            style={{ borderColor, backgroundColor: cardColor }}
          >
            <View className="mb-3 flex-row items-center gap-2">
              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Text className="text-xs font-bold text-white">1</Text>
              </View>
              <Text className="text-base font-semibold text-foreground">
                Send Payment via eSewa
              </Text>
            </View>

            {adminEsewa ? (
              <View className="rounded-xl bg-secondary p-3">
                <Text className="text-xs text-muted-foreground">
                  Send to eSewa Number
                </Text>
                <Text className="mt-0.5 text-lg font-bold text-foreground" selectable>
                  {adminEsewa}
                </Text>
              </View>
            ) : null}

            {qrCodeUrl ? (
              <View className="mt-3 items-center">
                <Image
                  source={{ uri: qrCodeUrl }}
                  className="h-48 w-48 rounded-xl"
                  resizeMode="contain"
                />
                <Text className="mt-1 text-xs text-muted-foreground">Scan QR to pay</Text>
              </View>
            ) : null}

            {plan ? (
              <View className="mt-3 rounded-xl border p-3" style={{ borderColor }}>
                <Text className="text-xs text-muted-foreground">Amount to Pay</Text>
                <Text
                  className="mt-0.5 text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  NPR {plan.price}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {plan.name} Plan · {plan.maxQuestions} questions
                </Text>
              </View>
            ) : null}
          </View>

          {/* Step 2: Select plan */}
          <View
            className="rounded-2xl border p-4"
            style={{ borderColor, backgroundColor: cardColor }}
          >
            <View className="mb-3 flex-row items-center gap-2">
              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Text className="text-xs font-bold text-white">2</Text>
              </View>
              <Text className="text-base font-semibold text-foreground">Select Plan</Text>
            </View>

            <View className="gap-2">
              {plans.map((p) => (
                <TouchableOpacity
                  key={p.slug}
                  className="flex-row items-center rounded-xl border p-3"
                  style={{
                    borderColor: selectedPlan === p.slug ? primaryColor : borderColor,
                    backgroundColor:
                      selectedPlan === p.slug ? primarySoftColor : "transparent",
                  }}
                  onPress={() => setSelectedPlan(p.slug)}
                >
                  <Ionicons
                    name={
                      selectedPlan === p.slug ? "radio-button-on" : "radio-button-off"
                    }
                    size={20}
                    color={selectedPlan === p.slug ? primaryColor : mutedIconColor}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-foreground">
                      {p.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {p.maxQuestions} questions
                    </Text>
                  </View>
                  <Text className="font-bold" style={{ color: primaryColor }}>
                    NPR {p.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 3: Transaction details */}
          <View
            className="rounded-2xl border p-4"
            style={{ borderColor, backgroundColor: cardColor }}
          >
            <View className="mb-3 flex-row items-center gap-2">
              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Text className="text-xs font-bold text-white">3</Text>
              </View>
              <Text className="text-base font-semibold text-foreground">
                Enter Payment Details
              </Text>
            </View>

            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Transaction ID
            </Text>
            <TextInput
              className="mb-4 rounded-xl border px-4 py-3 text-base text-foreground"
              style={{ borderColor }}
              value={transactionId}
              onChangeText={setTransactionId}
              placeholder="From your eSewa receipt"
              placeholderTextColor={mutedIconColor}
            />

            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Your Name (as on eSewa)
            </Text>
            <TextInput
              className="mb-4 rounded-xl border px-4 py-3 text-base text-foreground"
              style={{ borderColor }}
              value={transactorName}
              onChangeText={setTransactorName}
              placeholder="Full name"
              placeholderTextColor={mutedIconColor}
            />

            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Payment Screenshot (optional)
            </Text>
            <TouchableOpacity
              onPress={pickScreenshot}
              className="items-center justify-center rounded-xl border border-dashed p-4"
              style={{ borderColor: mutedIconColor }}
            >
              {screenshot ? (
                <View className="items-center">
                  <Image
                    source={{ uri: screenshot.uri }}
                    className="mb-2 h-32 w-32 rounded-lg"
                    resizeMode="cover"
                  />
                  <Text className="text-xs text-muted-foreground">Tap to change</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="camera-outline" size={32} color={mutedIconColor} />
                  <Text className="mt-2 text-sm text-muted-foreground">
                    Tap to upload screenshot
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            className="items-center rounded-2xl py-4"
            style={{
              backgroundColor: canSubmit ? primaryColor : `${primaryColor}40`,
            }}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Submit Payment</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View className="rounded-2xl border p-4" style={{ borderColor }}>
            <Text className="mb-2 text-sm font-semibold text-foreground">Important</Text>
            <Text className="text-xs leading-5 text-muted-foreground">
              {"•"} Send the exact amount shown above to the eSewa number{"\n"}
              {"•"} Copy the transaction ID from your eSewa receipt{"\n"}
              {"•"} Admin will verify and activate your plan within 24 hours{"\n"}
              {"•"} If already submitted, updating the same transaction ID will update
              your existing request
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
