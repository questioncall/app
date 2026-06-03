import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The rounded card surface of a bottom-sheet modal.
 *
 * Bottom-sheet modals sit flush against the bottom of the screen, so their
 * action buttons end up underneath the Android system navigation bar (or the
 * iOS home indicator) unless we pad for it. This bakes in the live bottom
 * safe-area inset so the contents are never trimmed, on any device.
 *
 * Use it in place of the inner sheet `<View>`. `basePadding` is the gap you
 * want ABOVE the nav bar (i.e. the breathing room on a device with no inset);
 * the real inset is added on top of it. Any `paddingBottom` in `style` is
 * intentionally overridden — set the gap via `basePadding` instead.
 */
export function BottomSheetSurface({
  children,
  style,
  basePadding = 16,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  basePadding?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[style, { paddingBottom: basePadding + insets.bottom }]}>
      {children}
    </View>
  );
}
