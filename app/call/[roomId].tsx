import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type VideoTrack as LKVideoTrack,
} from "livekit-client";
import { VideoView } from "@livekit/react-native";

import { api } from "@/lib/api";
import { useAppSelector } from "@/hooks/redux";
import { endCallKeepCall, reportCallConnected } from "@/lib/callkeep-setup";
import {
  getPusherClient,
  getUserPusherName,
  getChannelPusherName,
  CALL_ACCEPTED_EVENT,
  CALL_REJECTED_EVENT,
  CALL_ENDED_EVENT,
  CALL_CANCELLED_EVENT,
  CHANNEL_TIMER_UPDATED_EVENT,
} from "@/lib/realtime";

type CallStatus = "RINGING" | "ACTIVE" | "ENDED" | "REJECTED" | "MISSED" | "CANCELLED";

type CallSession = {
  callSessionId: string;
  channelId: string;
  teacherId: string;
  studentId: string;
  callerId: string | null;
  status: CallStatus;
  mode: "AUDIO" | "VIDEO";
  roomName: string;
};

type TokenPayload = {
  token: string;
  serverUrl: string;
  channelId: string;
  timerDeadline: string;
  timeExtensionCount: number;
};

const EXTENSION_MINUTES = 5;
const MAX_EXTENSIONS = 3;
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;
const CONNECTION_TIMEOUT_MS = 20_000;

