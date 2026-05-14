import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api, API_BASE_URL } from "@/lib/api";

// ─── Ringtone definitions (mirrors web/lib/call-settings.ts) ───────────────
const RINGTONE_OPTIONS = [
  {
    value: "classic",
    label: "Warm Hum",
    description: "A gentle low-pitched hum built on a warm major third.",
  },
  {
    value: "soft",
    label: "Soft Chime",
    description: "Two mellow notes fading in and out slowly.",
  },
  {
    value: "nocturne",
    label: "Drift",
    description: "A slowly evolving pad with gentle vibrato.",
  },
  {
    value: "sonata",
    label: "Dewdrop",
    description: "A single soft drip that fades gently.",
  },
  {
    value: "serenade",
    label: "Lullaby Bell",
    description: "Three soft music-box notes in a major triad.",
  },
  {
    value: "waltz",
    label: "Ocean Pulse",
    description: "A very low rhythmic pulse that rises and falls like gentle waves.",
  },
  {
    value: "aria",
    label: "Zen Ping",
    description: "A single clean round ping with a long resonant tail.",
  },
  {
    value: "prelude",
    label: "Amber Glow",
    description: "Two warm alternating tones a perfect fifth apart.",
  },
  {
    value: "lullaby",
    label: "Cloud Float",
    description: "An airy, ethereal pad that drifts in and out.",
  },
  {
    value: "reverie",
    label: "Twilight Gong",
    description: "A deep resonant gong hit with a long, fading decay.",
  },
  {
    value: "incoming_ringtone",
    label: "Incoming Call",
    description: "A clear ringing tone for incoming calls.",
  },
  {
    value: "outgoing_ringtone",
    label: "Outgoing Call",
    description: "A steady ringback tone while your call connects.",
  },
] as const;

type CallRingtone = (typeof RINGTONE_OPTIONS)[number]["value"];

type CallSettings = {
  silentIncomingCalls: boolean;
  incomingRingtone: CallRingtone;
  outgoingRingtone: CallRingtone;
};

const DEFAULT: CallSettings = {
  silentIncomingCalls: false,
  incomingRingtone: "incoming_ringtone",
  outgoingRingtone: "outgoing_ringtone",
};

