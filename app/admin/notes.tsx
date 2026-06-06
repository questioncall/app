import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { startMobileUpload } from "@/lib/upload-manager";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type NoteFileType = "PDF" | "DOCX" | "PPT" | "Image";
const FILE_TYPES: NoteFileType[] = ["PDF", "DOCX", "PPT", "Image"];

function detectFileType(name: string): NoteFileType {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOCX";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "Image";
  return "PDF";
}

type NoteRecord = {
  id: string;
  title: string;
  description: string;
  subject?: string;
  grade?: string;
  fileType?: string;
  fileUrl?: string | null;
  visibility?: string;
  price?: number;
  uploaderName?: string;
  uploaderUsername?: string | null;
  uploaderRole?: string | null;
  createdAt: string;
};

export default function AdminNotesScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<NoteRecord[]>(
    () => readCache<NoteRecord[]>("notes") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("notes") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [upTitle, setUpTitle] = useState("");
  const [upDescription, setUpDescription] = useState("");
  const [upSubject, setUpSubject] = useState("");
  const [upGrade, setUpGrade] = useState("");
  const [upFileType, setUpFileType] = useState<NoteFileType>("PDF");
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );

  const load = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      const res = await api.get(`/mobile/admin/notes?${params.toString()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      // Cache only the unfiltered default view that prefetch/seed relies on.
      if (!q.trim()) writeCache("notes", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load notes",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 450);
    return () => clearTimeout(t);
  }, [search, load]);

  const deleteNote = useCallback((note: NoteRecord) => {
    Alert.alert("Delete note?", `"${note.title}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(note.id);
          try {
            await api.delete(`/mobile/admin/notes/${note.id}`);
            setItems((prev) => prev.filter((n) => n.id !== note.id));
            Toast.show({ type: "success", text1: "Note deleted", position: "bottom" });
          } catch (err) {
            Toast.show({
              type: "error",
              text1: "Failed to delete",
              text2: getRequestErrorMessage(err, "Please try again."),
              position: "bottom",
            });
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, []);

  const resetUploadForm = () => {
    setUpTitle("");
    setUpDescription("");
    setUpSubject("");
    setUpGrade("");
    setUpFileType("PDF");
    setPickedFile(null);
  };

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword", "application/vnd.*", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedFile(asset);
    setUpFileType(detectFileType(asset.name));
  }, []);

  const submitUpload = useCallback(async () => {
    if (!upTitle.trim()) {
      Toast.show({ type: "error", text1: "Title is required", position: "bottom" });
      return;
    }
    if (!pickedFile) {
      Toast.show({ type: "error", text1: "Pick a file to upload", position: "bottom" });
      return;
    }
    setSubmitting(true);
    const isImage =
      upFileType === "Image" || (pickedFile.mimeType || "").startsWith("image/");
    startMobileUpload({
      file: {
        uri: pickedFile.uri,
        name: pickedFile.name,
        mimeType: pickedFile.mimeType || "application/octet-stream",
        size: pickedFile.size || undefined,
      },
      label: `Note: ${upTitle.trim()}`,
      fileType: isImage ? "image" : "file",
      folder: "notes",
      onComplete: async (fileUrl: string) => {
        try {
          await api.post("/notes", {
            title: upTitle.trim(),
            description: upDescription.trim(),
            subject: upSubject.trim(),
            grade: upGrade.trim(),
            fileType: upFileType,
            fileUrl,
          });
          Toast.show({ type: "success", text1: "Note uploaded", position: "bottom" });
          void load(search);
        } catch (err) {
          Toast.show({
            type: "error",
            text1: "Failed to save note",
            text2: getRequestErrorMessage(err, "Please try again."),
            position: "bottom",
          });
        }
      },
      onError: (error: string) => {
        Toast.show({
          type: "error",
          text1: "Upload failed",
          text2: error,
          position: "bottom",
        });
      },
    });
    // Upload runs in the global overlay; close the form immediately.
    setSubmitting(false);
    setUploadOpen(false);
    resetUploadForm();
  }, [upTitle, upDescription, upSubject, upGrade, upFileType, pickedFile, load, search]);

  const renderItem = useCallback(
    ({ item }: { item: NoteRecord }) => {
      const isPrivate = (item.visibility || "public").toLowerCase() !== "public";
      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <Text
              className="flex-1 pr-3 text-[15px] font-semibold text-foreground"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.fileType ? (
              <View
                className="rounded-md px-2 py-0.5"
                style={{ backgroundColor: `${primaryColor}14` }}
              >
                <Text className="text-[10px] font-bold" style={{ color: primaryColor }}>
                  {item.fileType.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          {item.description ? (
            <Text className="mt-1 text-[13px] text-muted-foreground" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {item.subject ? (
              <Text className="text-[12px] text-muted-foreground">{item.subject}</Text>
            ) : null}
            {item.grade ? (
              <Text className="text-[12px] text-muted-foreground">
                Grade {item.grade}
              </Text>
            ) : null}
            <Text className="text-[12px] text-muted-foreground">
              {isPrivate ? "Private" : "Public"}
            </Text>
            {item.price ? (
              <Text className="text-[12px] font-semibold" style={{ color: primaryColor }}>
                {item.price} NPR
              </Text>
            ) : null}
          </View>

          <Text className="mt-1 text-[11px] text-muted-foreground">
            By {item.uploaderName ?? "Unknown"}
            {item.uploaderUsername ? ` · @${item.uploaderUsername}` : ""}
            {item.uploaderRole ? ` · ${item.uploaderRole}` : ""}
          </Text>

          <View className="mt-3 flex-row gap-2">
            {item.fileUrl ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.fileUrl!)}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-2.5"
              >
                <Ionicons name="open-outline" size={16} color={iconColor} />
                <Text className="text-[13px] font-semibold text-foreground">Open</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => deleteNote(item)}
              disabled={deletingId === item.id}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
              style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
            >
              {deletingId === item.id ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: "#EF4444" }}
                  >
                    Delete
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [deletingId, deleteNote, iconColor, primaryColor],
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
            <View>
              <Text className="text-[18px] font-bold tracking-tight text-foreground">
                Notes
              </Text>
              <Text className="text-[12px] text-muted-foreground">
                {items.length} found
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              resetUploadForm();
              setUploadOpen(true);
            }}
            activeOpacity={0.85}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text className="text-[12px] font-semibold text-white">Upload</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-card px-3">
          <Ionicons name="search" size={18} color={iconColor} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search notes"
            placeholderTextColor="#6B7280"
            className="flex-1 px-2 py-3 text-[14px] text-foreground"
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
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
                void load(search);
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No notes found.
              </Text>
            </View>
          }
        />
      )}

      {/* Upload modal */}
      <Modal
        visible={uploadOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setUploadOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card"
            style={{ maxHeight: "90%", paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
              <Text className="text-[17px] font-bold text-foreground">Upload note</Text>
              <TouchableOpacity onPress={() => !submitting && setUploadOpen(false)}>
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
                value={upTitle}
                onChangeText={setUpTitle}
                placeholder="Note title"
                placeholderTextColor="#6B7280"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
                Description
              </Text>
              <TextInput
                value={upDescription}
                onChangeText={setUpDescription}
                placeholder="Optional description"
                placeholderTextColor="#6B7280"
                multiline
                className="min-h-[64px] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />

              <View className="mt-3 flex-row gap-2">
                <View className="flex-1">
                  <Text className="mb-1 ml-1 text-[12px] font-medium text-foreground">
                    Subject
                  </Text>
                  <TextInput
                    value={upSubject}
                    onChangeText={setUpSubject}
                    placeholder="e.g. Physics"
                    placeholderTextColor="#6B7280"
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 ml-1 text-[12px] font-medium text-foreground">
                    Grade
                  </Text>
                  <TextInput
                    value={upGrade}
                    onChangeText={setUpGrade}
                    placeholder="e.g. 12"
                    placeholderTextColor="#6B7280"
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
                  />
                </View>
              </View>

              <Text className="mb-2 ml-1 mt-4 text-[12px] font-medium text-foreground">
                File type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {FILE_TYPES.map((ft) => {
                  const active = upFileType === ft;
                  return (
                    <TouchableOpacity
                      key={ft}
                      onPress={() => setUpFileType(ft)}
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
                        {ft}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={pickFile}
                activeOpacity={0.85}
                className="mt-4 flex-row items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 py-4"
              >
                <Ionicons name="attach-outline" size={20} color={primaryColor} />
                <Text className="flex-1 text-[13px] text-foreground" numberOfLines={1}>
                  {pickedFile ? pickedFile.name : "Choose a file (PDF, DOCX, PPT, image)"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitUpload}
                disabled={submitting}
                activeOpacity={0.85}
                className="mt-6 items-center rounded-full py-4"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[15px] font-semibold text-white">
                    Upload note
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