function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CallScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);

  const [session, setSession] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // LiveKit state
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LKVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<LKVideoTrack | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  // Refs to break the infinite-retry loop and enforce single-flight connections
  const connectingRef = useRef(false);
  const connectionBlockedRef = useRef(false);

  // Channel timer
  const [timerDeadline, setTimerDeadline] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [timeExtensionCount, setTimeExtensionCount] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);

  const endingRef = useRef(false);

  // ── Fetch call session ────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await api.get(`/calls/${roomId}`);
      setSession(res.data as CallSession);
    } catch {
      Toast.show({ type: "error", text1: "Could not load call session" });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  // ── Connect to LiveKit when call becomes ACTIVE ───────────────────────────
  const connectToRoom = useCallback(async () => {
    if (
      !roomId ||
      connectingRef.current ||
      connected ||
      endingRef.current ||
      connectionBlockedRef.current
    )
      return;
    connectingRef.current = true;
    setConnecting(true);
    setConnectionError(null);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      connectionBlockedRef.current = true;
      connectingRef.current = false;
      setConnecting(false);
      setConnectionError("Connection timed out. Check your network and try again.");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }, CONNECTION_TIMEOUT_MS);

    try {
      const res = await api.get(`/calls/${roomId}/token`);
      const data = res.data as TokenPayload;

      if (timedOut) return;

      setChannelId(data.channelId);
      setTimerDeadline(data.timerDeadline);
      setTimeExtensionCount(data.timeExtensionCount);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(track as LKVideoTrack);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(null);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (!endingRef.current) {
          endingRef.current = true;
          router.back();
        }
      });
      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video)
          setLocalVideoTrack(pub.track as LKVideoTrack);
      });
      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video) setLocalVideoTrack(null);
      });

      const isVideo = session?.mode === "VIDEO";
      await room.connect(data.serverUrl, data.token);

      if (timedOut) {
        room.disconnect();
        return;
      }

      await room.localParticipant.enableCameraAndMicrophone();

      if (!isVideo) {
        await room.localParticipant.setCameraEnabled(false);
        setCamEnabled(false);
      }

      const localVideoPub = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      if (localVideoPub?.track) setLocalVideoTrack(localVideoPub.track as LKVideoTrack);

      clearTimeout(timeoutId);
      setConnected(true);
      if (roomId) reportCallConnected(roomId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!timedOut) {
        const msg = err?.response?.data?.error ?? err?.message ?? "Connection failed";
        connectionBlockedRef.current = true;
        setConnectionError(msg);
        roomRef.current?.disconnect();
        roomRef.current = null;
      }
    } finally {
      if (!timedOut) {
        connectingRef.current = false;
        setConnecting(false);
      }
    }
  }, [roomId, connected, session?.mode]);

  useEffect(() => {
    if (session?.status === "ACTIVE" && !connected && !connecting && !connectionError) {
      void connectToRoom();
    }
  }, [session?.status, connected, connecting, connectionError, connectToRoom]);

  const handleRetry = useCallback(() => {
    connectionBlockedRef.current = false;
    connectingRef.current = false;
    setConnectionError(null);
    void connectToRoom();
  }, [connectToRoom]);

  // ── Cleanup room on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room && room.state !== ConnectionState.Disconnected) {
        room.disconnect();
      }
      roomRef.current = null;
    };
  }, []);

  // ── Channel timer countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (!timerDeadline) return;
    const update = () => {
      setCountdown(Math.max(0, new Date(timerDeadline).getTime() - Date.now()));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timerDeadline]);

  // ── Pusher: listen for call lifecycle + timer events ──────────────────────
  useEffect(() => {
    if (!userId || !roomId) return;
    const client = getPusherClient();
    if (!client) return;

    const userChannel = client.subscribe(getUserPusherName(userId));

    const handleAccepted = (payload: any) => {
      if (payload?.callSessionId !== roomId) return;
      setSession((prev) => (prev ? { ...prev, status: "ACTIVE" } : prev));
    };
    const handleRejected = (payload: any) => {
      if (payload?.callSessionId !== roomId) return;
      setSession((prev) => (prev ? { ...prev, status: "REJECTED" } : prev));
    };
    const handleCancelled = (payload: any) => {
      if (payload?.callSessionId !== roomId) return;
      setSession((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
    };

    userChannel.bind(CALL_ACCEPTED_EVENT, handleAccepted);
    userChannel.bind(CALL_REJECTED_EVENT, handleRejected);
    userChannel.bind(CALL_CANCELLED_EVENT, handleCancelled);

    return () => {
      userChannel.unbind(CALL_ACCEPTED_EVENT, handleAccepted);
      userChannel.unbind(CALL_REJECTED_EVENT, handleRejected);
      userChannel.unbind(CALL_CANCELLED_EVENT, handleCancelled);
    };
  }, [userId, roomId]);

  // Channel-scoped Pusher for timer updates + call ended
  useEffect(() => {
    const chId = channelId ?? session?.channelId;
    if (!chId) return;
    const client = getPusherClient();
    if (!client) return;

    const ch = client.subscribe(getChannelPusherName(chId));

    const handleTimerUpdate = (payload: any) => {
      if (payload?.timerDeadline) setTimerDeadline(payload.timerDeadline);
      if (typeof payload?.timeExtensionCount === "number")
        setTimeExtensionCount(payload.timeExtensionCount);
    };

    const handleEnded = (payload: any) => {
      if (payload?.callSessionId !== roomId) return;
      if (!endingRef.current) {
        endingRef.current = true;
        Toast.show({ type: "info", text1: "Call ended" });
        roomRef.current?.disconnect();
        router.back();
      }
    };

    ch.bind(CHANNEL_TIMER_UPDATED_EVENT, handleTimerUpdate);
    ch.bind(CALL_ENDED_EVENT, handleEnded);

    return () => {
      ch.unbind(CHANNEL_TIMER_UPDATED_EVENT, handleTimerUpdate);
      ch.unbind(CALL_ENDED_EVENT, handleEnded);
      client.unsubscribe(getChannelPusherName(chId));
    };
  }, [channelId, session?.channelId, roomId]);

  // ── Call actions ──────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!session) return;
    setActing(true);
    try {
      await api.post(`/calls/${session.callSessionId}/accept`);
      setSession((prev) => (prev ? { ...prev, status: "ACTIVE" } : prev));
      Vibration.cancel();
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to accept",
      });
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!session) return;
    setActing(true);
    try {
      await api.post(`/calls/${session.callSessionId}/reject`);
      Vibration.cancel();
      router.back();
    } catch {
      router.back();
    } finally {
      setActing(false);
    }
  };

  const handleEnd = async () => {
    if (!session || endingRef.current) return;
    endingRef.current = true;
    setActing(true);
    endCallKeepCall(session.callSessionId);
    try {
      await api.post(`/calls/${session.callSessionId}/end`);
    } catch {
      // best-effort
    } finally {
      roomRef.current?.disconnect();
      setActing(false);
      router.back();
    }
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
    if (next) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) setLocalVideoTrack(pub.track as LKVideoTrack);
    } else {
      setLocalVideoTrack(null);
    }
  };

  const facingModeRef = useRef<"user" | "environment">("user");
  const switchCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.track && "restartTrack" in pub.track) {
      facingModeRef.current = facingModeRef.current === "user" ? "environment" : "user";
      await (pub.track as any).restartTrack({
        facingMode: facingModeRef.current,
      });
    }
  };

  const handleExtendTime = async () => {
    if (!channelId || isExtending) return;
    setIsExtending(true);
    try {
      const res = await api.post(`/channels/${channelId}/extend`);
      setTimerDeadline(res.data.timerDeadline);
      setTimeExtensionCount(res.data.timeExtensionCount);
      Toast.show({ type: "success", text1: `Added ${EXTENSION_MINUTES} more minutes` });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to extend",
      });
    } finally {
      setIsExtending(false);
    }
  };

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Ionicons name="call-outline" size={56} color="#ffffff40" />
        <Text style={styles.mutedText}>Call not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.whiteText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isIncoming = session.callerId !== null && session.callerId !== userId;
  const isVideo = session.mode === "VIDEO";
  const isTerminal = ["ENDED", "REJECTED", "MISSED", "CANCELLED"].includes(
    session.status,
  );
  const extensionsRemaining = Math.max(0, MAX_EXTENSIONS - timeExtensionCount);
  const canExtend =
    channelId != null &&
    countdown > 0 &&
    countdown <= WARNING_THRESHOLD_MS &&
    extensionsRemaining > 0;

  // ── Render: RINGING ───────────────────────────────────────────────────────
  if (session.status === "RINGING") {
    return (
      <View style={styles.ringingContainer}>
        <View style={styles.ringingTop}>
          <View style={[styles.avatarCircle, { backgroundColor: "#2563eb" }]}>
            <Ionicons name={isVideo ? "videocam" : "call"} size={48} color="#fff" />
          </View>
          <Text style={styles.titleText}>
            {isIncoming ? "Incoming call" : "Calling…"}
          </Text>
          <Text style={styles.subtitleText}>{isVideo ? "Video call" : "Voice call"}</Text>
        </View>

        {isIncoming ? (
          <View style={styles.ringingButtons}>
            <View style={styles.ringingBtnGroup}>
              <TouchableOpacity
                onPress={handleDecline}
                disabled={acting}
                style={[styles.circleBtn, { backgroundColor: "#ef4444" }]}
              >
                {acting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons
                    name="call"
                    size={32}
                    color="#fff"
                    style={{ transform: [{ rotate: "135deg" }] }}
                  />
                )}
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Decline</Text>
            </View>
            <View style={styles.ringingBtnGroup}>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={acting}
                style={[styles.circleBtn, { backgroundColor: "#22c55e" }]}
              >
                {acting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
                )}
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Accept</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleEnd}
            disabled={acting}
            style={[styles.circleBtn, { backgroundColor: "#ef4444" }]}
          >
            {acting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name="call"
                size={32}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Render: ACTIVE — LiveKit room ─────────────────────────────────────────
  if (session.status === "ACTIVE") {
    if (connectionError) {
      return (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={56} color="#ffffff40" />
          <Text
            style={[
              styles.whiteText,
              { fontSize: 18, fontWeight: "600", marginTop: 16, textAlign: "center" },
            ]}
          >
            Failed to connect
          </Text>
          <Text
            style={[
              styles.mutedText,
              { textAlign: "center", fontSize: 14, marginTop: 4 },
            ]}
          >
            {connectionError}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
            <TouchableOpacity
              onPress={handleRetry}
              style={[styles.backBtn, { backgroundColor: "#3b82f660" }]}
            >
              <Text style={styles.whiteText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.whiteText}>Leave</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (connecting || !connected) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={[styles.mutedText, { marginTop: 12 }]}>Connecting to room…</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { marginTop: 32 }]}
          >
            <Text style={[styles.mutedText, { marginTop: 0, fontSize: 14 }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.activeContainer}>
        {/* Remote video (full screen) */}
        {remoteVideoTrack ? (
          <VideoView
            videoTrack={remoteVideoTrack}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
          />
        ) : (
          <View style={styles.noVideoPlaceholder}>
            <Ionicons name="person" size={80} color="#ffffff30" />
            <Text style={styles.mutedText}>
              {isVideo ? "Waiting for video…" : "Voice call"}
            </Text>
          </View>
        )}

        {/* Local video (PiP) */}
        {localVideoTrack && camEnabled && (
          <View style={styles.pipContainer}>
            <VideoView
              videoTrack={localVideoTrack}
              style={styles.pipVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Top bar: timer + extend */}
        <View style={styles.topBar}>
          <View style={styles.timerPill}>
            <Ionicons
              name="time-outline"
              size={14}
              color={countdown <= WARNING_THRESHOLD_MS ? "#fbbf24" : "#ffffffb0"}
            />
            <Text
              style={[
                styles.timerText,
                countdown <= WARNING_THRESHOLD_MS && { color: "#fbbf24" },
              ]}
            >
              {formatCountdown(countdown)}
            </Text>
          </View>
          {canExtend && (
            <TouchableOpacity
              onPress={handleExtendTime}
              disabled={isExtending}
              style={styles.extendBtn}
            >
              {isExtending ? (
                <ActivityIndicator color="#fbbf24" size="small" />
              ) : (
                <Text style={styles.extendText}>+{EXTENSION_MINUTES}m</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.controlBar}>
          <TouchableOpacity
            onPress={toggleMic}
            style={[styles.controlBtn, !micEnabled && styles.controlBtnOff]}
          >
            <Ionicons name={micEnabled ? "mic" : "mic-off"} size={24} color="#fff" />
          </TouchableOpacity>

          {isVideo && (
            <>
              <TouchableOpacity
                onPress={toggleCam}
                style={[styles.controlBtn, !camEnabled && styles.controlBtnOff]}
              >
                <Ionicons
                  name={camEnabled ? "videocam" : "videocam-off"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={switchCamera} style={styles.controlBtn}>
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={handleEnd}
            disabled={acting}
            style={styles.endCallBtn}
          >
            {acting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name="call"
                size={28}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Ended / Rejected / Missed ─────────────────────────────────────
  return (
    <View style={styles.centered}>
      <Ionicons name="call-outline" size={56} color="#ffffff40" />
      <Text
        style={[styles.whiteText, { fontSize: 20, fontWeight: "600", marginTop: 16 }]}
      >
        {session.status === "MISSED"
          ? "Call missed"
          : session.status === "REJECTED"
            ? "Call declined"
            : "Call ended"}
      </Text>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.whiteText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  mutedText: {
    color: "#ffffff60",
    fontSize: 16,
    marginTop: 16,
  },
  whiteText: {
    color: "#fff",
    fontSize: 16,
  },
  backBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#ffffff18",
    borderRadius: 999,
  },

  // Ringing
  ringingContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 96,
    paddingHorizontal: 24,
  },
  ringingTop: {
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
  },
  subtitleText: {
    color: "#ffffff80",
    fontSize: 14,
  },
  ringingButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  ringingBtnGroup: {
    alignItems: "center",
    gap: 10,
  },
  circleBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: {
    color: "#ffffff90",
    fontSize: 13,
  },

  // Active
  activeContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  noVideoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  pipContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 48,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff30",
    zIndex: 10,
    elevation: 10,
  },
  pipVideo: {
    flex: 1,
  },

  // Top bar
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00000080",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  timerText: {
    color: "#ffffffb0",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  extendBtn: {
    backgroundColor: "#78350f80",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fbbf2440",
  },
  extendText: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "600",
  },

  // Bottom controls
  controlBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 48 : 32,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    zIndex: 10,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ffffff25",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnOff: {
    backgroundColor: "#ffffff10",
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
});
