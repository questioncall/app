# 📱 QuestionCall Mobile App — Step-by-Step Developer Plan

> **API Base URL:** `https://questioncall.com/api`
>
> Every API call below is relative to this base. Example: `POST /api/auth/register` → `https://questioncall.com/api/auth/register`
>
> **Platform:** Android only for now. iOS builds will be done at final stage.
> **Auth Provider:** Google Sign-In only (no Apple Sign-In).
> **Payments:** eSewa/Khalti only (no Apple IAP needed — Nepal market only).
>
> **Auth Header (after login):** `Authorization: Bearer <token>` on every request.

---

## 🚨 Missing Items Found in Web Codebase (NOT in Handoff Doc)

> [!IMPORTANT]
> These API routes exist on the backend but were **NOT documented** in the handoff. The app developer must account for them.

| # | Missing Route | Purpose |
|---|--------------|---------|
| 1 | `GET /api/answers` | Fetch answer for a question (used in workspace) |
| 2 | `GET /api/search` | Search questions/courses/teachers |
| 3 | `GET /api/filters/options` | Get filter dropdown options (subjects, levels, streams) |
| 4 | `GET /api/user/subscription` | Get current user's subscription status |
| 5 | `GET /api/user/referral` | Get current user's referral info |
| 6 | `POST /api/channels/[id]/extend` | Extend channel deadline |
| 7 | `POST /api/channels/[id]/mark-answer` | Mark a message as the answer |
| 8 | `GET /api/channels/[id]/messages` | Paginated message history |
| 9 | `POST /api/channels/[id]/rate` | Submit rating (separate from close) |
| 10 | `POST /api/channels/[id]/read` | Mark channel as read |
| 11 | `GET /api/courses/[id]/enrollments` | Get enrollments for a course |
| 12 | `GET /api/courses/[id]/progress` | Get watch progress |
| 13 | `POST /api/courses/[id]/purchase` | Purchase a course (separate from enroll) |
| 14 | `GET /api/courses/[id]/sections` | Get course sections |
| 15 | `GET /api/courses/[id]/videos` | Get course videos |
| 16 | `GET /api/courses/[id]/live-sessions` | Get live sessions for course |
| 17 | `GET /api/courses/coupons` | List coupons |
| 18 | `POST /api/courses/coupons/validate` | Validate a coupon code before applying |
| 19 | `POST /api/calls/create` | Create a call (**NOT** `/api/calls/initiate` as doc says) |
| 20 | `POST /api/calls/[id]/cancel` | Cancel a call |
| 21 | `POST /api/calls/[id]/end` | End an active call |
| 22 | `POST /api/calls/[id]/missed` | Mark call as missed |
| 23 | `GET /api/calls/[id]/token` | Get LiveKit token for a call |
| 24 | `POST /api/quiz/start` | Start a quiz session |
| 25 | `GET /api/quiz/topics` | List quiz topics |
| 26 | `GET /api/quiz/history` | User's quiz history |
| 27 | `GET /api/quiz/[sessionId]` | Get quiz session details |
| 28 | `POST /api/quiz/[sessionId]/submit` | Submit quiz answers |
| 29 | `POST /api/quiz/[sessionId]/auto-submit` | Auto-submit (anti-cheat) |
| 30 | `POST /api/quiz/[sessionId]/progress` | Save quiz progress mid-session |
| 31 | `GET /api/questions/[id]/comments` | Peer comments on a question |

> [!WARNING]
> The handoff doc says `POST /api/calls/initiate` but the actual route is `POST /api/calls/create`. Similarly, call actions use `/api/calls/[id]/accept` not `/api/calls/accept`. **Use the actual routes above.**

---

## Step 1: Pre-Flight Decisions (Sprint 0 — Days 1-3)

> Resolve ALL blocking decisions before writing any feature code.

