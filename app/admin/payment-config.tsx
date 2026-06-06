import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { startMobileUpload } from "@/lib/upload-manager";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  const { primaryColor } = useAppTheme();
  return (
    <View className="mt-5">
      <Text className="mb-2 ml-1 text-[13px] font-semibold text-foreground">{label}</Text>
      {values.map((value, index) => (
        <View key={index} className="mb-2 flex-row items-center gap-2">
          <TextInput
            value={value}
            onChangeText={(text) => {
              const next = [...values];
              next[index] = text;
              onChange(next);
            }}
            placeholder={placeholder}
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            keyboardType={keyboardType ?? "default"}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />
          <TouchableOpacity
            onPress={() => onChange(values.filter((_, i) => i !== index))}
            className="h-10 w-10 items-center justify-center rounded-full border border-border"
            activeOpacity={0.85}
          >
            <Ionicons name="remove" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => onChange([...values, ""])}
        activeOpacity={0.85}
        className="mt-1 flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
      >
        <Ionicons name="add" size={16} color={primaryColor} />
        <Text className="text-[12px] font-semibold" style={{ color: primaryColor }}>
          Add
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminPaymentConfigScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const seed = readCache<Record<string, any>>("config");
  const [loading, setLoading] = useState(() => seed === undefined);
  const [saving, setSaving] = useState(false);
  const [recipientName, setRecipientName] = useState(
    () => seed?.manualPaymentRecipientName || "",
  );
  const [esewaNumber, setEsewaNumber] = useState(
    () => seed?.manualPaymentEsewaNumber || "",
  );
  const [qrUrl, setQrUrl] = useState<string | null>(
    () => seed?.manualPaymentQrCodeUrl || null,
  );
  const [qrUploading, setQrUploading] = useState(false);
  const [phones, setPhones] = useState<string[]>(() =>
    Array.isArray(seed?.customerServicePhoneNumbers)
      ? seed.customerServicePhoneNumbers
      : [],
  );
  const [emails, setEmails] = useState<string[]>(() =>
    Array.isArray(seed?.customerServiceEmails) ? seed.customerServiceEmails : [],
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/config");
      const d = res.data ?? {};
      writeCache("config", d);
      setRecipientName(d.manualPaymentRecipientName || "");
      setEsewaNumber(d.manualPaymentEsewaNumber || "");
      setQrUrl(d.manualPaymentQrCodeUrl || null);
      setPhones(
        Array.isArray(d.customerServicePhoneNumbers) ? d.customerServicePhoneNumbers : [],
      );
      setEmails(Array.isArray(d.customerServiceEmails) ? d.customerServiceEmails : []);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load config",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!recipientName.trim() || !esewaNumber.trim()) {
      Toast.show({
        type: "error",
        text1: "Recipient name and eSewa number are required",
        position: "bottom",
      });
      return;
    }
    setSaving(true);
    try {
      await api.put("/mobile/admin/config", {
        manualPaymentRecipientName: recipientName.trim(),
        manualPaymentEsewaNumber: esewaNumber.trim(),
        customerServicePhoneNumbers: phones.map((p) => p.trim()).filter(Boolean),
        customerServiceEmails: emails.map((e) => e.trim()).filter(Boolean),
      });
      Toast.show({ type: "success", text1: "Payment config saved", position: "bottom" });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to save",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSaving(false);
    }
  }, [recipientName, esewaNumber, phones, emails]);

  const replaceQr = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: "error", text1: "Photo permission needed", position: "bottom" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setQrUploading(true);
    startMobileUpload({
      file: {
        uri: asset.uri,
        name: asset.fileName || `qr-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      },
      label: "Payment QR",
      fileType: "image",
      folder: "config",
      onComplete: async (url: string) => {
        try {
          await api.put("/mobile/admin/config", { manualPaymentQrCodeUrl: url });
          setQrUrl(url);
          Toast.show({ type: "success", text1: "QR updated", position: "bottom" });
        } catch (err) {
          Toast.show({
            type: "error",
            text1: "Failed to save QR",
            text2: getRequestErrorMessage(err, "Please try again."),
            position: "bottom",
          });
        } finally {
          setQrUploading(false);
        }
      },
      onError: (error: string) => {
        setQrUploading(false);
        Toast.show({
          type: "error",
          text1: "Upload failed",
          text2: error,
          position: "bottom",
        });
      },
    });
  }, []);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <Text className="text-[18px] font-bold tracking-tight text-foreground">
            Payment Config
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 32, 40),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-1 ml-1 text-[13px] font-semibold text-foreground">
            Recipient name
          </Text>
          <TextInput
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Recipient name"
            placeholderTextColor="#6B7280"
            className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />

          <Text className="mb-1 ml-1 mt-4 text-[13px] font-semibold text-foreground">
            eSewa number
          </Text>
          <TextInput
            value={esewaNumber}
            onChangeText={setEsewaNumber}
            placeholder="98XXXXXXXX"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
            className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />

          {/* QR (read-only on mobile) */}
          <Text className="mb-2 ml-1 mt-4 text-[13px] font-semibold text-foreground">
            Payment QR
          </Text>
          <View className="items-center rounded-2xl border border-border bg-card p-4">
            {qrUrl ? (
              <Image
                source={{ uri: qrUrl }}
                style={{ width: 160, height: 160, borderRadius: 12 }}
                resizeMode="contain"
              />
            ) : (
              <View className="bg-muted/30 h-40 w-40 items-center justify-center rounded-xl">
                <Ionicons name="qr-code-outline" size={48} color="#9CA3AF" />
              </View>
            )}
            <TouchableOpacity
              onPress={replaceQr}
              disabled={qrUploading}
              activeOpacity={0.85}
              className="mt-3 flex-row items-center gap-1.5 rounded-full border border-border px-4 py-2"
            >
              {qrUploading ? (
                <ActivityIndicator color={primaryColor} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color={primaryColor} />
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: primaryColor }}
                  >
                    {qrUrl ? "Replace QR" : "Upload QR"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <StringListEditor
            label="Customer service phone numbers"
            values={phones}
            onChange={setPhones}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
          />

          <StringListEditor
            label="Customer service emails"
            values={emails}
            onChange={setEmails}
            placeholder="support@example.com"
            keyboardType="email-address"
          />

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            className="mt-7 items-center rounded-full py-4"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-semibold text-white">Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
