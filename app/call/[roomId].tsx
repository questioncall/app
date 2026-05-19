import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import { Audio } from "expo-av";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type VideoTrack as LKVideoTrack,
} from "livekit-client";
import { VideoView } from "@livekit/react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { api } from "@/lib/api";
import { useAppSelector } from "@/hooks/redux";
import {
  endCallKeepCall,
  reportCallConnected,
  preAcceptedCallRef,
  setSpeakerphone,
} from "@/lib/callkeep-setup";
import {
  consumeCallerPrewarm,
  consumeCalleePrewarm,
  consumePendingCreate,
} from "@/lib/call-prewarm";
import { hideFullScreenCallNotification } from "@/lib/full-screen-call-notification";
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
  teacherName?: string | null;
  studentName?: string | null;
  teacherImage?: string | null;
  studentImage?: string | null;
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
  const params = useLocalSearchParams<{
    roomId: string;
    channelId?: string;
    mode?: string;
    fromColdBoot?: string;
  }>();
  const routeRoomId = params.roomId;
  const pendingChannelId = params.channelId ?? null;
  const pendingModeParam = params.mode === "VIDEO" ? "VIDEO" : "AUDIO";
  const isPendingRoute = routeRoomId === "pending";
  // Cold-boot path: user tapped Accept on the full-screen call UI while the
  // app was killed. The native side fired a `questioncall://call/{id}?fromColdBoot=1`
  // deep link. No JS handler ran, so /accept hasn't been called on the server —
  // we have to do that here ourselves before connecting to LiveKit.
  // See: patches/react-native-full-screen-notification-incoming-call+1.1.0.patch
  const isFromColdBoot = params.fromColdBoot === "1";

  const userId = useAppSelector((s) => s.user.data?._id ?? null);

  // The resolved call-session id. When we navigate to /call/pending optimistically
  // from the workspace button, this stays null until the create POST resolves;
  // after that everything in this screen keys off resolvedRoomId.
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(
    isPendingRoute ? null : (routeRoomId ?? null),
  );
  const roomId = resolvedRoomId;

  // After a call ends the screen should always exit to the tabs, regardless
  // of how deep the navigation stack is.  Using router.canGoBack() here caused
  // an infinite-recursion crash (the replace_all that wired up this helper
  // accidentally replaced the router.back() call inside the definition itself,
  // turning it into a recursive call).  We now always replace to avoid both
  // the recursion and stacking up stale call screens in the back stack.
  const goBack = () => router.replace("/(tabs)/channels" as any);

  const [session, setSession] = useState<CallSession | null>(null);
  // For the optimistic-pending path we render the RINGING UI immediately and
  // never block on a "loading" spinner, so default to false there.
  const [loading, setLoading] = useState(!isPendingRoute);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // LiveKit state
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LKVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<LKVideoTrack | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  // Whether the local PiP is the fullscreen view (and remote sits in the corner)
  const [pipSwapped, setPipSwapped] = useState(false);

  // ── PiP drag ──────────────────────────────────────────────────────────────
  // The PiP is absolutely positioned anchored at bottom-right; the user can
  // grab it and drag it anywhere on the call surface.  translateX/Y are
  // offsets from that default position.  Bounds keep the whole PiP on screen.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const PIP_W = 110;
  const PIP_H = 150;
  const PIP_DEFAULT_BOTTOM = Platform.OS === "ios" ? 132 : 116;
  const PIP_DEFAULT_RIGHT = 16;
  const PIP_EDGE_PAD = 12;
  const PIP_TOP_SAFE = Platform.OS === "ios" ? 70 : 50;
  const pipMinX = -(screenW - PIP_W - PIP_DEFAULT_RIGHT - PIP_EDGE_PAD);
  const pipMaxX = 0;
  const pipMinY = -(screenH - PIP_H - PIP_DEFAULT_BOTTOM - PIP_TOP_SAFE);
  const pipMaxY = 0;

  const pipTranslateX = useSharedValue(0);
  const pipTranslateY = useSharedValue(0);
  const pipStartX = useSharedValue(0);
  const pipStartY = useSharedValue(0);

  const togglePipSwapped = useCallback(() => {
    setPipSwapped((s) => !s);
  }, []);

  const pipPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onStart(() => {
          pipStartX.value = pipTranslateX.value;
          pipStartY.value = pipTranslateY.value;
        })
        .onUpdate((e) => {
          const nx = pipStartX.value + e.translationX;
          const ny = pipStartY.value + e.translationY;
          pipTranslateX.value = Math.min(pipMaxX, Math.max(pipMinX, nx));
          pipTranslateY.value = Math.min(pipMaxY, Math.max(pipMinY, ny));
        })
        .onEnd(() => {
          // Soft spring settle so the corner doesn't feel rubbery on release
          pipTranslateX.value = withSpring(pipTranslateX.value, {
            damping: 20,
            stiffness: 200,
          });
          pipTranslateY.value = withSpring(pipTranslateY.value, {
            damping: 20,
            stiffness: 200,
          });
        }),
    [
      pipMaxX,
      pipMaxY,
      pipMinX,
      pipMinY,
      pipStartX,
      pipStartY,
      pipTranslateX,
      pipTranslateY,
    ],
  );

  const pipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pipTranslateX.value }, { translateY: pipTranslateY.value }],
  }));

  // ── Pulse ring animation for ringing screen ───────────────────────────────
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, [pulseOpacity, pulseScale]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // ── Peer info (other call participant) ───────────────────────────────────
  const peerName = session
    ? userId === session.teacherId
      ? (session.studentName ?? null)
      : (session.teacherName ?? null)
    : null;
  const peerImage = session
    ? userId === session.teacherId
      ? (session.studentImage ?? null)
      : (session.teacherImage ?? null)
    : null;
  const peerInitial = peerName ? peerName.charAt(0).toUpperCase() : null;

  // Refs to break the infinite-retry loop and enforce single-flight connections
  const connectingRef = useRef(false);
  const connectionBlockedRef = useRef(false);

  // OPT-6: Store token from accept response to skip separate /token fetch
  const prefetchedTokenRef = useRef<TokenPayload | null>(null);

  // Channel timer
  const [timerDeadline, setTimerDeadline] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [timeExtensionCount, setTimeExtensionCount] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);

  const endingRef = useRef(false);
  const acceptHandlerRef = useRef<() => Promise<void>>(async () => {});

  // ── Outgoing ringtone (for the caller while the callee hasn't answered) ───
  const outgoingRingtoneRef = useRef<Audio.Sound | null>(null);
  const stopOutgoingRingtone = useCallback(async () => {
    const sound = outgoingRingtoneRef.current;
    if (sound) {
      outgoingRingtoneRef.current = null;
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
    }
  }, []);

  // ── Pre-warmed room (caller or callee) ────────────────────────────────────
  // If the workspace pre-warmed a LiveKit room for this channel, or if the
  // realtime-bridge pre-warmed one from the incoming-call Pusher payload,
  // we hand it directly to LiveKit state below instead of doing room.connect()
  // again. Set once on first non-pending mount and consumed lazily.
  const prewarmedRoomRef = useRef<Room | null>(null);

  // ── Optimistic-pending bootstrap ──────────────────────────────────────────
  // When this screen was opened via the workspace call button we navigated
  // optimistically to /call/pending while POST /calls/create was still in
  // flight. Render the caller-ringing UI immediately, then swap to the real
  // session id once create resolves.
  useEffect(() => {
    if (!isPendingRoute || !pendingChannelId || !userId) return;
    if (resolvedRoomId) return; // already resolved

    // Show the "Calling…" UI right away with a synthetic session.
    setSession({
      callSessionId: "pending",
      channelId: pendingChannelId,
      callerId: userId,
      teacherId: "",
      studentId: "",
      mode: pendingModeParam,
      status: "RINGING" as CallStatus,
      roomName: `channel_${pendingChannelId}`,
    });

    const pending = consumePendingCreate(pendingChannelId);
    const createPromise =
      pending?.promise ??
      api.post("/calls/create", {
        channelId: pendingChannelId,
        mode: pendingModeParam,
      });

    let cancelled = false;
    createPromise
      .then((res: any) => {
        if (cancelled) return;
        const data = res?.data ?? {};
        const realId = data.callSessionId ?? data.id;
        if (!realId) {
          throw new Error("Server did not return a call session id.");
        }
        // Cache caller token so connectToRoom skips a separate /token fetch.
        if (data.token && data.serverUrl) {
          prefetchedTokenRef.current = {
            token: data.token,
            serverUrl: data.serverUrl,
            channelId: data.channelId ?? pendingChannelId,
            timerDeadline: data.timerDeadline,
            timeExtensionCount: data.timeExtensionCount ?? 0,
          };
        }
        setSession({
          callSessionId: realId,
          channelId: data.channelId ?? pendingChannelId,
          callerId: data.callerId ?? userId,
          teacherId: data.teacherId ?? "",
          studentId: data.studentId ?? "",
          mode: (data.mode ?? pendingModeParam) as "AUDIO" | "VIDEO",
          status: "RINGING" as CallStatus,
          roomName: data.roomName ?? `channel_${pendingChannelId}`,
        });
        setResolvedRoomId(realId);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message =
          err?.response?.data?.error ??
          (err instanceof Error ? err.message : "Failed to start call");
        Toast.show({ type: "error", text1: message });
        goBack();
      });

    return () => {
      cancelled = true;
    };
  }, [isPendingRoute, pendingChannelId, pendingModeParam, userId, resolvedRoomId]);

  // ── Session initialization (non-pending route) ────────────────────────────
  // Three entry paths, in priority order:
  //
  //   1. fromColdBoot=1   — user accepted from the killed-app full-screen UI;
  //                          server hasn't been told yet. POST /accept now.
  //   2. preAcceptedCallRef — JS-side acceptCall() in full-screen-notification.ts
  //                          already POSTed /accept and stashed the token.
  //   3. Plain fetch       — opened via channels list / notification tap; just
  //                          GET the session and let the user decide.
  useEffect(() => {
    if (isPendingRoute) return;
    if (!routeRoomId) return;
    hideFullScreenCallNotification();

    if (isFromColdBoot) {
      // Cold-boot accept path: native full-screen UI accept tap deep-linked us
      // here without the JS bridge ever running. We must call /accept ourselves
      // before LiveKit can join.
      console.log("[call] Cold-boot accept dispatch for", routeRoomId);
      api
        .post(`/calls/${routeRoomId}/accept`)
        .then((res) => {
          const data = res.data as {
            token?: string;
            serverUrl?: string;
            channelId?: string;
            timerDeadline?: string;
            timeExtensionCount?: number;
            mode?: "AUDIO" | "VIDEO";
            callerId?: string;
          };
          if (data?.token && data?.serverUrl) {
            prefetchedTokenRef.current = {
              token: data.token,
              serverUrl: data.serverUrl,
              channelId: data.channelId ?? "",
              timerDeadline: data.timerDeadline ?? "",
              timeExtensionCount: data.timeExtensionCount ?? 0,
            };
          }
          setSession({
            callSessionId: routeRoomId,
            channelId: data.channelId ?? "",
            callerId: data.callerId ?? null,
            mode: data.mode ?? "AUDIO",
            status: "ACTIVE" as CallStatus,
          } as CallSession);
        })
        .catch((err: any) => {
          const status = err?.response?.status;
          // 409 = already accepted on another device. Just fetch the session
          // and proceed — the call is live somewhere.
          if (status === 409) {
            return api
              .get(`/calls/${routeRoomId}`)
              .then((r) => setSession(r.data as CallSession));
          }
          // 410 / 404 = cancelled or already ended. Bail to channels with a
          // clear message instead of getting stuck on a "Connecting..." screen.
          if (status === 410 || status === 404) {
            Toast.show({ type: "info", text1: "Call already ended." });
            goBack();
            return;
          }
          console.error(
            "[call] Cold-boot accept failed:",
            err instanceof Error ? err.message : String(err),
          );
          Toast.show({
            type: "error",
            text1: "Couldn't join the call. Please try again.",
          });
          goBack();
        })
        .finally(() => setLoading(false));
      return;
    }

    const pre = preAcceptedCallRef.current;
    if (pre) {
      preAcceptedCallRef.current = null; // consume immediately
      prefetchedTokenRef.current = {
        token: pre.token,
        serverUrl: pre.serverUrl,
        channelId: pre.channelId,
        timerDeadline: pre.timerDeadline,
        timeExtensionCount: pre.timeExtensionCount,
      };
      // Pull in any pre-warmed callee room (started by realtime-bridge).
      const calleePrewarm = consumeCalleePrewarm(routeRoomId);
      if (calleePrewarm) {
        prewarmedRoomRef.current = calleePrewarm.room;
      }
      setSession({
        callSessionId: routeRoomId,
        channelId: pre.channelId,
        callerId: pre.callerId,
        mode: pre.mode,
        status: "ACTIVE" as CallStatus,
      } as CallSession);
      setLoading(false);
      return;
    }

    api
      .get(`/calls/${routeRoomId}`)
      .then((res) => setSession(res.data as CallSession))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[call] Failed to fetch session:", msg);
        Toast.show({
          type: "error",
          text1: "Couldn't load this call. Please try again.",
        });
      })
      .finally(() => setLoading(false));
     
  }, [isPendingRoute, routeRoomId, isFromColdBoot]);

  // ── Consume the caller-side pre-warmed room ───────────────────────────────
  // Workspace pre-warms `channel_${channelId}` while the user is in chat.
  // Pick it up here so room.connect() in connectToRoom() becomes a no-op.
  useEffect(() => {
    if (prewarmedRoomRef.current) return;
    const channelIdToConsume = session?.channelId;
    if (!channelIdToConsume) return;
    const slot = consumeCallerPrewarm(channelIdToConsume);
    if (slot) {
      prewarmedRoomRef.current = slot.room;
      // If the pre-warm endpoint returned a fresher token than the caller
      // got from /calls/create, prefer that one (covers the rare case where
      // create response had no token because LiveKit wasn't yet configured
      // at the moment of the POST).
      if (!prefetchedTokenRef.current) {
        prefetchedTokenRef.current = slot.token;
      }
    }
  }, [session?.channelId]);

  // ── Connect to LiveKit ─────────────────────────────────────────────────────
  // Supports both ACTIVE (both users) and RINGING (caller only, OPT-3).
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
      setConnectionError("Connection timed out — check your internet and try again.");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }, CONNECTION_TIMEOUT_MS);

    try {
      // OPT-6: Use prefetched token from accept response if available
      let data: TokenPayload;
      if (prefetchedTokenRef.current) {
        data = prefetchedTokenRef.current;
        prefetchedTokenRef.current = null;
      } else {
        const res = await api.get(`/calls/${roomId}/token`);
        data = res.data as TokenPayload;
      }

      if (timedOut) return;

      setChannelId(data.channelId);
      setTimerDeadline(data.timerDeadline);
      setTimeExtensionCount(data.timeExtensionCount);

      // Reuse a pre-warmed room if one is waiting. The WebSocket + DTLS
      // handshake (the slowest part of room.connect, ~1.5-3s) is already done
      // — we just attach our event listeners and skip straight to publishing.
      const prewarmed = prewarmedRoomRef.current;
      prewarmedRoomRef.current = null;
      const room = prewarmed ?? new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(track as LKVideoTrack);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(null);
      });
      room.on(RoomEvent.Disconnected, () => {
        // Immediately null out the ref so no further operations touch this room
        roomRef.current = null;
        setConnected(false);
        setLocalVideoTrack(null);
        setRemoteVideoTrack(null);
        if (!endingRef.current) {
          endingRef.current = true;
          goBack();
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
      if (prewarmed && prewarmed.state === ConnectionState.Connected) {
        // Pre-warm already finished — nothing to do.
      } else if (prewarmed && prewarmed.state === ConnectionState.Connecting) {
        // Pre-warm raced with accept; wait for the in-flight handshake.
        await new Promise<void>((resolve, reject) => {
          const onState = (state: ConnectionState) => {
            if (state === ConnectionState.Connected) {
              room.off(RoomEvent.ConnectionStateChanged, onState);
              resolve();
            } else if (state === ConnectionState.Disconnected) {
              room.off(RoomEvent.ConnectionStateChanged, onState);
              reject(new Error("Pre-warmed room disconnected before activation."));
            }
          };
          room.on(RoomEvent.ConnectionStateChanged, onState);
        });
      } else {
        // Cold path — no pre-warm, or pre-warm dropped — do the full connect.
        await room.connect(data.serverUrl, data.token);
      }

      if (timedOut) {
        room.disconnect();
        return;
      }

      // Pick up any remote tracks the pre-warmed room subscribed to before we
      // attached the listener above (race: caller publishes between callee
      // pre-warm-connect and callee accept).
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.track && pub.track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(pub.track as LKVideoTrack);
          }
        }
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
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (!timedOut) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Filter out NegotiationError from closed PC manager — this is
        // expected when the room was torn down during connection.
        const isStaleNegotiation = errMsg.includes("PC manager is closed");
        if (!isStaleNegotiation) {
          console.error("[call] Room connection failed:", errMsg);
          connectionBlockedRef.current = true;
          setConnectionError(
            "Couldn't connect to the call. Check your internet and try again.",
          );
        }
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

  // OPT-3: Caller can connect during RINGING; callee auto-accepts on RINGING
  useEffect(() => {
    if (connected || connecting || connectionError) return;
    if (session?.status === "ACTIVE") {
      void connectToRoom();
    } else if (session?.status === "RINGING" && session.callerId && userId) {
      if (session.callerId === userId) {
        // Caller pre-joins the LiveKit room while ringing
        void connectToRoom();
      } else {
        // Callee arrived at call screen (from overlay) — auto-accept
        void acceptHandlerRef.current();
      }
    }
  }, [
    session?.status,
    session?.callerId,
    userId,
    connected,
    connecting,
    connectionError,
    connectToRoom,
  ]);

  // ── Outgoing ringtone: play while RINGING for the caller ───────────────
  useEffect(() => {
    const status = session?.status;
    const callerId = session?.callerId;
    if (!status || !userId) return;

    const isCaller = callerId === userId;

    if (status === "RINGING" && isCaller) {
      const play = async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../../assets/sounds/outgoing_ringtone.mp3"),
            { shouldPlay: true, isLooping: true, volume: 1.0 },
          );
          outgoingRingtoneRef.current = sound;
        } catch (err) {
          console.warn("[call] Failed to play outgoing ringtone:", err);
        }
      };
      play();
    } else {
      // Status changed away from RINGING — stop the ringtone
      stopOutgoingRingtone();
    }

    return () => {
      stopOutgoingRingtone();
    };
  }, [session?.status, session?.callerId, userId, stopOutgoingRingtone]);

  const handleRetry = useCallback(() => {
    connectionBlockedRef.current = false;
    connectingRef.current = false;
    setConnectionError(null);
    void connectToRoom();
  }, [connectToRoom]);

  // ── Cleanup room on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopOutgoingRingtone();
      if (roomId) endCallKeepCall(roomId);
      const room = roomRef.current;
      if (room) {
        room.removeAllListeners();
        if (room.state !== ConnectionState.Disconnected) {
          room.disconnect();
        }
      }
      roomRef.current = null;
      // Pre-warmed room that we consumed but never promoted to roomRef
      // (e.g. user backed out before connectToRoom ran).
      const stale = prewarmedRoomRef.current;
      if (stale) {
        stale.removeAllListeners();
        if (stale.state !== ConnectionState.Disconnected) {
          stale.disconnect();
        }
        prewarmedRoomRef.current = null;
      }
    };
  }, [stopOutgoingRingtone, roomId]);

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
        goBack();
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
    setIsAccepting(true);
    try {
      const res = await api.post(`/calls/${session.callSessionId}/accept`);
      // OPT-6: Accept response includes token — store it so connectToRoom skips /token fetch
      const data = res.data as any;
      if (data?.token && data?.serverUrl) {
        prefetchedTokenRef.current = {
          token: data.token,
          serverUrl: data.serverUrl,
          channelId: data.channelId,
          timerDeadline: data.timerDeadline,
          timeExtensionCount: data.timeExtensionCount ?? 0,
        };
      }
      setSession((prev) => (prev ? { ...prev, status: "ACTIVE" } : prev));
      Vibration.cancel();
    } catch (err: unknown) {
      console.error(
        "[call] Accept failed:",
        err instanceof Error ? err.message : String(err),
      );
      Toast.show({ type: "error", text1: "Couldn't accept the call. Please try again." });
    } finally {
      setIsAccepting(false);
    }
  };
  acceptHandlerRef.current = handleAccept;

  const handleDecline = async () => {
    if (!session) return;
    setIsDeclining(true);
    try {
      await api.post(`/calls/${session.callSessionId}/reject`);
      Vibration.cancel();
      goBack();
    } catch (err: unknown) {
      console.error(
        "[call] Decline failed:",
        err instanceof Error ? err.message : String(err),
      );
      goBack();
    } finally {
      setIsDeclining(false);
    }
  };

  const handleEnd = async () => {
    if (!session || endingRef.current) return;
    stopOutgoingRingtone();
    endingRef.current = true;
    setIsEnding(true);

    // Caller pressed end while /calls/create was still in flight. We don't
    // have a real session id yet, so just bail to channels — the in-flight
    // POST will land and the server will mark the call MISSED when the
    // 30s RINGING timeout fires. (Could await + cancel for cleaner UX,
    // but this is a sub-second race window.)
    if (isPendingRoute && !resolvedRoomId) {
      setIsEnding(false);
      goBack();
      return;
    }

    endCallKeepCall(session.callSessionId);

    // Disconnect room FIRST to prevent NegotiationError from stale PC
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
    }

    try {
      // If the call is still RINGING and we are the caller, this is a
      // cancellation — use /cancel so the server broadcasts CALL_CANCELLED_EVENT
      // to the callee and their overlay dismisses immediately.
      const isCallerCancelling =
        session.status === "RINGING" && session.callerId === userId;
      const endpoint = isCallerCancelling
        ? `/calls/${session.callSessionId}/cancel`
        : `/calls/${session.callSessionId}/end`;
      await api.post(endpoint);
    } catch (err: unknown) {
      console.error(
        "[call] End/cancel call API failed:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsEnding(false);
      goBack();
    }
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room || room.state === ConnectionState.Disconnected) return;
    const next = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
    } catch (err: unknown) {
      console.warn(
        "[call] Toggle mic failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || room.state === ConnectionState.Disconnected) return;
    const next = !camEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamEnabled(next);
      if (next) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.track) setLocalVideoTrack(pub.track as LKVideoTrack);
      } else {
        setLocalVideoTrack(null);
      }
    } catch (err: unknown) {
      console.warn(
        "[call] Toggle camera failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const toggleSpeaker = async () => {
    if (!roomId) return;
    const next = !speakerOn;
    await setSpeakerphone(roomId, next);
    setSpeakerOn(next);
  };

  const facingModeRef = useRef<"user" | "environment">("user");
  const switchCamera = async () => {
    const room = roomRef.current;
    if (!room || room.state === ConnectionState.Disconnected) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.track && "restartTrack" in pub.track) {
      facingModeRef.current = facingModeRef.current === "user" ? "environment" : "user";
      try {
        await (pub.track as any).restartTrack({
          facingMode: facingModeRef.current,
        });
      } catch (err: unknown) {
        console.warn(
          "[call] Switch camera failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
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
    } catch {
      Toast.show({
        type: "error",
        text1: "Couldn't extend the call. Please try again.",
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
        <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
          <Text style={styles.whiteText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isIncoming = session.callerId !== null && session.callerId !== userId;
  const isVideo = session.mode === "VIDEO";

  const extensionsRemaining = Math.max(0, MAX_EXTENSIONS - timeExtensionCount);
  const canExtend =
    channelId != null &&
    countdown > 0 &&
    countdown <= WARNING_THRESHOLD_MS &&
    extensionsRemaining > 0;

  // ── Render: RINGING ───────────────────────────────────────────────────────
  if (session.status === "RINGING") {
    const gradientColors = isIncoming
      ? (["#0f0c29", "#302b63", "#24243e"] as const)
      : (["#0d1b2a", "#1b4332", "#0d1b2a"] as const);

    return (
      <LinearGradient colors={gradientColors} style={styles.ringingContainer}>
        <View style={styles.ringingTop}>
          {/* Pulsing ring behind avatar */}
          <View style={styles.avatarWrapper}>
            <Animated.View style={[styles.pulseRing, pulseRingStyle]} />
            <View style={styles.avatarCircle}>
              {peerImage ? (
                <Image source={{ uri: peerImage }} style={styles.avatarImage} />
              ) : peerInitial ? (
                <Text style={styles.avatarInitial}>{peerInitial}</Text>
              ) : (
                <Ionicons name={isVideo ? "videocam" : "call"} size={48} color="#fff" />
              )}
            </View>
          </View>

          {peerName ? <Text style={styles.peerNameText}>{peerName}</Text> : null}
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
                disabled={isDeclining}
                style={[styles.circleBtn, { backgroundColor: "#ef4444" }]}
              >
                {isDeclining ? (
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
                disabled={isAccepting}
                style={[styles.circleBtn, { backgroundColor: "#22c55e" }]}
              >
                {isAccepting ? (
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
            style={[styles.circleBtn, { backgroundColor: "#ef4444" }]}
          >
            <Ionicons
              name="call"
              size={32}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          </TouchableOpacity>
        )}
      </LinearGradient>
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
            <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
              <Text style={styles.whiteText}>Leave</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Render the active call UI as soon as we hit ACTIVE — even before the
    // LiveKit room finishes connecting. The user sees their own camera feed
    // (or a "Voice call" placeholder) instead of a black "Connecting…" screen,
    // and remote tracks pop in as they arrive. WhatsApp-style perceived speed.
    // No early return here; falls through to the layout below.

    // PiP / swap layout: by default the remote feed is fullscreen and the
    // local camera sits in the corner.  Tapping the PiP swaps them so the
    // local feed fills the screen and the remote feed becomes the overlay.
    const localAvailable = !!localVideoTrack && camEnabled;
    const remoteAvailable = !!remoteVideoTrack;
    const effectiveSwap = pipSwapped && localAvailable;
    const mainIsLocal = effectiveSwap;
    const mainTrack = mainIsLocal ? localVideoTrack : remoteVideoTrack;
    const pipIsLocal = !mainIsLocal;
    const pipTrackAvailable = pipIsLocal ? localAvailable : remoteAvailable;
    const pipTrack = pipIsLocal ? localVideoTrack : remoteVideoTrack;
    const showPip = isVideo && (localAvailable || remoteAvailable);

    return (
      <View style={styles.activeContainer}>
        {/* Main video (fullscreen) */}
        {mainTrack ? (
          <VideoView
            videoTrack={mainTrack}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
            mirror={mainIsLocal}
          />
        ) : (
          <LinearGradient
            colors={["#0d1b2a", "#1a1a2e", "#0f0c29"]}
            style={styles.noVideoPlaceholder}
          >
            {peerImage ? (
              <Image source={{ uri: peerImage }} style={styles.audioAvatarImage} />
            ) : peerInitial ? (
              <View style={styles.audioAvatarCircle}>
                <Text style={styles.audioAvatarInitial}>{peerInitial}</Text>
              </View>
            ) : (
              <Ionicons name="person" size={80} color="#ffffff30" />
            )}
            {peerName ? <Text style={styles.audioPeerName}>{peerName}</Text> : null}
            <Text style={styles.mutedText}>
              {isVideo ? "Waiting for video…" : "Voice call"}
            </Text>
          </LinearGradient>
        )}

        {/* PiP overlay — drag to reposition, tap to swap with main */}
        {showPip && (
          <GestureDetector gesture={pipPanGesture}>
            <Animated.View style={[styles.pipContainer, pipAnimatedStyle]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={togglePipSwapped}
                style={styles.pipTouchInner}
              >
                {pipTrackAvailable && pipTrack ? (
                  <VideoView
                    videoTrack={pipTrack}
                    style={styles.pipVideo}
                    objectFit="cover"
                    mirror={pipIsLocal}
                  />
                ) : (
                  <View style={[styles.pipVideo, styles.pipPlaceholder]}>
                    <Ionicons name="person" size={32} color="#ffffff40" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Camera-flip overlay on PiP (only when local camera is the PiP feed) */}
              {pipIsLocal && camEnabled && (
                <TouchableOpacity
                  onPress={switchCamera}
                  style={styles.pipFlipBtn}
                  hitSlop={8}
                >
                  <Ionicons name="camera-reverse" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </Animated.View>
          </GestureDetector>
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
            <Ionicons name={micEnabled ? "mic" : "mic-off"} size={22} color="#fff" />
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity
              onPress={toggleCam}
              style={[styles.controlBtn, !camEnabled && styles.controlBtnOff]}
            >
              <Ionicons
                name={camEnabled ? "videocam" : "videocam-off"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={toggleSpeaker}
            style={[styles.controlBtn, !speakerOn && styles.controlBtnOff]}
          >
            <Ionicons
              name={speakerOn ? "volume-high" : "volume-mute"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEnd}
            disabled={isEnding}
            style={styles.endCallBtn}
          >
            {isEnding ? (
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
      <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
        <Text style={styles.whiteText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#0d1b2a",
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 96,
    paddingHorizontal: 24,
  },
  ringingTop: {
    alignItems: "center",
    gap: 12,
  },
  avatarWrapper: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: "#ffffff60",
    backgroundColor: "transparent",
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "700",
  },
  peerNameText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  titleText: {
    color: "#ffffffb0",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 4,
  },
  subtitleText: {
    color: "#ffffff60",
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
  },
  audioAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#3b82f640",
    borderWidth: 2,
    borderColor: "#3b82f660",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  audioAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  audioAvatarInitial: {
    color: "#ffffffcc",
    fontSize: 42,
    fontWeight: "700",
  },
  audioPeerName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 4,
  },
  pipContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 132 : 116,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff30",
    backgroundColor: "#000",
    zIndex: 10,
    elevation: 10,
  },
  pipTouchInner: {
    flex: 1,
  },
  pipVideo: {
    flex: 1,
  },
  pipPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  pipFlipBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#00000090",
    alignItems: "center",
    justifyContent: "center",
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
    gap: 12,
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