- [x] **Decision 1 — Apple IAP:** ✅ NOT NEEDED. Nepal market only, eSewa/Khalti is fine. No IAP integration.
- [x] **Decision 2 — JWT Strategy:** ✅ Access token = 15 min, refresh token = 30 days.
- [x] **Decision 3 — Withdrawal Lock:** ✅ `nprEquivalent` is locked at request creation time.
- [x] **Decision 4 — Sign in with Apple:** ✅ NOT IN SCOPE. Google Sign-In only.
- [x] **Decision 5 — Platform:** ✅ Android only for now. iOS at final stage.
- [x] **Decision 6 — Backend work needed (see TODO.md):** Web team built these 2 endpoints FIRST:
  - `POST /api/mobile/login` → returns `{ accessToken, refreshToken }`
  - `POST /api/mobile/refresh` → returns new access token
- [x] **Decision 7 — Push platform field (see TODO.md):** Web team added `platform` field (web/ios/android) to `PushSubscription` model

---

## Step 2: Project Bootstrap (Sprint 0 — Days 3-5)

- [x] Run `npx create-expo-app` with `expo-router` + TypeScript
- [x] Install & configure NativeWind, extract theme tokens from web `globals.css`
- [x] Set up Redux Toolkit with **7 slices**: `auth`, `user`, `feed`, `channel`, `channels`, `upload`, `config`
- [x] Install & configure **Sentry** for crash reporting (`EXPO_PUBLIC_SENTRY_DSN`)
- [x] Configure EAS Build with 3 profiles: `development`, `staging`, `production`
- [x] Set up `.env` files per profile:
  ```env
  EXPO_PUBLIC_API_URL=https://questioncall.com/api
  EXPO_PUBLIC_PUSHER_KEY=<key>
  EXPO_PUBLIC_PUSHER_CLUSTER=<cluster>
  EXPO_PUBLIC_LIVEKIT_URL=<url>
  EXPO_PUBLIC_ESEWA_MERCHANT_ID=<id>
  EXPO_PUBLIC_KHALTI_PUBLIC_KEY=<key>
  ```
- [ ] Add ESLint + Prettier + Husky pre-commit hook
- [x] Copy `types/` folder from web repo into mobile codebase (just copy, no sync mechanism needed)
- [ ] **Verify:** App boots to blank screen, Sentry receives test crash, EAS build succeeds on **Android**

---

## Step 3: Auth — Landing & Login Screens (Sprint 1 — Week 1)

- [x] Build **Phase 1 — Landing Screen** (full-screen, no tabs):
  - Logo + tagline ("Get expert answers in 15 minutes")
  - Two CTAs: "Sign Up" (primary) + "Sign In" (secondary)
  - Skip if valid JWT exists in `expo-secure-store` → go to Phase 3
- [x] Build **Phase 2 — Sign Up Screen:**
  - Fields: `name`, `email`, `password`, `role` (STUDENT/TEACHER toggle)
  - Optional referral code (pre-fill from deep link `questioncall://register?ref=CODE`)
  - Call `POST /api/auth/register`
  - Show email verification pending screen
- [x] Build **Phase 2 — Sign In Screen:**
  - Fields: `email`, `password`
  - Call `POST /api/mobile/login` → store tokens in `expo-secure-store`
  - Navigate to Phase 3, clear auth stack
- [x] Implement **Google Sign-In** via `expo-auth-session`
- ~~Sign in with Apple~~ — **NOT IN SCOPE** (Android only, Google Sign-In only)
- [x] Build **Forgot Password** screen → `POST /api/auth/forgot-password`
- [x] Build **Email Verification Pending** screen with deep link handler

---

## Step 4: Auth — JWT, Session & Security Gate (Sprint 1 — Week 1-2)

- [x] Write **Axios interceptor** that:
  1. Attaches `Authorization: Bearer <accessToken>` to every request
  2. On 401 → calls `POST /api/mobile/refresh` silently
  3. If refresh works → retries original request with new token
  4. If refresh fails → clears all tokens → navigates to Landing
- [x] Store both `accessToken` and `refreshToken` in `expo-secure-store` (NEVER AsyncStorage)
- [x] Fetch **PlatformConfig** on launch: `GET /api/platform/config`
  - Cache in Redux `config` slice with 1-hour TTL
  - Refresh on every cold start + foreground if stale
  - Show blocking splash until first load completes
