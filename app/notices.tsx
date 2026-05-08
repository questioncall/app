import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  AppNotice,
  dismissNoticeLocally,
  setNotices,
  setNoticesError,
  setNoticesLoading,
  setNoticesRefreshing,
} from "@/store/slices/noticesSlice";
import { updateUser } from "@/store/slices/userSlice";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NoticesScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const notices = useAppSelector((s) => s.notices);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const loadNotices = useCallback(
    async (refresh = false) => {
      if (!user?._id) return;

      dispatch(refresh ? setNoticesRefreshing(true) : setNoticesLoading(true));
      try {
        const res = await api.get("/notices");
        dispatch(
          setNotices({
            notices: Array.isArray(res.data) ? res.data : [],
            userId: user._id,
            activateModal: false,
          }),
        );
      } catch (err: any) {
        dispatch(
          setNoticesError(err?.response?.data?.error ?? "Unable to load notices."),
        );
      }
    },
    [dispatch, user?._id],
  );

  useEffect(() => {
    if (notices.loadedForUserId !== user?._id) {
      void loadNotices();
    }
  }, [loadNotices, notices.loadedForUserId, user?._id]);

  async function dismissNotice(notice: AppNotice) {
    setDismissingId(notice._id);
    try {
      await api.post(`/notices/${notice._id}/dismiss`);
      dispatch(dismissNoticeLocally(notice._id));
      dispatch(
        updateUser({
          seenNotices: [...(user?.seenNotices ?? []), notice._id],
        }),
      );
      Toast.show({ type: "success", text1: "Notice marked as seen." });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Unable to dismiss notice.",
      });
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={notices.isRefreshing}
            onRefresh={() => void loadNotices(true)}
            tintColor={iconColor}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-14">
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">Notices</Text>
            <TouchableOpacity
              onPress={() => void loadNotices(true)}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color={iconColor} />
            </TouchableOpacity>
          </View>

          <View
            className="mb-5 rounded-[28px] border border-border p-5"
            style={{ backgroundColor: primarySoftColor }}
          >
            <Text className="text-[28px] font-bold text-foreground">Admin updates</Text>
            <Text className="mt-2 text-sm leading-6 text-muted-foreground">
              New account, payment, and platform messages from the QuestionCall team.
            </Text>
          </View>

          {notices.error ? (
            <View className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <Text className="text-sm font-medium text-red-600 dark:text-red-300">
                {notices.error}
              </Text>
            </View>
          ) : null}

          {notices.isLoading ? (
            <View className="h-72 items-center justify-center">
              <ActivityIndicator color={iconColor} size="large" />
            </View>
          ) : notices.list.length === 0 ? (
            <View className="items-center rounded-[28px] border border-border bg-card px-6 py-14">
              <View
                className="mb-4 h-16 w-16 items-center justify-center rounded-3xl"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Ionicons name="checkmark-done-outline" size={34} color={primaryColor} />
              </View>
              <Text className="text-center text-lg font-bold text-card-foreground">
                You are all caught up
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">
                Unseen notices will appear here and as a foreground modal.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {notices.list.map((notice) => (
                <View
                  key={notice._id}
                  className="rounded-[24px] border border-border bg-card p-5"
                >
                  <View className="mb-3 flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: primarySoftColor }}
                    >
                      <Ionicons
                        name={
                          notice.type === "SPECIAL"
                            ? "sparkles-outline"
                            : notice.type === "ADVERTISEMENT"
                              ? "pricetag-outline"
                              : "megaphone-outline"
                        }
                        size={20}
                        color={primaryColor}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {notice.type}
                      </Text>
                      <Text className="text-lg font-bold text-card-foreground">
                        {notice.title}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm leading-6 text-muted-foreground">
                    {stripHtml(notice.body)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => dismissNotice(notice)}
                    disabled={dismissingId === notice._id}
                    className="mt-4 flex-row items-center justify-center rounded-full py-3"
                    style={{ backgroundColor: primaryColor }}
                    activeOpacity={0.85}
                  >
                    {dismissingId === notice._id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                        <Text className="ml-2 text-sm font-bold text-white">
                          Mark as seen
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
