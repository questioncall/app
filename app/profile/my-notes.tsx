import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import type { Note } from "@/store/slices/notesSlice";

const FILE_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  PDF: { color: "#EF4444", icon: "document-text" },
  DOCX: { color: "#3B82F6", icon: "document" },
  PPT: { color: "#F59E0B", icon: "easel" },
  Image: { color: "#8B5CF6", icon: "image" },
};

function NoteCard({ note }: { note: Note }) {
  const { cardColor, borderColor, primaryColor, mutedIconColor } = useAppTheme();
  const cfg = FILE_TYPE_CONFIG[note.fileType] ?? FILE_TYPE_CONFIG.PDF;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        if (note.fileUrl) Linking.openURL(note.fileUrl);
      }}
      disabled={!note.fileUrl}
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View style={{ height: 3, backgroundColor: `${cfg.color}30` }} />
      <View className="p-4">
        <View className="flex-row items-start">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${cfg.color}18` }}
          >
            <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
          </View>

          <View className="flex-1">
            <Text
              className="text-[15px] font-semibold leading-tight text-foreground"
              numberOfLines={2}
            >
              {note.title}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${primaryColor}18` }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: primaryColor }}
                >
                  {note.subject}
                </Text>
              </View>
              <View className="rounded-full bg-secondary px-2 py-0.5">
                <Text className="text-[10px] text-muted-foreground">{note.grade}</Text>
              </View>
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${cfg.color}18` }}
              >
                <Text className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                  {note.fileType}
                </Text>
              </View>
            </View>
          </View>

          {note.fileUrl ? (
            <View className="ml-2 h-9 w-9 items-center justify-center rounded-xl bg-secondary">
              <Ionicons name="open-outline" size={17} color={primaryColor} />
            </View>
          ) : (
            <View className="ml-2 h-9 w-9 items-center justify-center rounded-xl bg-secondary">
              <Ionicons name="document-outline" size={17} color={mutedIconColor} />
            </View>
          )}
        </View>

        {note.description ? (
          <Text
            className="mt-2 text-xs leading-4 text-muted-foreground"
            numberOfLines={2}
          >
            {note.description}
          </Text>
        ) : null}

        <Text className="mt-3 border-t border-border pt-2.5 text-[10px] text-muted-foreground">
          Uploaded{" "}
          {new Date(note.createdAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyNotesScreen() {
  const { statusBarStyle, backgroundColor, primaryColor, borderColor, mutedIconColor } =
    useAppTheme();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMyNotes = useCallback(
    async (force = false) => {
      if (!force && notes.length > 0) return;
      if (notes.length === 0) setIsLoading(true);
      try {
        const res = await api.get("/notes?uploaderOnly=true&limit=50");
        setNotes(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("[MyNotes] fetch failed:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [notes.length],
  );

  useEffect(() => {
    void fetchMyNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchMyNotes(true);
  }, [fetchMyNotes]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        className="flex-row items-center gap-3 px-4 pb-3 pt-14"
        style={{ borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={primaryColor} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[18px] font-bold text-foreground">My Notes</Text>
          <Text className="text-xs text-muted-foreground">
            {notes.length} note{notes.length !== 1 ? "s" : ""} uploaded
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/notes" as any)}
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: primaryColor }}
          activeOpacity={0.85}
        >
          <Text className="text-xs font-semibold text-white">Upload New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="mt-24 items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className="mt-3 text-sm text-muted-foreground">Loading your notes…</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 48,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="mt-28 items-center px-8">
              <Ionicons name="document-text-outline" size={56} color={mutedIconColor} />
              <Text className="mt-4 text-[17px] font-semibold text-muted-foreground">
                No notes yet
              </Text>
              <Text className="mt-1 text-center text-sm leading-5 text-muted-foreground">
                Notes and study materials you upload will appear here.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/notes" as any)}
                className="mt-6 rounded-full px-8 py-3"
                style={{ backgroundColor: primaryColor }}
                activeOpacity={0.85}
              >
                <Text className="text-sm font-bold text-white">Upload a Note</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}