- [x] **Suspension check:** On every foreground + after login:
  - Call `GET /api/mobile/me` → hydrates full user in Redux, checks `isSuspended`
  - If 403 → navigate to `suspended.tsx` (full-screen blocker, cannot dismiss)
  - Only options: "Contact Support" and "Sign Out"
- [ ] **Verify:** Sign up → verify email → log in → see empty home. Suspend test user → app shows blocker.

---

## Step 5: Navigation Shell & Menu (Sprint 2 — Week 3)

- [x] Build **5-tab bottom navigator:**

  | Tab | Icon | Label | Notes |
  |-----|------|-------|-------|
  | 1 | 📋 | Feed | Default tab |
  | 2 | 📢 | Channels | Active conversations |
  | 3 | ➕ | Ask/Actions | **Elevated center button**, accent-colored |
  | 4 | 📚 | Courses | Course library |
  | 5 | ☰ | Menu | Catch-all |

- [x] Tab 3 label changes by role: "Ask" for students, "Actions" for teachers
- [x] Build **Menu tab** with all sections:
  - Profile: Avatar, name, role badge, Edit Profile, My Activity
  - Wallet & Transactions: Balance, Withdraw, Transaction History, Daily Target
  - Services: Course Studio, AI Quizzes, Leaderboard, Referrals, Notices
  - Account: Plans, Notifications, Call Settings, Onboarding Videos, Terms, Privacy, Change Password, Theme toggle
  - Danger Zone: Sign Out, Delete Account
- [x] Build **Profile Edit** screen + **Activity** stats screen (stubs — content in Sprint 2)
- [ ] Wire global **Pusher** connection with exponential backoff reconnect (max 30s)
- [ ] Subscribe to `user-${userId}` Pusher channel

---

## Step 6: Onboarding & Notices (Sprint 2 — Week 3)

- [ ] Build **Onboarding video screen:**
  - Fetch from `GET /api/onboarding-video`
  - Play once per role, mark `seenOnboardingRoles` on completion
  - Allow re-watch from Menu
- [ ] Build **Admin notice system:**
  - On every foreground: fetch unseen notices from `GET /api/notices`
  - Show dismissible modal for highest-priority notice
  - Mark seen via `User.seenNotices`
- [ ] **Verify:** All 5 tabs render, profile editable, onboarding plays on first login, notices display/dismiss.

---

## Step 7: Student Question Posting (Sprint 3 — Week 4)

- [ ] Build **Ask tab (Student):**
  - Question form: title (6-180 chars), body (≤5000), image picker
  - Selectors: `answerFormat` (TEXT/PHOTO/VIDEO/ANY), `answerVisibility` (PUBLIC/PRIVATE)
  - Subject, stream, level selectors → **use `GET /api/filters/options`** for dropdown data
  - Remaining quota badge: `effectiveLimit = maxQuestions + bonusQuestions`
  - When quota = 0 → replace submit with "Upgrade Plan" CTA
- [ ] **Optimistic UI:** Show question in "My Questions" immediately with "Posting..." badge
- [ ] Call `POST /api/questions` to submit
- [ ] Delete question → `DELETE /api/questions/[id]` → decrements `questionsAsked`

---

## Step 8: Teacher Question Feed (Sprint 3 — Week 4)

- [ ] Build **Feed tab (Teacher):**
  - FlatList with pull-to-refresh + infinite scroll
  - Call `GET /api/questions/feed`
  - Sort: `resetCount` desc, then `createdAt` desc
  - Show "Attempt X of Y" badge on reset questions
  - Accept button → confirmation modal showing countdown duration
- [ ] Real-time feed: subscribe to Pusher `questions-feed` channel for new question inserts
- [ ] On accept → `POST /api/questions/[id]/accept`
  - Schedule **local notification** at T-60s warning timer almost up
- [ ] **Verify:** Student posts → appears in teacher feed within 2s → teacher accepts → countdown starts.

---

## Step 9: Chat Workspace (Sprint 4 — Week 5)

