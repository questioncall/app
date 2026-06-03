import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  Animated as RNAnimated,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BottomSheetSurface } from "@/components/ui/bottom-sheet-surface";

import { FEED_FILTER_CHIPS } from "./FeedHeader";
import { useFeedColors } from "./tokens";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type FeedView =
  | "all"
  | "waiting"
  | "solved"
  | "media"
  | "discussion"
  | "physics"
  | "maths";
type FeedSort = "hot" | "new" | "discussed";

const SORT_OPTIONS: { value: FeedSort; label: string; icon: IoniconName }[] = [
  { value: "new", label: "New", icon: "time-outline" },
  { value: "hot", label: "Hot", icon: "flame-outline" },
  { value: "discussed", label: "Discussed", icon: "chatbubble-ellipses-outline" },
];

export function FeedFilterModal({
  activeSort,
  activeView,
  defaultSort,
  hasActiveFilters,
  modalSlide,
  onClose,
  onReset,
  onSortChange,
  onViewChange,
  questionCount,
  visible,
}: {
  activeSort: FeedSort;
  activeView: FeedView;
  defaultSort: FeedSort;
  hasActiveFilters: boolean;
  modalSlide: RNAnimated.Value;
  onClose: () => void;
  onReset: () => void;
  onSortChange: (sort: FeedSort) => void;
  onViewChange: (view: FeedView) => void;
  questionCount: number;
  visible: boolean;
}) {
  const FEED_COLORS = useFeedColors();
  const translateY = modalSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <RNAnimated.View style={{ transform: [{ translateY }] }}>
          <Pressable onPress={() => {}}>
            <BottomSheetSurface
              style={{
                backgroundColor: FEED_COLORS.page,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 20,
              }}
            >
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <View
                  style={{
                    height: 4,
                    width: 40,
                    borderRadius: 99,
                    backgroundColor: FEED_COLORS.chipBorder,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{ fontSize: 17, fontWeight: "800", color: FEED_COLORS.text }}
                >
                  Filters
                </Text>
                {hasActiveFilters ? (
                  <TouchableOpacity onPress={onReset}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: FEED_COLORS.green,
                      }}
                    >
                      Reset all
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text
                style={{
                  marginBottom: 8,
                  color: FEED_COLORS.faintMuted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.2,
                }}
              >
                VIEW
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {FEED_FILTER_CHIPS.map((opt) => {
                  const isActive = activeView === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onViewChange(opt.value)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isActive
                          ? FEED_COLORS.darkButton
                          : FEED_COLORS.chipBorder,
                        backgroundColor: isActive
                          ? FEED_COLORS.darkButton
                          : FEED_COLORS.page,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? "#fff" : FEED_COLORS.muted,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={{
                  marginBottom: 8,
                  color: FEED_COLORS.faintMuted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.2,
                }}
              >
                SORT
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = activeSort === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onSortChange(opt.value)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isActive ? "#CFE9DA" : FEED_COLORS.chipBorder,
                        backgroundColor: isActive
                          ? FEED_COLORS.greenSoft
                          : FEED_COLORS.page,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={13}
                        color={isActive ? FEED_COLORS.green : FEED_COLORS.softMuted}
                      />
                      <Text
                        style={{
                          color: isActive ? FEED_COLORS.greenDark : FEED_COLORS.muted,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.85}
                style={{
                  marginTop: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  paddingVertical: 14,
                  backgroundColor:
                    defaultSort === activeSort
                      ? FEED_COLORS.green
                      : FEED_COLORS.darkButton,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                  Apply · {questionCount} questions
                </Text>
              </TouchableOpacity>
            </BottomSheetSurface>
          </Pressable>
        </RNAnimated.View>
      </Pressable>
    </Modal>
  );
}