function ringtoneLabel(value: string) {
  return RINGTONE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ─── Ringtone picker modal ──────────────────────────────────────────────────
function RingtoneModal({
  visible,
  title,
  selected,
  previewing,
  onSelect,
  onPreviewToggle,
  onClose,
  primaryColor,
  cardColor,
  borderColor,
  mutedIconColor,
  isDark,
}: {
  visible: boolean;
  title: string;
  selected: CallRingtone;
  previewing: string | null;
  onSelect: (v: CallRingtone) => void;
  onPreviewToggle: (v: CallRingtone) => void;
  onClose: () => void;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
  mutedIconColor: string;
  isDark: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "75%",
            paddingTop: 16,
            paddingBottom: 32,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 99,
                backgroundColor: borderColor,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: isDark ? "#f1f5f9" : "#0f172a",
              paddingHorizontal: 20,
              marginBottom: 12,
            }}
          >
            {title}
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {RINGTONE_OPTIONS.map((opt) => {
              const isSelected = selected === opt.value;
              const isPlaying = previewing === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSelect(opt.value)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginBottom: 6,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: isSelected ? primaryColor : borderColor,
                    backgroundColor: isSelected ? `${primaryColor}10` : "transparent",
                  }}
                >
                  {/* Selection circle */}
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: isSelected ? primaryColor : mutedIconColor,
                      backgroundColor: isSelected ? primaryColor : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#fff",
                        }}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isSelected ? "600" : "500",
                        color: isSelected ? primaryColor : isDark ? "#f1f5f9" : "#0f172a",
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: mutedIconColor, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {opt.description}
                    </Text>
                  </View>

                  {/* Preview button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onPreviewToggle(opt.value);
                    }}
                    hitSlop={8}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isPlaying
                        ? `${primaryColor}20`
                        : `${mutedIconColor}15`,
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons
                      name={isPlaying ? "stop" : "play"}
                      size={14}
                      color={isPlaying ? primaryColor : mutedIconColor}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: primaryColor,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Selector row ───────────────────────────────────────────────────────────
function SelectorRow({
  icon,
  label,
  value,
  onPress,
  primaryColor,
  mutedIconColor,
  borderColor,
  isDark,
}: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
  primaryColor: string;
  mutedIconColor: string;
  borderColor: string;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${primaryColor}15`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon as any} size={18} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: mutedIconColor, marginBottom: 1 }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          {ringtoneLabel(value)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={mutedIconColor} />
    </TouchableOpacity>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function CallSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    primaryColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [settings, setSettings] = useState<CallSettings>(DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activePicker, setActivePicker] = useState<"incoming" | "outgoing" | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);

  // ── Load settings ────────────────────────────────────────────────
  useEffect(() => {
    api
      .get("/users/call-settings")
      .then((res) => {
        if (res.data?.callSettings) setSettings(res.data.callSettings);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // ── Cleanup sound on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      soundRef.current?.pause();
      soundRef.current?.remove();
    };
  }, []);

  // ── Preview ringtone ─────────────────────────────────────────────
  const handlePreviewToggle = useCallback(
    async (ringtone: string) => {
      // Stop any current preview
      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.remove();
        soundRef.current = null;
      }
      if (previewing === ringtone) {
        setPreviewing(null);
        return;
      }
      setPreviewing(ringtone);
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const ext =
          ringtone === "incoming_ringtone" || ringtone === "outgoing_ringtone"
            ? "mp3"
            : "wav";
        const player = createAudioPlayer(`${API_BASE_URL}/sounds/${ringtone}.${ext}`);
        soundRef.current = player;
        player.play();
        const subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            subscription.remove();
            soundRef.current = null;
            setPreviewing(null);
          }
        });
      } catch {
        setPreviewing(null);
        Toast.show({ type: "error", text1: "Unable to preview tone." });
      }
    },
    [previewing],
  );

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch("/users/call-settings", settings);
      Toast.show({ type: "success", text1: "Call settings saved." });
    } catch {
      Toast.show({ type: "error", text1: "Failed to save call settings." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          paddingTop:
            Platform.OS === "ios"
              ? Math.max(insets.top, 44)
              : (StatusBar.currentHeight ?? 0) + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor,
          borderBottomWidth: 0.5,
          borderBottomColor: borderColor,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#111"} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Call Settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* ── Silent incoming calls ─────────────────────────── */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setSettings((s) => ({ ...s, silentIncomingCalls: !s.silentIncomingCalls }))
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 16,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${primaryColor}15`,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="volume-mute-outline" size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isDark ? "#f1f5f9" : "#0f172a",
                }}
              >
                Silent incoming calls
              </Text>
              <Text style={{ fontSize: 12, color: mutedIconColor, marginTop: 2 }}>
                Show calls without playing a ringtone.
              </Text>
            </View>
            <Switch
              value={settings.silentIncomingCalls}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, silentIncomingCalls: v }))
              }
              trackColor={{ false: borderColor, true: primaryColor }}
              thumbColor="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* ── Ringtones ─────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: mutedIconColor,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Ringtones
            </Text>
          </View>

          <SelectorRow
            icon="notifications-outline"
            label="Incoming ringtone"
            value={settings.incomingRingtone}
            onPress={() => setActivePicker("incoming")}
            primaryColor={primaryColor}
            mutedIconColor={mutedIconColor}
            borderColor={borderColor}
            isDark={isDark}
          />
          <View
            style={{ height: 0.5, backgroundColor: borderColor, marginHorizontal: 16 }}
          />
          <SelectorRow
            icon="call-outline"
            label="Outgoing ringback"
            value={settings.outgoingRingtone}
            onPress={() => setActivePicker("outgoing")}
            primaryColor={primaryColor}
            mutedIconColor={mutedIconColor}
            borderColor={borderColor}
            isDark={isDark}
          />
        </View>

        {/* ── Info card ─────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: `${primaryColor}08`,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: `${primaryColor}20`,
            padding: 14,
            flexDirection: "row",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={primaryColor}
            style={{ marginTop: 1 }}
          />
          <Text style={{ flex: 1, fontSize: 13, color: mutedIconColor, lineHeight: 19 }}>
            Ringtone changes apply to your next call. Tap the play button inside each
            picker to preview a tone before selecting.
          </Text>
        </View>

        {/* ── Save button ───────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={{
            backgroundColor: primaryColor,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Save settings
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Incoming ringtone picker ──────────────────────── */}
      <RingtoneModal
        visible={activePicker === "incoming"}
        title="Incoming Ringtone"
        selected={settings.incomingRingtone}
        previewing={previewing}
        onSelect={(v) => setSettings((s) => ({ ...s, incomingRingtone: v }))}
        onPreviewToggle={handlePreviewToggle}
        onClose={() => setActivePicker(null)}
        primaryColor={primaryColor}
        cardColor={cardColor}
        borderColor={borderColor}
        mutedIconColor={mutedIconColor}
        isDark={isDark}
      />

      {/* ── Outgoing ringtone picker ──────────────────────── */}
      <RingtoneModal
        visible={activePicker === "outgoing"}
        title="Outgoing Ringback"
        selected={settings.outgoingRingtone}
        previewing={previewing}
        onSelect={(v) => setSettings((s) => ({ ...s, outgoingRingtone: v }))}
        onPreviewToggle={handlePreviewToggle}
        onClose={() => setActivePicker(null)}
        primaryColor={primaryColor}
        cardColor={cardColor}
        borderColor={borderColor}
        mutedIconColor={mutedIconColor}
        isDark={isDark}
      />
    </View>
  );
}