- [ ] Build **Channels tab:**
  - List with last-message preview, unread badges, channel status
  - Call `GET /api/channels`
  - Mark read → `POST /api/channels/[id]/read`
- [ ] Build **Workspace screen** (`/workspace/[channelId]`):
  - WhatsApp-style FlatList with `inverted={true}`
  - Fetch history: `GET /api/channels/[id]/messages` (paginated)
  - Send text/image/file messages
  - Mark answer: `POST /api/channels/[id]/mark-answer`
  - Extend deadline: `POST /api/channels/[id]/extend`
- [ ] **Pusher real-time:** Subscribe to `channel-${channelId}`
  - Bind events: `channel:message`, `message:marked`, `message:deleted`
- [ ] **Message retry queue (MANDATORY):**
  - Queue failed messages in Redux + AsyncStorage
  - Show "Sending..." state
  - Retry on network return
- [ ] **Fetch answer:** `GET /api/answers` for viewing submitted answers

---

## Step 10: Close Channel & Rating (Sprint 4 — Week 5-6)

- [ ] **Close Channel flow:**
  - Confirmation → `POST /api/channels/[id]/close`
  - 5-star rating modal (student) → `POST /api/channels/[id]/rate`
  - Handle channel disappearing from active list gracefully
- [ ] **Verify:** Two accounts chat in real time, send images, close, rate, point balances update.

---

## Step 11: Wallet & Biometric Security (Sprint 5 — Week 6-7)

- [ ] **Biometric gate:** Use `expo-local-authentication`
  - Required before accessing Wallet, Transaction History, or Withdrawal
  - If no biometrics enrolled → fallback to account password re-entry
- [ ] Build **Wallet screen:**
  - Show `pointBalance` + NPR equivalent (`points × pointToNprRate`)
  - Transaction history with type badges and filters
  - Pending withdrawal status card with locked NPR rate
- [ ] **Screenshot prevention:**
  - Android: Apply `FLAG_SECURE` on wallet/withdrawal screens
  - iOS: Detect only via `UIApplicationUserDidTakeScreenshotNotification`, log/warn — **cannot block**

---

## Step 12: Withdrawal Flow (Sprint 5 — Week 7)

- [ ] Build **Withdrawal screen:**
  - Enter amount + eSewa number
  - Enforce `minWithdrawalPoints` from PlatformConfig
  - Block if PENDING request exists (proactive UI check)
  - Allow saving eSewa number (`saveEsewaNumber` flag)
  - Show locked NPR rate on confirmation
- [ ] Call `POST /api/wallet/withdraw`
  - Handle HTTP 400 / Mongo 11000 duplicate error gracefully
- [ ] Show "Pending Request Exists" state and disable withdraw button
- [ ] **Verify:** Teacher requests withdrawal → sees pending status → admin approves → balance updates.

---

## Step 13: Subscription Plans & Manual Payments (Sprint 5 — Week 7)

- [ ] Build **Subscription Plans screen:**
  - Compare all plans (Free, Go, Plus, Pro, Max) with current quota
  - Show current plan highlighted
  - Call `GET /api/user/subscription` for current status
- [ ] Build **Manual Payment screen:**
  - Show admin eSewa number + QR from `PlatformConfig.manualPaymentQrCodeUrl`
  - Capture: transaction ID, transactor name, optional screenshot
  - Submit as `multipart/form-data` → `POST /api/payments/manual`
  - Handle 409 (duplicate completed) with clear error message
- [ ] **Push notifications setup (FCM/APNs):**
  - Register token → `POST /api/push` with `platform: "ios"` or `"android"`
  - Handle push types: `withdrawal:processed`, `subscription:activated`, `monthly:bonus`, `daily:target`
  - Tap → deep link to wallet

---

## Step 14: Payment Gateways (Sprint 6 — Week 8)

- [ ] Build **eSewa WebView flow:**
  - Initiate → `POST /api/payments/esewa/initiate` → get redirect URL
  - Open in `react-native-webview`
  - Intercept success/failure redirect via URL pattern matching
  - Verify on backend: `GET /api/payments/esewa/verify`
  - Deep link fallback: `questioncall://payment/success`
