/**
 * GlobalUploadOverlay
 *
 * A floating overlay shown at the bottom of the screen whenever there are
 * active file uploads. Reads from the Redux upload slice. Survives
 * navigation between screens.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/store";
import { removeUpload } from "@/store/slices/uploadSlice";
import { useAppTheme } from "@/hooks/use-app-theme";

export function GlobalUploadOverlay() {
  const uploads = useSelector((state: RootState) => state.upload.uploads);
  const dispatch = useDispatch();
  const { primaryColor, cardColor, borderColor } = useAppTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const slideAnim = useRef(new Animated.Value(120)).current;

  const activeUploads = uploads.filter(
    (u) => u.status === "pending" || u.status === "uploading",
  );
  const visibleUploads = uploads.filter((u) => u.status !== "done");
  const hasVisible = visibleUploads.length > 0;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: hasVisible ? 0 : 120,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [hasVisible, slideAnim]);

  const getStatusIcon = useCallback(
    (status: string) => {
      switch (status) {
        case "pending":
        case "uploading":
          return <Ionicons name="cloud-upload" size={16} color={primaryColor} />;
        case "done":
          return <Ionicons name="checkmark-circle" size={16} color="#22C55E" />;
        case "failed":
          return <Ionicons name="close-circle" size={16} color="#EF4444" />;
        default:
          return null;
      }
    },
    [primaryColor],
  );

  if (uploads.length === 0) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 24,
        left: 12,
        right: 12,
        transform: [{ translateY: slideAnim }],
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: cardColor,
          borderColor,
          borderWidth: 1,
          borderRadius: 16,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {/* Header */}
        <TouchableOpacity
          onPress={() => setIsCollapsed((c) => !c)}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: isCollapsed ? 0 : 1,
            borderBottomColor: borderColor,
          }}
        >
          {activeUploads.length > 0 ? (
            <Ionicons name="cloud-upload" size={15} color={primaryColor} />
          ) : (
            <Ionicons name="checkmark-done" size={15} color="#22C55E" />
          )}
          <Text
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 12,
              fontWeight: "600",
            }}
            className="text-foreground"
          >
            {activeUploads.length > 0
              ? `Uploading ${activeUploads.length} file${activeUploads.length > 1 ? "s" : ""}…`
              : `${visibleUploads.length} upload${visibleUploads.length > 1 ? "s" : ""}`}
          </Text>
          <Ionicons
            name={isCollapsed ? "chevron-up" : "chevron-down"}
            size={14}
            color="#888"
          />
        </TouchableOpacity>

        {/* Job list */}
        {!isCollapsed &&
          visibleUploads.map((upload) => (
            <View
              key={upload.id}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: borderColor,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {getStatusIcon(upload.status)}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 12, fontWeight: "500" }}
                    className="text-foreground"
                  >
                    {upload.label || upload.uri.split("/").pop() || "File"}
                  </Text>
                  <Text
                    style={{ fontSize: 10, marginTop: 1 }}
                    className={
                      upload.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {upload.status === "failed"
                      ? upload.error || "Failed"
                      : upload.status === "uploading"
                        ? `${upload.progress}%`
                        : upload.status === "pending"
                          ? "Preparing…"
                          : "Complete"}
                  </Text>
                </View>

                {upload.status === "failed" && (
                  <TouchableOpacity
                    onPress={() => dispatch(removeUpload(upload.id))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#888" />
                  </TouchableOpacity>
                )}

                {(upload.status === "uploading" || upload.status === "pending") && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "600",
                      color: primaryColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {upload.progress}%
                  </Text>
                )}
              </View>

              {/* Progress bar */}
              {(upload.status === "uploading" || upload.status === "pending") && (
                <View
                  style={{
                    marginTop: 6,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: `${primaryColor}20`,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(2, upload.progress)}%`,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: primaryColor,
                    }}
                  />
                </View>
              )}
            </View>
          ))}
      </View>
    </Animated.View>
  );
}
