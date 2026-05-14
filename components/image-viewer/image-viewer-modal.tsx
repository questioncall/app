import { useEffect } from "react";
import { Image, Modal, Pressable, useWindowDimensions } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const MAX_ZOOM = 4;
const SNAP_BACK_THRESHOLD = 1.05;

export function ImageViewerModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  // Pinch state — current scale + the scale at the start of the gesture.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  // Pan state — only meaningful while zoomed in.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  // Reset every time the modal is dismissed so the next open starts at 1×.
  useEffect(() => {
    if (!visible) {
      scale.value = 1;
      savedScale.value = 1;
      tx.value = 0;
      sx.value = 0;
      ty.value = 0;
      sy.value = 0;
    }
  }, [visible, scale, savedScale, tx, ty, sx, sy]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(1, Math.min(next, MAX_ZOOM));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= SNAP_BACK_THRESHOLD) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        sx.value = 0;
        ty.value = withTiming(0);
        sy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow panning when the image is zoomed in; otherwise the gesture
      // would feel weird against the static fit-to-screen image.
      if (scale.value > 1) {
        tx.value = sx.value + e.translationX;
        ty.value = sy.value + e.translationY;
      }
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        sx.value = 0;
        ty.value = withTiming(0);
        sy.value = 0;
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  // Pinch + (pan or double-tap) all at once. The Race between pan and
  // doubleTap stops a stray double-tap from registering as the start of a pan.
  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.97)" }}>
        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              { flex: 1, alignItems: "center", justifyContent: "center" },
              animStyle,
            ]}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width, height: height * 0.85 }}
                resizeMode="contain"
              />
            ) : null}
          </Animated.View>
        </GestureDetector>

        {/* Close button — top right, sits above the gesture surface */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute",
            top: 50,
            right: 18,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
