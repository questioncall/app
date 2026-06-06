import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { startMobileUpload, startNoticeVideoUpload } from "@/lib/upload-manager";
import {
  useAdminConfig,
  useHydrateFromConfig,
  type PlatformConfig,
} from "@/components/admin/config-form";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

type OnboardingVideo = {
  _id?: string;
  role: Role;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  isActive: boolean;
};

const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

const EMPTY: OnboardingVideo = {
  role: "STUDENT",
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  isActive: true,
};

/** Strip UI-only fields before persisting the array back to the config. */
function toPayload(videos: OnboardingVideo[]) {
  return videos.map((v) => ({
    ...(v._id ? { _id: v._id } : {}),
    role: v.role,
    title: v.title.trim(),
    description: (v.description ?? "").trim(),
    videoUrl: v.videoUrl.trim(),
    thumbnailUrl: (v.thumbnailUrl ?? "").trim(),
    isActive: v.isActive,
  }));
}

export default function AdminOnboardingVideosScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();
  const { config, loading, save, reload } = useAdminConfig();

  const [videos, setVideos] = useState<OnboardingVideo[]>([]);
  const [persisting, setPersisting] = useState(false);

  // editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<OnboardingVideo>(EMPTY);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);

  useHydrateFromConfig(
    config,
    useCallback((c: PlatformConfig) => {
      setVideos(
        Array.isArray(c.onboardingVideos)
          ? c.onboardingVideos.map((v: OnboardingVideo) => ({
              _id: v._id,
              role: v.role,
              title: v.title,
              description: v.description ?? "",
              videoUrl: v.videoUrl,
              thumbnailUrl: v.thumbnailUrl ?? "",
              isActive: v.isActive !== false,
            }))
          : [],
      );
    }, []),
  );

  const persist = useCallback(
    async (next: OnboardingVideo[]) => {
      const prev = videos;
      setVideos(next);
      setPersisting(true);
      const ok = await save({ onboardingVideos: toPayload(next) });
      setPersisting(false);
      if (!ok) {
        setVideos(prev);
        void reload();
      }
      return ok;
    },
    [videos, save, reload],
  );

  const openAdd = () => {
    setDraft(EMPTY);
    setEditIndex(null);
    setEditorOpen(true);
  };

  const openEdit = (index: number) => {
    setDraft(videos[index]);
    setEditIndex(index);
    setEditorOpen(true);
  };

  const submitDraft = useCallback(async () => {
    if (!draft.title.trim() || !draft.videoUrl.trim()) {
      Toast.show({
        type: "error",
        text1: "Title and video are required",
        position: "bottom",
      });
      return;
    }
    const next =
      editIndex === null
        ? [...videos, draft]
        : videos.map((v, i) => (i === editIndex ? draft : v));
    const ok = await persist(next);
    if (ok) setEditorOpen(false);
  }, [draft, editIndex, videos, persist]);

  const removeAt = (index: number) => {
    Alert.alert("Delete video?", "This onboarding video will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void persist(videos.filter((_, i) => i !== index)),
      },
    ]);
  };

  const toggleActive = (index: number) =>
    void persist(
      videos.map((v, i) => (i === index ? { ...v, isActive: !v.isActive } : v)),
    );

  const pickVideo = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setVideoUploading(true);
    startNoticeVideoUpload({
      title: draft.title || "Onboarding video",
      file: {
        uri: asset.uri,
        name: asset.name || `onboarding-${Date.now()}.mp4`,
        mimeType: asset.mimeType || "video/mp4",
        size: asset.size,
      },
      onReady: (playbackUrl) => {
        setDraft((d) => ({ ...d, videoUrl: playbackUrl }));
        setVideoUploading(false);
        Toast.show({ type: "success", text1: "Video ready", position: "bottom" });
      },
      onError: (error) => {
        setVideoUploading(false);
        Toast.show({
          type: "error",
          text1: "Video upload failed",
          text2: error,
          position: "bottom",
        });
      },
    });
  }, [draft.title]);

  const pickThumbnail = useCallback(async () => {
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
    setThumbUploading(true);
    startMobileUpload({
      file: {
        uri: asset.uri,
        name: asset.fileName || `thumb-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      },
      label: "Onboarding thumbnail",
      fileType: "image",
      folder: "config",
      onComplete: (url) => {
        setDraft((d) => ({ ...d, thumbnailUrl: url }));
        setThumbUploading(false);
        Toast.show({ type: "success", text1: "Thumbnail set", position: "bottom" });
      },
      onError: (error) => {
        setThumbUploading(false);
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
              Onboarding Videos
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {persisting ? <ActivityIndicator color={primaryColor} /> : null}
            <TouchableOpacity
              onPress={openAdd}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: primaryColor }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
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
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
        >
          {videos.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons name="film-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No onboarding videos.
              </Text>
            </View>
          ) : (
            videos.map((v, index) => (
              <View
                key={v._id ?? `new-${index}`}
                className="mb-3 rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-[15px] font-semibold text-foreground"
                      numberOfLines={2}
                    >
                      {v.title || "Untitled"}
                    </Text>
                    <Text className="mt-0.5 text-[12px] text-muted-foreground">
                      {v.role}
                    </Text>
                  </View>
                  <Switch
                    value={v.isActive}
                    onValueChange={() => toggleActive(index)}
                    trackColor={{ true: primaryColor }}
                  />
                </View>
                {v.description ? (
                  <Text
                    className="mt-1 text-[12px] text-muted-foreground"
                    numberOfLines={2}
                  >
                    {v.description}
                  </Text>
                ) : null}
                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => openEdit(index)}
                    activeOpacity={0.85}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-2.5"
                  >
                    <Ionicons name="create-outline" size={16} color={iconColor} />
                    <Text className="text-[13px] font-semibold text-foreground">
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeAt(index)}
                    activeOpacity={0.85}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
                    style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text
                      className="text-[13px] font-semibold"
                      style={{ color: "#EF4444" }}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add / edit modal */}
      <Modal
        visible={editorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card p-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-foreground">
                {editIndex === null ? "New video" : "Edit video"}
              </Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <Text className="mb-2 text-[12px] font-medium text-foreground">Role</Text>
              <View className="flex-row gap-2">
                {ROLES.map((role) => {
                  const active = draft.role === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      onPress={() => setDraft((d) => ({ ...d, role }))}
                      activeOpacity={0.85}
                      className="rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: active ? primaryColor : "transparent",
                        backgroundColor: active
                          ? `${primaryColor}1A`
                          : "rgba(120,120,120,0.1)",
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: active ? primaryColor : iconColor }}
                      >
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
                Title
              </Text>
              <TextInput
                value={draft.title}
                onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
                placeholder="Video title"
                placeholderTextColor="#6B7280"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
                Description
              </Text>
              <TextInput
                value={draft.description}
                onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
                placeholder="Optional description"
                placeholderTextColor="#6B7280"
                multiline
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
                style={{ minHeight: 70, textAlignVertical: "top" }}
              />

              <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
                Video URL
              </Text>
              <TextInput
                value={draft.videoUrl}
                onChangeText={(videoUrl) => setDraft((d) => ({ ...d, videoUrl }))}
                placeholder="https://… or upload below"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />
              <TouchableOpacity
                onPress={pickVideo}
                disabled={videoUploading}
                activeOpacity={0.85}
                className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
              >
                {videoUploading ? (
                  <ActivityIndicator color={primaryColor} />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color={primaryColor}
                    />
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: primaryColor }}
                    >
                      Upload video
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
                Thumbnail
              </Text>
              <TouchableOpacity
                onPress={pickThumbnail}
                disabled={thumbUploading}
                activeOpacity={0.85}
                className="flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
              >
                {thumbUploading ? (
                  <ActivityIndicator color={primaryColor} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={16} color={primaryColor} />
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: primaryColor }}
                    >
                      {draft.thumbnailUrl ? "Replace thumbnail" : "Upload thumbnail"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-[14px] font-medium text-foreground">Active</Text>
                <Switch
                  value={draft.isActive}
                  onValueChange={(isActive) => setDraft((d) => ({ ...d, isActive }))}
                  trackColor={{ true: primaryColor }}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={submitDraft}
              disabled={persisting}
              activeOpacity={0.85}
              className="mt-4 items-center rounded-full py-3.5"
              style={{ backgroundColor: primaryColor }}
            >
              {persisting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[14px] font-semibold text-white">Save video</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
