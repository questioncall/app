import { useEffect } from "react";
import { router } from "expo-router";

// Silently redirect any unmatched route to the feed tab.
export default function NotFound() {
  useEffect(() => {
    router.replace("/(tabs)/feed");
  }, []);

  return null;
}