- [ ] Build **Khalti WebView flow:** Same pattern, verify via `GET /api/payments/khalti/course-verify`
- [ ] **NEVER trust client-side redirect alone — always verify on backend**

---

## Step 15: Courses (Sprint 6 — Week 8-9)

- [ ] Build **Courses tab:**
  - Course library → `GET /api/courses`
  - Search → `GET /api/search`
- [ ] Build **Course Detail screen:**
  - Fetch: `GET /api/courses/[id]`
  - Sections: `GET /api/courses/[id]/sections`
  - Videos: `GET /api/courses/[id]/videos`
  - Enrollment badges per access type (FREE, SUBSCRIPTION, COUPON, PURCHASE)
- [ ] **Video playback** with `expo-video` (HLS/Mux streams):
  - Watch-time tracking: ping `POST /api/courses/[id]/progress` every 10s
  - Pause on AppState background or video pause
  - Enforce 90% threshold for section completion
- [ ] **Coupon system:**
  - "Apply Coupon" input on purchase screens
  - Validate: `POST /api/courses/coupons/validate`
  - Purchase: `POST /api/courses/[id]/purchase`
  - Enroll (free/subscription): `POST /api/courses/[id]/enroll`
- [ ] **Live Sessions:** Deep link to Zoom via `zoomus://` with HTTPS fallback
  - Fetch: `GET /api/courses/[id]/live-sessions`

---

## Step 16: AI Quizzes & Anti-Cheat (Sprint 6 — Week 9)

- [ ] Build **Quiz screen:**
  - List topics: `GET /api/quiz/topics`
  - Start session: `POST /api/quiz/start`
  - Timer + question navigation
  - Save progress: `POST /api/quiz/[sessionId]/progress`
  - Submit: `POST /api/quiz/[sessionId]/submit`
  - Quiz history: `GET /api/quiz/history`
- [ ] **Anti-cheat with grace period:**
  - `AppState` → background/inactive = `TAB_HIDDEN` violation
  - Android hardware back button = `BACK_NAVIGATION` violation
  - **Grace window:** If app returns within 2 seconds → do NOT log violation
  - Ignore first background within 500ms of quiz start
  - Skip `FULLSCREEN_EXIT` and `DUPLICATE_TAB` entirely
  - Auto-submit → `POST /api/quiz/[sessionId]/auto-submit` when `violationCount >= violationWarningLimit`
  - Show warning modal at every violation
- [ ] All quiz config from PlatformConfig: `quizQuestionCount`, `quizTimeLimitSeconds`, etc.

---

## Step 17: Video & Audio Calls (Sprint 7 — Week 10)

- [ ] Install `@livekit/components-react-native`, configure permissions in `app.json`
- [ ] **Incoming call flow:**
  - Teacher taps "Call" → `POST /api/calls/create`
  - Pusher broadcasts `call:incoming` → high-priority push notification
  - Full-screen incoming call UI with ringtone (even when backgrounded)
  - Accept → `POST /api/calls/[id]/accept` → fetch token `GET /api/calls/[id]/token` → connect
  - Reject → `POST /api/calls/[id]/reject`
  - Missed → `POST /api/calls/[id]/missed`
  - Cancel → `POST /api/calls/[id]/cancel`
  - End → `POST /api/calls/[id]/end`
- [ ] **Active call UI:** Video tiles, mute, speaker toggle, end call button
- [ ] Handle `expire-calls` cron: graceful sudden termination
- [ ] **Call Settings** in Menu: `silentIncomingCalls` toggle, ringtone selection

---

## Step 18: Remaining Services (Sprint 7 — Week 10-11)

- [ ] **Course Studio (Teacher):** MVP = view my courses + sales only. Creation stays on web for v1.
- [ ] **Referrals:**
  - Share screen with code + native share sheet
  - Deep link: `questioncall://register?ref=CODE`
  - Get referral info: `GET /api/user/referral`
  - Submit referral: `POST /api/referral`
  - Show referral history with status badges (COMPLETED/REVOKED)
