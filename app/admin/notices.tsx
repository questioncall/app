import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { startMobileUpload, startNoticeVideoUpload } from "@/lib/upload-manager";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type NoticeType = "GENERAL" | "ADVERTISEMENT" | "SPECIAL";
type Audience = "ALL" | "TEACHER" | "STUDENT" | "SPECIFIC";

type Notice = {
  _id: string;
  title: string;
  body?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  type: NoticeType;
  targetAudience: Audience;
  targetEmails?: string[];
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
};

const TYPES: NoticeType[] = ["GENERAL", "ADVERTISEMENT", "SPECIAL"];
const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TEACHER", label: "Teachers" },
  { key: "STUDENT", label: "Students" },
  { key: "SPECIFIC", label: "Specific" },
];

function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="rounded-full border px-3 py-1.5"
      style={{
        borderColor: active ? color : "transparent",
        backgroundColor: active ? `${color}1A` : "rgba(120,120,120,0.1)",
      }}
    >
      <Text
        className="text-[12px] font-semibold"
        style={{ color: active ? color : "#888" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminNoticesScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<Notice[]>(
    () => readCache<Notice[]>("notices") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("notices") === undefined);
  const [refreshing, setRefreshing] = useState(false);

  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NoticeType>("GENERAL");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [emails, setEmails] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sendPush, setSendPush] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/notices");
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      writeCache("notices", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load notices",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setType("GENERAL");
    setAudience("ALL");
    setEmails("");
    setIsActive(true);
    setSendPush(false);
    setImageUrl(null);
    setVideoUrl(null);
  };

  const pickImage = useCallback(async () => {
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
    setImageUploading(true);
    startMobileUpload({
      file: {
        uri: asset.uri,
        name: asset.fileName || `notice-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      },
      label: "Notice image",
      fileType: "image",
      folder: "notices",
      onComplete: (url: string) => {
        setImageUrl(url);
        setImageUploading(false);
        Toast.show({ type: "success", text1: "Image attached", position: "bottom" });
      },
      onError: (error: string) => {
        setImageUploading(false);
        Toast.show({
          type: "error",
          text1: "Image upload failed",
          text2: error,
          position: "bottom",
        });
      },
    });
  }, []);

  const pickVideo = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setVideoUploading(true);
    Toast.show({
      type: "info",
      text1: "Uploading video…",
      text2: "Processing continues in the background.",
      position: "bottom",
    });
    startNoticeVideoUpload({
      title: title.trim() || "Notice video",
      file: {
        uri: asset.uri,
        name: asset.name || `notice-${Date.now()}.mp4`,
        mimeType: asset.mimeType || "video/mp4",
        size: asset.size,
      },
      onReady: (playbackUrl: string) => {
        setVideoUrl(playbackUrl);
        setVideoUploading(false);
        Toast.show({ type: "success", text1: "Video ready", position: "bottom" });
      },
      onError: (error: string) => {
        setVideoUploading(false);
        Toast.show({
          type: "error",
          text1: "Video upload failed",
          text2: error,
          position: "bottom",
        });
      },
    });
  }, [title]);

  const submitCreate = useCallback(async () => {
    if (!title.trim()) {
      Toast.show({ type: "error", text1: "Title is required", position: "bottom" });
      return;
    }
    if (!body.trim() && !imageUrl && !videoUrl) {
      Toast.show({
        type: "error",
        text1: "Add a message, image, or video",
        position: "bottom",
      });
      return;
    }
    if (imageUploading || videoUploading) {
      Toast.show({
        type: "error",
        text1: "Wait for the upload to finish",
        position: "bottom",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        targetAudience: audience,
        targetEmails:
          audience === "SPECIFIC"
            ? emails
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean)
            : [],
        imageUrl,
        videoUrl,
        isActive,
        sendPush,
      };
      const res = await api.post("/mobile/admin/notices", payload);
      setItems((prev) => [res.data, ...prev]);
      Toast.show({ type: "success", text1: "Notice created", position: "bottom" });
      setCreating(false);
      resetForm();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to create notice",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    body,
    type,
    audience,
    emails,
    imageUrl,
    videoUrl,
    imageUploading,
    videoUploading,
    isActive,
    sendPush,
  ]);

  const toggleActive = useCallback(async (notice: Notice) => {
    const next = !notice.isActive;
    setItems((prev) =>
      prev.map((n) => (n._id === notice._id ? { ...n, isActive: next } : n)),
    );
    try {
      await api.patch(`/mobile/admin/notices/${notice._id}`, { isActive: next });
    } catch (err) {
      setItems((prev) =>
        prev.map((n) => (n._id === notice._id ? { ...n, isActive: !next } : n)),
      );
      Toast.show({
        type: "error",
        text1: "Failed to update",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    }
  }, []);

  const deleteNotice = useCallback((notice: Notice) => {
    Alert.alert("Delete notice?", `"${notice.title}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/mobile/admin/notices/${notice._id}`);
            setItems((prev) => prev.filter((n) => n._id !== notice._id));
            Toast.show({ type: "success", text1: "Notice deleted", position: "bottom" });
          } catch (err) {
            Toast.show({
              type: "error",
              text1: "Failed to delete",
              text2: getRequestErrorMessage(err, "Please try again."),
              position: "bottom",
            });
          }
        },
      },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Notice }) => (
      <View className="mb-3 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[15px] font-semibold text-foreground">
              {item.title}
            </Text>
            {item.body ? (
              <Text
                className="mt-0.5 text-[13px] text-muted-foreground"
                numberOfLines={3}
              >
                {item.body}
              </Text>
            ) : null}
          </View>
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: item.isActive
                ? "rgba(16,185,129,0.12)"
                : "rgba(120,120,120,0.12)",
            }}
          >
            <Text
              className="text-[11px] font-bold"
              style={{ color: item.isActive ? "#10B981" : "#888" }}
            >
              {item.isActive ? "ACTIVE" : "HIDDEN"}
            </Text>
          </View>
        </View>

        <View className="mt-2 flex-row items-center gap-2">
          <View
            className="bg-muted/40 rounded-md px-2 py-0.5"
            style={{ backgroundColor: `${primaryColor}14` }}
          >
            <Text className="text-[11px] font-medium" style={{ color: primaryColor }}>
              {item.type}
            </Text>
          </View>
          <Text className="text-[11px] text-muted-foreground">
            {item.targetAudience === "SPECIFIC"
              ? `${item.targetEmails?.length ?? 0} emails`
              : item.targetAudience}
          </Text>
          {item.imageUrl ? (
            <Ionicons name="image" size={13} color={primaryColor} />
          ) : null}
          {item.videoUrl ? (
            <Ionicons name="videocam" size={13} color={primaryColor} />
          ) : null}
        </View>

        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={() => toggleActive(item)}
            activeOpacity={0.85}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-2.5"
          >
            <Ionicons
              name={item.isActive ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={iconColor}
            />
            <Text className="text-[13px] font-semibold text-foreground">
              {item.isActive ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteNotice(item)}
            activeOpacity={0.85}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
            style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text className="text-[13px] font-semibold" style={{ color: "#EF4444" }}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [iconColor, primaryColor, toggleActive, deleteNotice],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-[18px] font-bold tracking-tight text-foreground">
              Notices
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              resetForm();
              setCreating(true);
            }}
            activeOpacity={0.85}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text className="text-[12px] font-semibold text-white">New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="megaphone-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No notices yet.
              </Text>
            </View>
          }
        />
      )}

      {/* Create modal */}
      <Modal
        visible={creating}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setCreating(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card"
            style={{ maxHeight: "90%", paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
              <Text className="text-[17px] font-bold text-foreground">New notice</Text>
              <TouchableOpacity onPress={() => !submitting && setCreating(false)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="mb-1 ml-1 text-[12px] font-medium text-foreground">
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Notice title"
                placeholderTextColor="#6B7280"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
                Message
              </Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Notice message"
                placeholderTextColor="#6B7280"
                multiline
                className="min-h-[90px] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              {/* Media attachments */}
              <Text className="mb-2 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Attachments (optional)
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={imageUploading}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-border py-3"
                  style={imageUrl ? { backgroundColor: `${primaryColor}14` } : undefined}
                >
                  {imageUploading ? (
                    <ActivityIndicator color={primaryColor} />
                  ) : (
                    <>
                      <Ionicons
                        name={imageUrl ? "checkmark-circle" : "image-outline"}
                        size={18}
                        color={imageUrl ? primaryColor : iconColor}
                      />
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: imageUrl ? primaryColor : "#888" }}
                      >
                        {imageUrl ? "Image added" : "Add image"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickVideo}
                  disabled={videoUploading}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-border py-3"
                  style={videoUrl ? { backgroundColor: `${primaryColor}14` } : undefined}
                >
                  {videoUploading ? (
                    <ActivityIndicator color={primaryColor} />
                  ) : (
                    <>
                      <Ionicons
                        name={videoUrl ? "checkmark-circle" : "videocam-outline"}
                        size={18}
                        color={videoUrl ? primaryColor : iconColor}
                      />
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: videoUrl ? primaryColor : "#888" }}
                      >
                        {videoUrl ? "Video added" : "Add video"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              {imageUrl || videoUrl ? (
                <TouchableOpacity
                  onPress={() => {
                    setImageUrl(null);
                    setVideoUrl(null);
                  }}
                  activeOpacity={0.85}
                  className="mt-2 self-start"
                >
                  <Text className="text-[12px] font-medium" style={{ color: "#EF4444" }}>
                    Clear attachments
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text className="mb-2 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={type === t}
                    onPress={() => setType(t)}
                    color={primaryColor}
                  />
                ))}
              </View>

              <Text className="mb-2 ml-1 mt-4 text-[12px] font-medium text-foreground">
                Audience
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {AUDIENCES.map((a) => (
                  <Chip
                    key={a.key}
                    label={a.label}
                    active={audience === a.key}
                    onPress={() => setAudience(a.key)}
                    color={primaryColor}
                  />
                ))}
              </View>

              {audience === "SPECIFIC" ? (
                <>
                  <Text className="mb-1 ml-1 mt-4 text-[12px] font-medium text-foreground">
                    Emails (comma separated)
                  </Text>
                  <TextInput
                    value={emails}
                    onChangeText={setEmails}
                    placeholder="a@x.com, b@y.com"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="none"
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
                  />
                </>
              ) : null}

              <View className="mt-5 flex-row items-center justify-between">
                <Text className="text-[14px] font-medium text-foreground">Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ true: primaryColor }}
                />
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[14px] font-medium text-foreground">Send push</Text>
                <Switch
                  value={sendPush}
                  onValueChange={setSendPush}
                  trackColor={{ true: primaryColor }}
                />
              </View>

              <TouchableOpacity
                onPress={submitCreate}
                disabled={submitting}
                activeOpacity={0.85}
                className="mt-6 items-center rounded-full py-4"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[15px] font-semibold text-white">
                    Create notice
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
