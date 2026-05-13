import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type DailyTarget = { target: number; bonus: number };

export default function DailyTargetScreen() {
  const user = useAppSelector((s) => s.user.data);
  const config = useAppSelector((s) => s.config.data);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [showInfo, setShowInfo] = useState(false);
  const [liveCount, setLiveCount] = useState(user?.dailyAnswersCount ?? 0);
  const [loading, setLoading] = useState(false);

  const dailyTargets: DailyTarget[] = config?.dailyTargets ?? [];
  const maxTarget = dailyTargets[dailyTargets.length - 1]?.target ?? 0;
  const achieved = user?.dailyTargetsAchieved ?? [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/me");
      setLiveCount(res.data?.dailyAnswersCount ?? liveCount);
    } catch {
      // keep current count
    } finally {
      setLoading(false);
    }
  }, [liveCount]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const progressPct = maxTarget > 0 ? Math.min(1, liveCount / maxTarget) : 0;

  const nextTarget = dailyTargets.find((t) => t.target > liveCount);
  const totalBonusEarned = dailyTargets
    .filter((t) => achieved.includes(t.target))
    .reduce((sum, t) => sum + t.bonus, 0);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: 24,
            fontWeight: "700",
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        >
          Daily Target
        </Text>
        <TouchableOpacity onPress={() => void refresh()} style={{ marginRight: 8 }}>
          {loading ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Ionicons name="refresh-outline" size={22} color={mutedIconColor} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowInfo(true)}>
          <Ionicons name="information-circle-outline" size={24} color={primaryColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={primaryColor}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Progress card */}
        <View
          style={{
            backgroundColor: primarySoftColor,
            borderRadius: 20,
            padding: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: isDark ? "#cbd5e1" : "#475569",
              }}
            >
              Today&apos;s Progress
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: primaryColor }}>
              {liveCount}
              <Text style={{ fontSize: 14, fontWeight: "500", color: mutedIconColor }}>
                {maxTarget > 0 ? ` / ${maxTarget}` : ""}
              </Text>
            </Text>
          </View>

          {/* Progress bar */}
          {maxTarget > 0 ? (
            <View
              style={{
                position: "relative",
                height: 10,
                backgroundColor: isDark ? "#334155" : "#e2e8f0",
                borderRadius: 5,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${progressPct * 100}%`,
                  backgroundColor: primaryColor,
                  borderRadius: 5,
                }}
              />
              {/* Tier markers */}
              {dailyTargets.map((t, i) => {
                const pct = (t.target / maxTarget) * 100;
                if (pct >= 100) return null;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      top: 0,
                      width: 2,
                      height: "100%",
                      backgroundColor: isDark ? "#1e293b" : "#fff",
                      zIndex: 2,
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {nextTarget ? (
            <Text style={{ marginTop: 10, fontSize: 13, color: mutedIconColor }}>
              {nextTarget.target - liveCount} more question
              {nextTarget.target - liveCount !== 1 ? "s" : ""} to earn +NPR{" "}
              {nextTarget.bonus} bonus
            </Text>
          ) : liveCount >= maxTarget && maxTarget > 0 ? (
            <Text
              style={{ marginTop: 10, fontSize: 13, color: "#22c55e", fontWeight: "600" }}
            >
              All targets achieved today!
            </Text>
          ) : null}

          {/* Total bonus earned today */}
          {totalBonusEarned > 0 ? (
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(34,197,94,0.12)",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={{ fontSize: 13, color: "#22c55e", fontWeight: "600" }}>
                NPR {totalBonusEarned} bonus earned today
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tier table */}
        {dailyTargets.length > 0 ? (
          <View
            style={{
              backgroundColor: cardColor,
              borderRadius: 16,
              borderWidth: 1,
              borderColor,
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Target
              </Text>
              <Text
                style={{
                  width: 80,
                  fontSize: 12,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Bonus
              </Text>
              <Text
                style={{
                  width: 70,
                  fontSize: 12,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  textAlign: "right",
                }}
              >
                Status
              </Text>
            </View>

            {dailyTargets.map((t, i) => {
              const isAchieved = liveCount >= t.target;
              const remaining = Math.max(0, t.target - liveCount);
              return (
                <View key={i}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      backgroundColor: isAchieved
                        ? "rgba(34,197,94,0.06)"
                        : "transparent",
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {isAchieved ? (
                        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={16}
                          color={mutedIconColor}
                        />
                      )}
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: isDark ? "#f1f5f9" : "#0f172a",
                        }}
                      >
                        {t.target} questions
                      </Text>
                    </View>
                    <View style={{ width: 80 }}>
                      <View
                        style={{
                          backgroundColor: "rgba(34,197,94,0.12)",
                          borderRadius: 20,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text
                          style={{ fontSize: 12, fontWeight: "700", color: "#16a34a" }}
                        >
                          +NPR {t.bonus}
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 70, alignItems: "flex-end" }}>
                      {isAchieved ? (
                        <Text
                          style={{ fontSize: 12, fontWeight: "700", color: "#22c55e" }}
                        >
                          Achieved
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: mutedIconColor }}>
                          {remaining} left
                        </Text>
                      )}
                    </View>
                  </View>
                  {i < dailyTargets.length - 1 ? (
                    <View
                      style={{
                        height: 1,
                        marginHorizontal: 16,
                        backgroundColor: borderColor,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Ionicons name="flag-outline" size={40} color={mutedIconColor} />
            <Text style={{ marginTop: 12, color: mutedIconColor, fontSize: 14 }}>
              No daily targets configured yet
            </Text>
          </View>
        )}

        {/* How it works */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: isDark ? "#f1f5f9" : "#0f172a",
              marginBottom: 10,
            }}
          >
            How it works
          </Text>
          {[
            "Solve questions throughout the day — each closed channel counts.",
            "When you hit a target, the bonus is automatically added to your wallet.",
            "All targets reset at midnight — bonuses are earned daily!",
            "You must be a monetized teacher to receive NPR bonuses.",
          ].map((line, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <Text style={{ color: primaryColor, fontWeight: "700", marginTop: 1 }}>
                •
              </Text>
              <Text
                style={{ flex: 1, fontSize: 13, color: mutedIconColor, lineHeight: 20 }}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          activeOpacity={1}
          onPress={() => setShowInfo(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: cardColor, borderRadius: 20, padding: 20 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Ionicons name="trophy-outline" size={20} color={primaryColor} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: isDark ? "#f1f5f9" : "#0f172a",
                }}
              >
                Daily Target Bonuses
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: mutedIconColor,
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              Earn bonus NPR by solving questions every day. The more you solve, the
              bigger the bonus!
            </Text>

            <View style={{ flexDirection: "row", marginBottom: 2, paddingHorizontal: 4 }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                }}
              >
                Target
              </Text>
              <Text
                style={{
                  width: 70,
                  fontSize: 11,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                }}
              >
                Bonus
              </Text>
              <Text
                style={{
                  width: 60,
                  fontSize: 11,
                  fontWeight: "700",
                  color: mutedIconColor,
                  textTransform: "uppercase",
                  textAlign: "right",
                }}
              >
                Status
              </Text>
            </View>

            {dailyTargets.map((t, i) => {
              const isAchieved = liveCount >= t.target;
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderTopWidth: 1,
                    borderTopColor: borderColor,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: "600",
                      color: isDark ? "#f1f5f9" : "#0f172a",
                    }}
                  >
                    {t.target} Qs
                  </Text>
                  <Text
                    style={{
                      width: 70,
                      fontSize: 13,
                      color: "#16a34a",
                      fontWeight: "600",
                    }}
                  >
                    +NPR {t.bonus}
                  </Text>
                  <Text
                    style={{
                      width: 60,
                      fontSize: 12,
                      textAlign: "right",
                      color: isAchieved ? "#22c55e" : mutedIconColor,
                      fontWeight: isAchieved ? "700" : "400",
                    }}
                  >
                    {isAchieved ? "✓ Done" : `${t.target - liveCount} left`}
                  </Text>
                </View>
              );
            })}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 16,
                padding: 12,
                backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 13, color: mutedIconColor }}>
                Today&apos;s progress
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: isDark ? "#f1f5f9" : "#0f172a",
                }}
              >
                {liveCount} / {maxTarget || "—"} questions
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowInfo(false)}
              style={{
                marginTop: 16,
                alignItems: "center",
                paddingVertical: 12,
                backgroundColor: primaryColor,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                Got it
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
