import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import { dismissNoticeLocally, setActiveNotice } from "@/store/slices/noticesSlice";
import { updateUser } from "@/store/slices/userSlice";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function GlobalNoticeModal() {
  const dispatch = useAppDispatch();
  const { primaryColor, primarySoftColor, mutedIconColor } = useAppTheme();
  const { list, activeNoticeId } = useAppSelector((s) => s.notices);
  const user = useAppSelector((s) => s.user.data);
  const [isDismissing, setIsDismissing] = useState(false);

  const notice = useMemo(
    () => list.find((item) => item._id === activeNoticeId) ?? null,
    [activeNoticeId, list],
  );

  async function handleDismiss() {
    if (!notice || isDismissing) return;

    setIsDismissing(true);
    try {
      await api.post(`/notices/${notice._id}/dismiss`);
      dispatch(dismissNoticeLocally(notice._id));
      dispatch(
        updateUser({
          seenNotices: [...(user?.seenNotices ?? []), notice._id],
        }),
      );
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Unable to dismiss notice.",
      });
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <Modal
      visible={Boolean(notice)}
      transparent
      animationType="fade"
      onRequestClose={() => dispatch(setActiveNotice(null))}
    >
      <View className="flex-1 justify-end bg-black/45 px-4 pb-6">
        <View className="max-h-[72%] overflow-hidden rounded-[28px] border border-border bg-card">
          <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Ionicons name="megaphone-outline" size={22} color={primaryColor} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {notice?.type ?? "Notice"}
              </Text>
              <Text className="text-lg font-bold text-card-foreground" numberOfLines={2}>
                {notice?.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => dispatch(setActiveNotice(null))}
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={19} color={mutedIconColor} />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
            <Text className="text-[15px] leading-7 text-card-foreground">
              {notice ? stripHtml(notice.body) : ""}
            </Text>
          </ScrollView>

          <View className="gap-3 border-t border-border p-5">
            <TouchableOpacity
              onPress={handleDismiss}
              disabled={isDismissing}
              className="items-center justify-center rounded-full"
              style={{ backgroundColor: primaryColor, height: 52 }}
              activeOpacity={0.85}
            >
              {isDismissing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">Mark as seen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
