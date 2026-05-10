import { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";

type FileType = "PDF" | "DOCX" | "PPT" | "Image";

interface Note {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  fileType: FileType;
  date: string;
  uploader: string;
}

const MOCK_NOTES: Note[] = [
  {
    id: "1",
    title: "Newton's Laws of Motion",
    subject: "Physics",
    grade: "Grade 11",
    description:
      "Comprehensive notes covering all three Newton's laws with worked examples and diagrams.",
    fileType: "PDF",
    date: "2026-05-08",
    uploader: "Sita Sharma",
  },
  {
    id: "2",
    title: "Photosynthesis — Light & Dark Reactions",
    subject: "Biology",
    grade: "Grade 10",
    description:
      "Detailed breakdown of the light-dependent and light-independent (Calvin cycle) reactions.",
    fileType: "PDF",
    date: "2026-05-07",
    uploader: "Ram Thapa",
  },
  {
    id: "3",
    title: "Quadratic Equations — Methods",
    subject: "Mathematics",
    grade: "Grade 10",
    description:
      "Solving quadratic equations by factoring, completing the square, and the quadratic formula.",
    fileType: "DOCX",
    date: "2026-05-05",
    uploader: "Anita Karki",
  },
  {
    id: "4",
    title: "World War II — Causes & Consequences",
    subject: "Social Studies",
    grade: "Grade 12",
    description:
      "Summary of key events, major powers, turning points, and post-war outcomes.",
    fileType: "PDF",
    date: "2026-05-03",
    uploader: "Bikash Rai",
  },
  {
    id: "5",
    title: "Python Basics — Intro to Programming",
    subject: "Computer Science",
    grade: "Grade 11",
    description: "Variables, data types, control flow, loops, and functions in Python 3.",
    fileType: "PPT",
    date: "2026-04-30",
    uploader: "Priya Gurung",
  },
  {
    id: "6",
    title: "Chemical Bonding",
    subject: "Chemistry",
    grade: "Grade 11",
    description:
      "Ionic, covalent, and metallic bonds with examples from the periodic table.",
    fileType: "PDF",
    date: "2026-04-28",
    uploader: "Dinesh Poudel",
  },
];

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

function NoteCard({ note }: { note: Note }) {
  const { cardColor, borderColor, primaryColor } = useAppTheme();
  const cfg = FILE_TYPE_CONFIG[note.fileType];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View className="flex-row items-start p-4">
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
              <Text className="text-[10px] font-semibold" style={{ color: primaryColor }}>
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
          <Text
            className="mt-1.5 text-xs leading-4 text-muted-foreground"
            numberOfLines={2}
          >
            {note.description}
          </Text>
          <Text className="mt-2 text-[10px] text-muted-foreground">
            by {note.uploader} ·{" "}
            {new Date(note.date).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>

        <TouchableOpacity
          className="ml-2 h-9 w-9 items-center justify-center rounded-xl bg-secondary"
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <Ionicons name="download-outline" size={17} color={primaryColor} />
        </TouchableOpacity>
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
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (note: Omit<Note, "id" | "date" | "uploader">) => void;
}) {
  const { backgroundColor, cardColor, borderColor, primaryColor, mutedIconColor } =
    useAppTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [grade, setGrade] = useState<string>(GRADES[0]);
  const [fileType, setFileType] = useState<FileType>("PDF");

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      subject,
      grade,
      fileType,
    });
    setTitle("");
    setDescription("");
    setSubject(SUBJECTS[0]);
    setGrade(GRADES[0]);
    setFileType("PDF");
  }

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

            {/* Fake file attach button */}
            <TouchableOpacity
              className="mb-6 flex-row items-center justify-center rounded-xl border-2 border-dashed py-5"
              style={{ borderColor }}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={mutedIconColor} />
              <Text className="ml-2 text-sm text-muted-foreground">
                Tap to attach file
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!title.trim()}
              className="items-center justify-center rounded-full py-4"
              style={{
                backgroundColor: title.trim() ? primaryColor : `${primaryColor}60`,
              }}
              activeOpacity={0.85}
            >
              <Text className="text-base font-bold text-white">Upload Note</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function NotesScreen() {
  const { statusBarStyle, backgroundColor, primaryColor, borderColor } = useAppTheme();
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [search, setSearch] = useState("");
  const { mutedIconColor } = useAppTheme();

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.subject.toLowerCase().includes(search.toLowerCase()) ||
          n.grade.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  function handleUpload(data: Omit<Note, "id" | "date" | "uploader">) {
    const newNote: Note = {
      ...data,
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      uploader: "You",
    };
    setNotes((prev) => [newNote, ...prev]);
    setUploadVisible(false);
  }

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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NoteCard note={item} />}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="mt-20 items-center">
            <Ionicons name="document-text-outline" size={48} color={mutedIconColor} />
            <Text className="mt-3 text-base font-semibold text-muted-foreground">
              No notes found
            </Text>
          </View>
        }
      />

      <UploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onSubmit={handleUpload}
      />
    </View>
  );
}