- [ ] **Leaderboard:** `GET /api/teachers/top-rated`
- [ ] **Peer Comments:** `GET /api/questions/[id]/comments` — teachers above `peerCommentPointThreshold`
- [ ] **Notices history:** `GET /api/notices`
- [ ] **Change Password, Delete Account, Theme toggle**
- [ ] **Legal pages (dynamic):** `GET /api/legal` — render from DB, never bundle static text
- [ ] **Daily Target Tracker (Teacher):** Show progress widget, tiers from PlatformConfig

---

## Step 19: Polish, Testing & Accessibility (Sprint 8 — Week 11-12)

- [ ] Run all **15 Critical User Journeys** with logged test reports
- [ ] Write **Maestro E2E tests** for journeys 1-5:
  1. Post question → Accept → Chat → Solve → Rating → Wallet credit
  2. Withdrawal request → Admin approval → Balance update + push
  3. Manual payment + screenshot → Admin verify → Subscription active
  4. eSewa/Khalti WebView payment + redirect return
  5. Token refresh & session persistence on app restart
- [ ] Stress-test Pusher reconnect: toggle airplane mode mid-chat
- [ ] Test on **cheapest available Android device**
- [ ] **Accessibility pass:**
  - Minimum 44pt touch targets
  - `accessibilityLabel` on all interactive elements
  - Sufficient contrast in dark + light themes
  - Dynamic type support on wallet and chat screens

---

## Step 20: Store Submission & Compliance (Sprint 8 — Week 12)

- [ ] Terms of Use + Privacy Policy rendered dynamically from PlatformConfig
- [ ] Write Play Store review notes:
  > "This is an educational tutoring marketplace. Teachers earn compensation in NPR for tutoring services rendered. The platform takes a commission. This is not gambling, not a financial product, and not user-to-user money transfer."
- [ ] Provide **reviewer test accounts:** 1 student, 1 teacher (with pending withdrawal), 1 admin
- [ ] Complete Play Store data safety form with accurate data disclosure
- ~~Apple IAP~~ — **NOT NEEDED** (Nepal market, eSewa/Khalti only)
- [ ] Build command: `eas build --profile production --platform android`
- [ ] Submit to **Play Store** (iOS at final stage later)
- [ ] **Verify:** App approved on Play Store. Production users onboarded.

---

## 📋 Deep Link Registry (Complete)

```
questioncall://course/[id]           → Course detail
questioncall://workspace/[channelId] → Chat workspace
questioncall://wallet                → Wallet screen
questioncall://quiz/[topicId]        → Quiz session
questioncall://register?ref=CODE     → Signup with referral
questioncall://payment/success       → Payment verification
questioncall://payment/failure       → Payment failure
```

---

## 📋 Pusher Channels to Subscribe

| Channel | Events | When |
|---------|--------|------|
| `user-${userId}` | User-scoped notifications | After login |
| `questions-feed` | `question:new` | Feed tab (teacher) |
| `channel-${channelId}` | `channel:message`, `message:marked`, `message:deleted` | In workspace |
| `platform-config` | Config changes | Global (optional but recommended) |
| Call-related | `call:incoming`, `call:accepted`, `call:ended` | Global |

---

## ⚠️ Things Web Team Must Do BEFORE App Dev Starts

> [!CAUTION]
> The mobile app **cannot be built** until the web team completes these backend tasks.
> These tasks are tracked in **`web/TODO.md`** — the web assistant will handle them.

- [x] Build `POST /api/mobile/login` endpoint (returns JWT access + refresh tokens)
- [x] Build `POST /api/mobile/refresh` endpoint (refreshes access token)
- [x] Add `platform` field (`web` / `ios` / `android`) to `PushSubscription` model
- [x] Ensure Sprint 1/core mobile routes and call routes accept `Authorization: Bearer <token>` header (not just cookies)
- [x] Verify `GET /api/mobile/me` works with Bearer token auth
- [ ] Provide Pusher keys, LiveKit URL, eSewa merchant ID, Khalti public key to app developer
