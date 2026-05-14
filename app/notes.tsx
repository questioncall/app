import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { startMobileUpload } from "@/lib/upload-manager";

type FileType = "PDF" | "DOCX" | "PPT" | "Image";

interface Note {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  fileType: FileType;
  fileUrl: string | null;
  uploaderName: string;
  uploaderUsername: string | null;
  uploaderImage: string | null;
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
}

const FILE_TYPE_CONFIG: Record<FileType, { color: string; icon: string }> = {
  PDF: { color: "#EF4444", icon: "document-text" },
  DOCX: { color: "#3B82F6", icon: "document" },
  PPT: { color: "#F59E0B", icon: "easel" },
  Image: { color: "#8B5CF6", icon: "image" },
};

const SUBJECTS = [
  "Physics",
  "Biology",
  "Chemistry",
  "Mathematics",
  "English",
  "Computer Science",
  "Social Studies",
  "Accountancy",
  "Other",
];
const GRADES = [
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Bachelor's",
  "Other",
];
const FILE_TYPES: FileType[] = ["PDF", "DOCX", "PPT", "Image"];

function NoteCard({ note, onPress }: { note: Note; onPress: (note: Note) => void }) {
  const { cardColor, borderColor, primaryColor, mutedIconColor } = useAppTheme();
  const cfg = FILE_TYPE_CONFIG[note.fileType];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(note)}
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      {/* Color accent bar */}
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

          <TouchableOpacity
            className="ml-2 h-9 w-9 items-center justify-center rounded-xl bg-secondary"
            activeOpacity={0.7}
            onPress={() => {
              if (note.fileUrl) {
                Linking.openURL(note.fileUrl);
              }
            }}
            disabled={!note.fileUrl}
          >
            <Ionicons
              name="open-outline"
              size={17}
              color={note.fileUrl ? primaryColor : mutedIconColor}
            />
          </TouchableOpacity>
        </View>

        {note.description ? (
          <Text
            className="mt-2 text-xs leading-4 text-muted-foreground"
            numberOfLines={2}
          >
            {note.description}
          </Text>
        ) : null}

        {/* Author row */}
        <View className="mt-3 flex-row items-center border-t border-border pt-2.5">
          <Ionicons name="person-circle-outline" size={16} color={mutedIconColor} />
          <Text className="ml-1.5 flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {note.uploaderName}
          </Text>
          <Text className="text-[10px] text-muted-foreground">
            {new Date(note.createdAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
  primaryColor,
  cardColor,
  borderColor,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
      <View className="flex-row gap-2 pb-1">
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              className="rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: active ? primaryColor : cardColor,
                borderColor: active ? primaryColor : borderColor,
              }}
              activeOpacity={0.7}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: active ? "#FFFFFF" : undefined }}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function UploadModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (note: {
    title: string;
    description: string;
    subject: string;
    grade: string;
    fileType: FileType;
    pickedFile: DocumentPicker.DocumentPickerAsset | null;
  }) => void;
  isSubmitting: boolean;
}) {
  const { backgroundColor, cardColor, borderColor, primaryColor, mutedIconColor } =
    useAppTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [grade, setGrade] = useState<string>(GRADES[0]);
  const [fileType, setFileType] = useState<FileType>("PDF");
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "image/*",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setPickedFile(asset);

        // Auto-set file type
        const ext = asset.name.split(".").pop()?.toLowerCase();
        if (ext === "pdf") setFileType("PDF");
        else if (["doc", "docx"].includes(ext || "")) setFileType("DOCX");
        else if (["ppt", "pptx"].includes(ext || "")) setFileType("PPT");
        else if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) setFileType("Image");
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSubject(SUBJECTS[0]);
    setGrade(GRADES[0]);
    setFileType("PDF");
    setPickedFile(null);
  };

  function onFormSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      subject,
      grade,
      fileType,
      pickedFile,
    });
    resetForm();
  }

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          className="rounded-t-3xl px-5 pb-8 pt-5"
          style={{ backgroundColor: cardColor, maxHeight: "90%" }}
        >
          {/* Handle bar */}
          <View className="mb-4 items-center">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Upload Note</Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
            >
              <Ionicons name="close" size={18} color={mutedIconColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Newton's Laws of Motion"
              placeholderTextColor={mutedIconColor}
              className="mb-4 rounded-xl border px-4 py-3 text-sm text-foreground"
              style={{ borderColor, backgroundColor }}
            />

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of the notes…"
              placeholderTextColor={mutedIconColor}
              className="mb-4 rounded-xl border px-4 py-3 text-sm text-foreground"
              style={{
                borderColor,
                backgroundColor,
                minHeight: 72,
                textAlignVertical: "top",
              }}
              multiline
            />

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </Text>
            <View className="mb-4">
              <ChipSelector
                options={SUBJECTS}
                selected={subject}
                onSelect={setSubject}
                primaryColor={primaryColor}
                cardColor={backgroundColor}
                borderColor={borderColor}
              />
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grade / Class
            </Text>
            <View className="mb-4">
              <ChipSelector
                options={GRADES}
                selected={grade}
                onSelect={setGrade}
                primaryColor={primaryColor}
                cardColor={backgroundColor}
                borderColor={borderColor}
              />
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File Type
            </Text>
            <View className="mb-4 flex-row gap-3">
              {FILE_TYPES.map((ft) => {
                const active = ft === fileType;
                const cfg = FILE_TYPE_CONFIG[ft];
                return (
                  <TouchableOpacity
                    key={ft}
                    onPress={() => setFileType(ft)}
                    className="flex-1 items-center rounded-xl border py-3"
                    style={{
                      borderColor: active ? cfg.color : borderColor,
                      backgroundColor: active ? `${cfg.color}15` : backgroundColor,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cfg.icon as any}
                      size={20}
                      color={active ? cfg.color : mutedIconColor}
                    />
                    <Text
                      className="mt-1 text-xs font-semibold"
                      style={{ color: active ? cfg.color : mutedIconColor }}
                    >
                      {ft}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* File Attachment */}
            {!pickedFile ? (
              <TouchableOpacity
                onPress={handlePickFile}
                className="mb-6 flex-row items-center justify-center rounded-xl border-2 border-dashed py-5"
                style={{ borderColor }}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload-outline" size={22} color={mutedIconColor} />
                <Text className="ml-2 text-sm text-muted-foreground">
                  Tap to attach file
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                className="mb-6 flex-row items-center justify-between rounded-xl border p-4"
                style={{
                  borderColor: `${primaryColor}40`,
                  backgroundColor: `${primaryColor}08`,
                }}
              >
                <View className="flex-1 flex-row items-center">
                  <Ionicons
                    name={FILE_TYPE_CONFIG[fileType].icon as any}
                    size={20}
                    color={primaryColor}
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-sm font-medium text-foreground"
                      numberOfLines={1}
                    >
                      {pickedFile.name}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">
                      {(pickedFile.size ? pickedFile.size / 1024 / 1024 : 0).toFixed(2)}{" "}
                      MB
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setPickedFile(null)}>
                  <Ionicons name="close-circle" size={20} color={mutedIconColor} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={onFormSubmit}
              disabled={!title.trim() || isSubmitting}
              className="items-center justify-center rounded-full py-4"
              style={{
                backgroundColor:
                  title.trim() && !isSubmitting ? primaryColor : `${primaryColor}60`,
              }}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text className="ml-2 font-bold text-white">Uploading...</Text>
                </View>
              ) : (
                <Text className="text-base font-bold text-white">Upload Note</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function NotesScreen() {
  const { statusBarStyle, backgroundColor, primaryColor, borderColor } = useAppTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubject, setEditSubject] = useState(SUBJECTS[0]);
  const [editGrade, setEditGrade] = useState(GRADES[0]);
  const [editFileType, setEditFileType] = useState<FileType>("PDF");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const { mutedIconColor, cardColor } = useAppTheme();

  const fetchNotes = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.get("/notes?limit=30");
      setNotes(res.data as Note[]);
    } catch (err) {
      console.error("[Notes] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNotes(true);
  }, [fetchNotes]);

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.subject.toLowerCase().includes(search.toLowerCase()) ||
          n.grade.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  async function handleUpload(data: {
    title: string;
    description: string;
    subject: string;
    grade: string;
    fileType: FileType;
    pickedFile: DocumentPicker.DocumentPickerAsset | null;
  }) {
    // Close modal immediately — upload runs in background
    setUploadVisible(false);

    if (data.pickedFile) {
      const isImage =
        data.fileType === "Image" ||
        (data.pickedFile.mimeType || "").startsWith("image/");

      startMobileUpload({
        file: {
          uri: data.pickedFile.uri,
          name: data.pickedFile.name,
          mimeType: data.pickedFile.mimeType || "application/octet-stream",
          size: data.pickedFile.size || undefined,
        },
        label: `Note: ${data.title}`,
        fileType: isImage ? "image" : "file",
        folder: "notes",
        onComplete: async (fileUrl: string) => {
          try {
            const res = await api.post("/notes", {
              title: data.title,
              description: data.description,
              subject: data.subject,
              grade: data.grade,
              fileType: data.fileType,
              fileUrl,
            });
            const newNote = res.data as Note;
            setNotes((prev) => [newNote, ...prev]);
          } catch (err) {
            console.error("[Notes] Failed to create note after upload:", err);
          }
        },
        onError: (error: string) => {
          console.error("[Notes] Upload failed:", error);
        },
      });
    } else {
      // No file — create note directly (instant)
      try {
        const res = await api.post("/notes", {
          title: data.title,
          description: data.description,
          subject: data.subject,
          grade: data.grade,
          fileType: data.fileType,
          fileUrl: null,
        });
        const newNote = res.data as Note;
        setNotes((prev) => [newNote, ...prev]);
      } catch (err) {
        console.error("[Notes] Failed to create note:", err);
      }
    }
  }

  const openNoteDetail = (note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditDescription(note.description);
    setEditSubject(note.subject);
    setEditGrade(note.grade);
    setEditFileType(note.fileType);
    setIsEditingNote(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedNote || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await api.patch(`/notes/${selectedNote.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        subject: editSubject,
        grade: editGrade,
        fileType: editFileType,
      });
      const updated = res.data as Note;
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setSelectedNote(updated);
      setIsEditingNote(false);
    } catch (err) {
      console.error("[Notes] Failed to update:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="px-5 pb-2 pt-14">
        <View className="flex-row items-center justify-between">
          <Text className="text-[28px] font-bold tracking-tight text-foreground">
            Notes
          </Text>
          <TouchableOpacity
            onPress={() => setUploadVisible(true)}
            className="flex-row items-center rounded-xl px-4 py-2.5"
            style={{ backgroundColor: primaryColor }}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#FFF" />
            <Text className="ml-1.5 text-sm font-semibold text-white">Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View
          className="mt-4 flex-row items-center rounded-xl border px-3 py-2.5"
          style={{ borderColor, backgroundColor: `${primaryColor}08` }}
        >
          <Ionicons name="search-outline" size={17} color={mutedIconColor} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, subject, grade…"
            placeholderTextColor={mutedIconColor}
            className="ml-2 flex-1 text-sm text-foreground"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={17} color={mutedIconColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className="mt-20 items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className="mt-3 text-sm text-muted-foreground">Loading notes…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NoteCard note={item} onPress={openNoteDetail} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 32,
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
            <View className="mt-20 items-center">
              <Ionicons name="document-text-outline" size={48} color={mutedIconColor} />
              <Text className="mt-3 text-base font-semibold text-muted-foreground">
                No notes found
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Be the first to share study notes!
              </Text>
            </View>
          }
        />
      )}

      <UploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onSubmit={handleUpload}
        isSubmitting={isSubmitting}
      />

      {/* Note Detail / Edit Modal */}
      <Modal
        visible={!!selectedNote}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedNote(null)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="rounded-t-3xl px-5 pb-8 pt-5"
            style={{ backgroundColor: cardColor, maxHeight: "85%" }}
          >
            {/* Handle */}
            <View className="mb-4 items-center">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">
                {isEditingNote ? "Edit Note" : "Note Details"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedNote(null);
                  setIsEditingNote(false);
                }}
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <Ionicons name="close" size={18} color={mutedIconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedNote && !isEditingNote ? (
                /* ── View Mode ── */
                <View>
                  <Text className="mb-2 text-xl font-bold text-foreground">
                    {selectedNote.title}
                  </Text>
                  <View className="mb-3 flex-row flex-wrap gap-2">
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: `${primaryColor}18` }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: primaryColor }}
                      >
                        {selectedNote.subject}
                      </Text>
                    </View>
                    <View className="rounded-full bg-secondary px-2.5 py-1">
                      <Text className="text-xs text-muted-foreground">
                        {selectedNote.grade}
                      </Text>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor: `${FILE_TYPE_CONFIG[selectedNote.fileType].color}18`,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: FILE_TYPE_CONFIG[selectedNote.fileType].color }}
                      >
                        {selectedNote.fileType}
                      </Text>
                    </View>
                  </View>
                  {selectedNote.description ? (
                    <Text className="mb-4 text-sm leading-5 text-muted-foreground">
                      {selectedNote.description}
                    </Text>
                  ) : (
                    <Text className="mb-4 text-sm italic text-muted-foreground">
                      No description provided.
                    </Text>
                  )}

                  <View className="mb-4 flex-row items-center gap-2 border-t border-border pt-3">
                    <Ionicons
                      name="person-circle-outline"
                      size={20}
                      color={mutedIconColor}
                    />
                    <Text className="text-sm font-medium text-foreground">
                      {selectedNote.uploaderName}
                    </Text>
                    <Text className="ml-auto text-xs text-muted-foreground">
                      {new Date(selectedNote.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                  </View>

                  {/* Open file button */}
                  {selectedNote.fileUrl ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(selectedNote.fileUrl!)}
                      className="mb-3 flex-row items-center justify-center rounded-xl py-3.5"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        borderWidth: 1,
                        borderColor: `${primaryColor}30`,
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="open-outline" size={18} color={primaryColor} />
                      <Text
                        className="ml-2 text-sm font-semibold"
                        style={{ color: primaryColor }}
                      >
                        Open File
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="mb-3 flex-row items-center justify-center rounded-xl border border-dashed border-border py-3.5">
                      <Ionicons
                        name="document-outline"
                        size={18}
                        color={mutedIconColor}
                      />
                      <Text className="ml-2 text-sm text-muted-foreground">
                        No file attached
                      </Text>
                    </View>
                  )}

                  {/* Edit button for owner */}
                  {selectedNote.isOwner && (
                    <TouchableOpacity
                      onPress={() => setIsEditingNote(true)}
                      className="flex-row items-center justify-center rounded-xl py-3.5"
                      style={{ backgroundColor: primaryColor }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFF" />
                      <Text className="ml-2 text-sm font-semibold text-white">
                        Edit Metadata
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : selectedNote && isEditingNote ? (
                /* ── Edit Mode ── */
                <View>
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Title *
                  </Text>
                  <TextInput
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Title"
                    placeholderTextColor={mutedIconColor}
                    className="mb-4 rounded-xl border px-4 py-3 text-sm text-foreground"
                    style={{ borderColor, backgroundColor }}
                  />

                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </Text>
                  <TextInput
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Description"
                    placeholderTextColor={mutedIconColor}
                    className="mb-4 rounded-xl border px-4 py-3 text-sm text-foreground"
                    style={{
                      borderColor,
                      backgroundColor,
                      minHeight: 72,
                      textAlignVertical: "top",
                    }}
                    multiline
                  />

                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subject
                  </Text>
                  <View className="mb-4">
                    <ChipSelector
                      options={SUBJECTS}
                      selected={editSubject}
                      onSelect={setEditSubject}
                      primaryColor={primaryColor}
                      cardColor={backgroundColor}
                      borderColor={borderColor}
                    />
                  </View>

                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Grade
                  </Text>
                  <View className="mb-4">
                    <ChipSelector
                      options={GRADES}
                      selected={editGrade}
                      onSelect={setEditGrade}
                      primaryColor={primaryColor}
                      cardColor={backgroundColor}
                      borderColor={borderColor}
                    />
                  </View>

                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    File Type
                  </Text>
                  <View className="mb-6 flex-row gap-3">
                    {FILE_TYPES.map((ft) => {
                      const active = ft === editFileType;
                      const cfg = FILE_TYPE_CONFIG[ft];
                      return (
                        <TouchableOpacity
                          key={ft}
                          onPress={() => setEditFileType(ft)}
                          className="flex-1 items-center rounded-xl border py-3"
                          style={{
                            borderColor: active ? cfg.color : borderColor,
                            backgroundColor: active ? `${cfg.color}15` : backgroundColor,
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={cfg.icon as any}
                            size={20}
                            color={active ? cfg.color : mutedIconColor}
                          />
                          <Text
                            className="mt-1 text-xs font-semibold"
                            style={{ color: active ? cfg.color : mutedIconColor }}
                          >
                            {ft}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => setIsEditingNote(false)}
                      className="flex-1 items-center justify-center rounded-xl border py-3.5"
                      style={{ borderColor }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEdit}
                      disabled={!editTitle.trim() || isSavingEdit}
                      className="flex-1 items-center justify-center rounded-xl py-3.5"
                      style={{
                        backgroundColor:
                          editTitle.trim() && !isSavingEdit
                            ? primaryColor
                            : `${primaryColor}60`,
                      }}
                      activeOpacity={0.85}
                    >
                      {isSavingEdit ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text className="text-sm font-bold text-white">Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
