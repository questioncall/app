# QuestionCall Mobile — Developer Handoff
> **Source of truth** for the React Native (Expo) mobile app. Combines the original product spec with a reviewed, corrected build plan. Read this entire document before writing a single line of code.

---

## ⚠️ Pre-Read: Known Issues Fixed in This Doc

The original handoff had several gaps corrected here:

| # | Issue | Where Fixed |
|---|-------|-------------|
| 1 | Two "Section 3"s (Tech Stack + Backend) | Renumbered below |
| 2 | "Phase 1/2/3" used for both nav states and dev phases | Dev phases renamed Sprint 0–8 |
| 3 | Folder structure conflict between Section 2 and Section 14 | Use Section 2's flat version |
| 4 | JWT refresh strategy missing — no token expiry, no 401 interceptor | Added in Sprint 1 |
| 5 | No offline/network-loss strategy | Message retry queue added in Sprint 4 |
| 6 | Quiz anti-cheat false positives (phone calls, biometric prompts) | Grace period added in Sprint 6 |
| 7 | Apple IAP risk understated — eSewa/Khalti likely rejected on iOS | Blocking decision in Sprint 0 |
| 8 | No crash reporting plan | Sentry added in Sprint 0 |
| 9 | Biometric gate: no fallback if device has no biometrics | Password fallback added in Sprint 5 |
| 10 | PlatformConfig has no TTL/invalidation | Refresh-on-foreground policy added in Sprint 1 |
| 11 | Withdrawal approval notification not specified | Push notification wired in Sprint 5 |
| 12 | No accessibility section | Added in Sprint 8 |
| 13 | iOS screenshot prevention claim is technically wrong | Corrected in Sprint 5 |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [App Navigation & Screen Architecture](#2-app-navigation--screen-architecture)
3. [Mobile Tech Stack](#3-mobile-tech-stack)
4. [Backend & API Integration](#4-backend--api-integration)
5. [Authentication & Security](#5-authentication--security)
6. [Feature Parity Checklist](#6-feature-parity-checklist)
7. [Money & Transaction Handling](#7-money--transaction-handling)
8. [Data Models & TypeScript Types](#8-data-models--typescript-types)
9. [Design System & UI Guidelines](#9-design-system--ui-guidelines)
10. [Push Notifications, Deep Links & Background Tasks](#10-push-notifications-deep-links--background-tasks)
11. [Environment Variables & Config](#11-environment-variables--config)
12. [Testing & QA Requirements](#12-testing--qa-requirements)
13. [Build, Release & Store Submission](#13-build-release--store-submission)
14. [Known Pitfalls (Web → Mobile)](#14-known-pitfalls-web--mobile)
15. [Sprint-by-Sprint Build Plan (Sprints 0–8)](#15-sprint-by-sprint-build-plan-sprints-08)
16. [Final Launch Checklist](#16-final-launch-checklist)

---

## 1. Project Overview

**QuestionCall** is a dual-portal educational platform connecting students with verified expert teachers.

- **Target users:** Students (seeking academic help) and Teachers (providing answers, creating courses, earning money)
- **Core value proposition:** 15-minute timed response system, real-time 1-on-1 video/audio/chat, structured video courses, live sessions, AI quizzes, and an internal economy for teacher monetization
- **This is a real-money app.** Teachers earn NPR (tracked as "points" internally) by answering questions, selling courses, and referrals. They withdraw to eSewa/Khalti. Students earn points via quizzes and can also withdraw. Security and compliance are non-negotiable.
- **Currency system:** Internal "points" unit. Points convert to Nepalese Rupees at a configurable `pointToNprRate` stored in `PlatformConfig`. Always display NPR equivalent alongside raw point value.

### Web Tech Stack (for reference)
Next.js 14 (App Router), MongoDB (Mongoose), NextAuth.js, Pusher (real-time), LiveKit (video calls), Mux/Cloudinary (video), Zod (validation), Redux Toolkit, Tailwind CSS + Shadcn. Backend hosted on Vercel.

---

## 2. App Navigation & Screen Architecture

### Three-Phase Navigation Model

```
App Launch
│
├── [No JWT] → Phase 1: Landing Screen
│   ├── "Sign Up" → Phase 2: Auth (Register mode)
│   └── "Sign In" → Phase 2: Auth (Login mode)
│       └── Success → Phase 3: Home [clear auth stack]
│
└── [Valid JWT] → Phase 3: Home (directly)
```

### Phase 1 — Landing Screen (Unauthenticated)

First screen a new user sees. Design: clean, centered, premium feel similar to ChatGPT's welcome screen.

- QuestionCall logo + short tagline (e.g. *"Get expert answers in 15 minutes"*)
- Optional: subtle background animation or gradient
- Optional: 2–3 value prop icons above the CTAs (⏱️ 15-Min Answers, 🎥 Live Calls, 💰 Earn by Teaching)
- Two CTAs at bottom: **"Sign Up"** (primary/filled) and **"Sign In"** (secondary/outlined)
- No bottom tabs, no nav bars — pure full-screen
- **Skip entirely** if valid JWT exists in `expo-secure-store` → go straight to Phase 3

### Phase 2 — Auth Screen

**Sign Up flow:**
1. Collect: `name`, `email`, `password`, `role` (STUDENT or TEACHER toggle)
2. Optional referral code field (pre-filled if deep link `questioncall://register?ref=CODE`)
3. `POST /api/auth/register`
4. Email verification prompt → user verifies via email link (deep link back to app)
5. After verification → auto-login → navigate to Phase 3

**Sign In flow:**
1. Collect `email` + `password`
2. Authenticate via NextAuth JWT bridge endpoint
3. Store JWT in `expo-secure-store`
4. Navigate to Phase 3

**Google Sign-In:** `expo-auth-session` with Google provider. On success → same JWT flow.

**Sign in with Apple:** Mandatory on iOS if Google Sign-In is present (Apple policy). Include both.

**Additional screens:** Forgot Password, Email Verification Pending.

**Key behavior:** Back from Auth → returns to Landing. Successful auth → clear Landing/Auth from nav stack.

### Phase 3 — Home (Authenticated, Bottom Tab Navigator)

5-tab layout:

| Tab | Icon | Label | Who Sees It |
|-----|------|-------|-------------|
| 1 | 📋 | **Feed** | Default tab. Teachers: live question feed. Students: My Questions. |
| 2 | 📢 | **Channels** | Active conversations |
| 3 | ➕ | **Ask / Actions** | Center, elevated button. Students: post question. Teachers: quick actions hub. |
| 4 | 📚 | **Courses** | Course library |
| 5 | ☰ | **Menu** | Catch-all: profile, wallet, settings, services |

**Tab 3 center button** must be visually distinct — larger, elevated, accent-colored (like Instagram's post button). Label changes: "Ask" for students, "Actions" for teachers.

**Tab 5 — Menu sections:**

- **Profile:** Avatar, name, role badge, Edit Profile, My Activity
- **Wallet & Transactions:** Balance (prominent), Withdraw (teachers, biometric-gated), Transaction History, Daily Target Tracker (teachers)
- **Services:** Course Studio (teachers), AI Quizzes, Leaderboard, Referrals, Notices
- **Account:** Subscription Plans, Notifications, Call Settings, Onboarding Videos, Terms of Use, Privacy Policy, Change Password, Theme toggle
- **Danger Zone:** Sign Out, Delete Account

### expo-router File Structure

```
/app
├── index.tsx                    # Landing (Phase 1) — redirects if JWT exists
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
│   └── verify-email.tsx
├── (tabs)/
│   ├── _layout.tsx              # 5-tab config (role-based labels, elevated Tab 3)
│   ├── feed.tsx                 # Tab 1
│   ├── channels.tsx             # Tab 2
│   ├── ask.tsx                  # Tab 3
│   ├── courses.tsx              # Tab 4
│   └── menu.tsx                 # Tab 5
├── workspace/
│   └── [channelId].tsx          # Chat workspace (pushed from Channels)
├── call/
│   └── [roomId].tsx             # LiveKit call screen
├── course/
│   ├── index.tsx
│   └── [id].tsx                 # Detail + video player
├── quiz/
│   ├── index.tsx
│   └── [topicId].tsx
├── studio/
│   └── index.tsx                # Course creation (teacher)
├── payment/
│   ├── gateway.tsx              # eSewa/Khalti WebView
│   ├── manual.tsx               # Manual payment + screenshot
│   └── plans.tsx
├── profile/
│   ├── edit.tsx
│   └── activity.tsx
├── settings/
│   ├── call-settings.tsx
│   ├── notifications.tsx
│   └── theme.tsx
├── legal/
│   ├── terms.tsx                # Dynamic from DB
│   └── privacy.tsx              # Dynamic from DB
├── referral.tsx
├── leaderboard.tsx
├── notices.tsx
├── onboarding.tsx
└── suspended.tsx                # Full-screen suspension blocker
```

---

## 3. Mobile Tech Stack

| Concern | Library | Notes |
|---------|---------|-------|
| Framework | React Native + Expo SDK 51+ | |
| Routing | `expo-router` | File-based, mirrors Next.js App Router |
| State | `@reduxjs/toolkit` + `react-redux` | Mirror all 6 web slices + add `config` slice |
| Secure storage | `expo-secure-store` | **ONLY** for JWT and financial tokens. Never AsyncStorage for auth. |
| Real-time chat | `pusher-js` | Aggressive reconnect required |
| Video calls | `@livekit/components-react-native` | |
| Video playback | `expo-video` | HLS/Mux streams |
| Push notifications | `expo-notifications` | FCM (Android) + APNs (iOS) |
| Biometrics | `expo-local-authentication` | Wallet/withdrawal gate |
| Camera/images | `expo-camera`, `expo-image-picker` | Homework images, payment screenshots |
| Deep linking | `expo-linking` | Payment callbacks, referral codes |
| File picker | `expo-document-picker` | Chat attachments |
| Crash reporting | Sentry | Configure in Sprint 0, before any other code |
| Builds | EAS Build | dev / staging / production profiles |
| Styling | NativeWind (Tailwind for RN) | Map CSS variables from `globals.css` |

---

## 4. Backend & API Integration

Backend is the existing Vercel-deployed Next.js app. No separate mobile backend required — only a JWT bridge endpoint and FCM/APNs token support need to be added.

**Base URL:** `https://[production-domain].com/api`

**Auth headers:** `Authorization: Bearer <token>` on every request, `Content-Type: application/json` (or `multipart/form-data` for screenshot uploads).

### PlatformConfig — Critical

Nearly every business constant (answer durations, points per format, rating bonuses/penalties, quiz settings, commission %, subscription pricing, withdrawal minimums, etc.) lives in the `PlatformConfig` MongoDB collection. **Never hardcode these values.** Fetch via `GET /api/platform` on launch, cache in Redux, refresh every hour and on every cold start + foreground if stale. Consider subscribing to a Pusher `platform-config` channel for instant invalidation when admin changes values.

### Complete API Route Map

**Auth:**
- `POST /api/auth/register`
- `POST /api/auth/[...nextauth]` — needs mobile JWT bridge (`/api/mobile/login`, `/api/mobile/refresh`)
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-email`

**Questions:**
- `GET /api/questions/feed` — teacher feed
- `POST /api/questions` — post question (enforces plan limits)
- `GET /api/questions/[id]`
- `DELETE /api/questions/[id]` — decrements `questionsAsked`
- `POST /api/questions/[id]/accept`
- `POST /api/questions/[id]/react`

**Channels:**
- `GET /api/channels`
- `GET /api/channels/[id]`
- `POST /api/channels/[id]/close` — triggers rating, point rewards, potential question reset

**Calls:**
- `POST /api/calls/initiate`
- `POST /api/calls/accept`
- `POST /api/calls/reject`

**Wallet & Payments:**
- `GET /api/wallet`
- `POST /api/wallet/withdraw` — atomic Mongo transaction
- `POST /api/payments/esewa/initiate`
- `GET /api/payments/esewa/verify`
- `GET /api/payments/esewa/course-verify`
- `GET /api/payments/khalti/course-verify`
- `POST /api/payments/manual` — FormData with screenshot

**Courses:**
- `GET /api/courses`
- `POST /api/courses`
- `GET /api/courses/[id]`
- `POST /api/courses/[id]/enroll`

**Quiz:** `GET /api/quiz` — quiz endpoints + session management

**Other:**
- `GET /api/profile-questions`
- `GET /api/ratings`
- `POST /api/referral`
- `GET /api/teachers/top-rated`
- `GET /api/notices`
- `POST /api/push` — push notification subscription (add `platform` field: web/ios/android)
- `GET /api/legal`
- `GET /api/platform` — PlatformConfig
- `POST /api/upload` — Cloudinary file upload
- `GET /api/notifications`
- `GET /api/onboarding-video`

**Admin (if building mobile admin panel):**
- `GET /api/admin/users`
- `POST /api/admin/users/[id]/suspend`
- `GET /api/admin/withdrawals`

**Cron side-effects to handle gracefully:**
- `expire-calls` → sudden call termination while app is open
- `expire-channels` → channel closes mid-chat
- `monthly-rewards` → surprise wallet credit notification

---

## 5. Authentication & Security

### JWT Bridge
NextAuth uses HTTP-only session cookies — React Native cannot use these. The backend must expose:
- `POST /api/mobile/login` — accepts credentials, returns `{ accessToken, refreshToken }`
- `POST /api/mobile/refresh` — accepts refresh token, returns new access token

Recommended token lifetimes: access token 15 min, refresh token 30 days. Store **both** in `expo-secure-store`.

### Axios Interceptor (Required)
Write an Axios interceptor that:
1. Attaches `Authorization: Bearer <accessToken>` to every request
2. On 401 response: attempts one silent refresh via `POST /api/mobile/refresh`
3. If refresh succeeds: retries the original request with the new token
4. If refresh fails: clears all tokens from `expo-secure-store` and navigates user to Landing screen

### Role-Based Access
JWT payload contains `role`: `STUDENT`, `TEACHER`, or `ADMIN`. Gate all UI and API calls accordingly:
- **Students:** My Questions, quiz portal, course library, wallet (quiz points)
- **Teachers:** Question Feed, answer workspace, course studio, wallet (pointBalance from answers)
- **Admins:** Admin dashboard, user management, withdrawal processing

### Account Suspension
On every app foreground and immediately after login, fetch `GET /api/users/me` and check `isSuspended`. If `true`:
- Navigate to `suspended.tsx` — full-screen blocker, cannot be dismissed
- Only two options: "Contact Support" and "Sign Out"
- Teacher is excluded from feed, cannot earn, cannot withdraw

### Teacher Qualification Gate
- New teachers: `teacherModeVerified: false`, `isMonetized: false`
- Must correctly answer `qualificationThreshold` test questions
- Once verified: `isMonetized` flips to `true`, wallet features unlock
- Show qualification progress; disable wallet until monetized

### Security Requirements
- **Biometric gate:** Face ID / Fingerprint (`expo-local-authentication`) required before Wallet, Transaction History, or Withdrawal. If device has no biometrics enrolled → fallback to requiring account password re-entry (not a separate PIN).
- **Screenshot prevention:** On Android, apply `FLAG_SECURE` to genuinely block screenshots on wallet/withdrawal screens. On iOS, you **cannot block** screenshots — you can only detect them via `UIApplicationUserDidTakeScreenshotNotification` and log/warn. Do not promise iOS screenshot blocking to users.
- **Jailbreak/root detection** recommended but not blocking for v1.

---

## 6. Feature Parity Checklist

### 6.1 Question Feed & Posting

**Student posting:**
1. Title (6–180 chars), body (≤5000 chars), images via `expo-image-picker`
2. `answerFormat`: TEXT / PHOTO / VIDEO / ANY
3. `answerVisibility`: PUBLIC / PRIVATE
4. Subject, stream, level selectors

**Quota enforcement (critical):**
- `effectiveLimit = maxQuestions + bonusQuestions`
- If `questionsAsked >= effectiveLimit` → replace submit with "Upgrade Plan" CTA
- Deleting a question decrements `questionsAsked` (restores quota)
- Add optimistic UI: show question immediately in "My Questions" with "Posting..." badge, reconcile on API response

**Teacher feed:**
- Sort by `resetCount` desc, then `createdAt` desc
- Show "Attempt X of Y" badge on reset questions
- Accept button → confirmation modal showing countdown duration based on `answerFormat`
- Real-time inserts via Pusher `questions-feed` channel

### 6.2 Live Chat / Workspace
- WhatsApp-style FlatList with `inverted={true}`
- Text + image attachments (`expo-image-picker`, `expo-document-picker`)
- Pusher channel: `channel-${channelId}` — events: `channel:message`, `message:marked`, `message:deleted`
- Close Channel → 5-star rating modal (student) → submit → points awarded/deducted
- **Message retry queue:** If offline, queue messages in Redux + AsyncStorage, show "Sending..." state, retry on network return. Non-negotiable on Nepali mobile networks.

### 6.3 Video & Audio Calls
- Teacher taps "Call" → `POST /api/calls/initiate`
- Pusher broadcasts `call:incoming` → high-priority push notification wakes app
- Full-screen incoming call UI with ringtone (even when backgrounded)
- Accept → fetch LiveKit token (`/api/calls/token`) → connect to room
- **MVP approach:** High-priority push + in-app full-screen UI (simpler). Full CallKit/ConnectionService integration recommended for v1.1.
- Handle `expire-calls` cron: graceful sudden termination

**Call settings (user-configurable):**
- `silentIncomingCalls` toggle
- `incomingRingtone` / `outgoingRingtone` selection

### 6.4 Video Courses & Live Sessions

**Courses:**
- Pricing models: FREE, SUBSCRIPTION_INCLUDED, PAID
- 90% watch time required (`courseProgressCompletionThreshold`) for section completion
- Track watch time: ping backend every 10s, pause on AppState background or video pause
- Enrollment access types: FREE, SUBSCRIPTION, COUPON, PURCHASE — distinct badges for each
- Course sale: instructor receives points minus `coursePurchaseCommissionPercent`

**Coupon system:**
- Types: FULL_ACCESS (100% off) or PERCENTAGE (X% off)
- Scopes: COURSE or GLOBAL
- Show "Apply Coupon" input on purchase screens

**Live sessions:** Deep-link to Zoom via `zoomus://` with HTTPS fallback if Zoom not installed.

### 6.5 AI Quizzes

**Quiz types:**
- FREE: limited daily sessions (`freeQuizDailySessionLimit`), lower rewards (`freeQuizPointReward`)
- PREMIUM: higher daily limits per plan, higher rewards (`premiumQuizPointReward`)

**All quiz config comes from PlatformConfig — never hardcode:**
- `quizQuestionCount`, `quizTimeLimitSeconds`, `quizRepeatResetDays`
- `freeQuizPassPercent` / `premiumQuizPassPercent`
- `quizViolationWarningLimit`

**Anti-cheat (mobile equivalents):**

| Web Event | Mobile Implementation |
|-----------|----------------------|
| `TAB_HIDDEN` | `AppState` → background or inactive |
| `WINDOW_BLUR` | App loses focus |
| `BACK_NAVIGATION` | Hardware back button (Android) → intercept, log violation |
| `FULLSCREEN_EXIT` | N/A — skip |
| `DUPLICATE_TAB` | N/A — skip |

**Critical false-positive guard (not in original doc):** Add a 2-second grace window. Biometric prompts, system permission dialogs, incoming-call screens, and push notification previews all legitimately background the app momentarily. If the app returns to active within 2 seconds, do NOT log a violation. Also ignore the first background event within 500ms of quiz start (spurious lifecycle events on some devices).

When `violationCount >= violationWarningLimit`: auto-submit with `submitReason: "ANTI_CHEAT"`. Show a clear warning modal at every violation so users are not surprised.

### 6.6 Teacher-Student Anti-Cheat
`AntiCheatAlert` model tracks repeated teacher-student collaboration (`consecutiveCount`). If threshold exceeded (`antiCheatConsecutiveThreshold`), teacher may be auto-suspended for `antiCheatSuspensionDays`. Display flag status in UI.

### 6.7 Peer Comments
Teachers above `peerCommentPointThreshold` can comment on other teachers' answers. Rewards: between `peerCommentMinPointReward` and `peerCommentMaxPointReward` points.

### 6.8 Referral System
- Each user has a unique `referralCode`
- Share flow: generate deep link `questioncall://register?ref=CODE` via native share sheet
- On signup with code: referee gets `referralBonusQuestions`, referrer gets `referrerBonusQuestions`
- `bonusQuestions` add to effective question quota
- Show referral history with status badges (COMPLETED / REVOKED)

### 6.9 Notice System
Admins push platform-wide announcements via `Notice` model. On every foreground, fetch unseen notices and show a dismissible modal for the highest-priority one. Mark seen via `User.seenNotices`.

### 6.10 Onboarding Videos
`PlatformConfig.onboardingVideos` stores role-specific videos. `User.seenOnboardingRoles[]` tracks what was watched. Show first-run video experience per role. Allow re-watch from Menu.

---

## 7. Money & Transaction Handling

> ⚠️ Security Critical — Atomic transactions, no client-side balance math, ever.

### Internal Currency
- Teachers: `pointBalance` (answers, course sales, bonuses)
- Students: `points` (quiz rewards)
- Both: `pointBalance × pointToNprRate = NPR equivalent` — always show both

### Teacher Earning Mechanisms

| Source | Config Field |
|--------|-------------|
| Text/Photo/Video answer | `pointsPerTextAnswer`, `pointsPerPhotoAnswer`, `pointsPerVideoAnswer` |
| 2–5 star rating bonus | `bonusPointsFor2Star` → `bonusPointsFor5Star` |
| 1-star penalty | `penaltyPointsForLowRating` |
| Monthly high-rating bonus | `monthlyHighScoreBonusPoints` |
| Daily target tiers | `dailyTargets[]` array |
| Course sale | Price minus `coursePurchaseCommissionPercent` |

### Daily Target Bonus System

Teachers have tiered daily answer targets (defaults configurable via PlatformConfig):

| Answers/day | Bonus |
|-------------|-------|
| 20 | 5 pts |
| 40 | 10 pts |
| 80 | 20 pts |
| 100 | 25 pts |

`dailyAnswersCount` resets daily. Show progress tracker widget in teacher dashboard.

### Withdrawal Flow

> ⚠️ This is an atomic Mongo transaction — do not attempt partial implementations.

1. User enters withdrawal amount + eSewa number
2. Backend runs inside `mongoose.startSession()` + `withTransaction()`:
   - Checks no existing PENDING withdrawal
   - Atomically deducts from balance
   - Creates `WithdrawalRequest` with `pointsReserved: true`
   - Locks `nprEquivalent = pointsRequested × pointToNprRate` at request time
3. Notifies all admins via Pusher + push + email
4. Admin processes manually, marks COMPLETED or REJECTED
5. If REJECTED → points refunded

**Mobile must:**
- Show "pending request exists" state and disable withdraw button proactively
- Handle HTTP 400 / Mongo 11000 duplicate error gracefully
- Show the locked NPR rate on the pending card
- Enforce `minWithdrawalPoints` from config
- Allow saving eSewa number (`saveEsewaNumber` flag)
- Send push notification when withdrawal is approved/rejected (`withdrawal:processed` event)

### Payment Gateways

**eSewa & Khalti (redirect-based):**
1. Initiate → backend returns redirect URL
2. Open in `react-native-webview`
3. Intercept success/failure redirect by matching URL pattern
4. Deep link fallback: `questioncall://payment/success`
5. **Always verify on backend before showing success** — never trust client-side redirect URLs alone

**Manual payment:**
1. Show admin's eSewa number + QR code from `PlatformConfig.manualPaymentQrCodeUrl`
2. User transfers outside app, then submits via `POST /api/payments/manual` (FormData):
   - `transactionId`, `transactorName`, `planSlug`, optional `screenshot`
3. Same `transactionId` from same user = update existing PENDING (not duplicate)
4. Same `transactionId` already COMPLETED = 409 Conflict → clear message to user

### Subscription Plans

All pricing and limits come from PlatformConfig. Never hardcode. Plans: Free, Go, Plus, Pro, Max.

**Apple IAP note:** Apple guideline 3.1.1 requires IAP for digital goods consumed in-app. eSewa/Khalti will likely be rejected for course purchases on iOS. Decide in Sprint 0: (a) hide iOS course purchases, route to web; (b) integrate RevenueCat + Apple IAP for iOS only; (c) reclassify (risky). This decision changes Sprint 7 architecture.

---

## 8. Data Models & TypeScript Types

Copy the entire `types/` folder from the web repo into the mobile codebase. Set up a sync script or git submodule to keep types aligned. Key files: `types/channel.ts`, `types/question.ts`, `types/quiz.ts`, `types/next-auth.d.ts`.

**All 34 models:**

| Model | Key Fields | Money? |
|-------|-----------|--------|
| `User` | role, points, pointBalance, subscriptionStatus, planSlug, questionsAsked, bonusQuestions, isSuspended, isMonetized, teacherModeVerified, dailyAnswersCount, dailyTargetsAchieved, esewaNumber, callSettings | ✅ |
| `Question` | askerId, title, body, images, answerFormat, answerVisibility, status (OPEN/ACCEPTED/SOLVED), resetCount, acceptedById, acceptedAt | |
| `Answer` | questionId, teacherId, content | |
| `Channel` | participants, question reference | |
| `Message` | channelId, senderId, content, attachments | |
| `CallSession` | channelId, roomName, teacherId, studentId, mode (AUDIO/VIDEO), status (CREATED/RINGING/ACTIVE/ENDED/REJECTED/MISSED) | |
| `Transaction` | userId, type, amount, status (PENDING/COMPLETED/FAILED), gateway, transactionId, planSlug, screenshotUrl | ✅ |
| `WithdrawalRequest` | teacherId, pointsRequested, nprEquivalent, esewaNumber, status (PENDING/COMPLETED/REJECTED), pointsReserved, transactionId, amountSent, processedBy | ✅ |
| `WalletHistoryEvent` | userId, type, title, pointsDelta, occurredAt | ✅ |
| `Course` | title, slug, pricingModel, price, currency (NPR), status, instructorId | ✅ |
| `CourseEnrollment` | courseId, studentId, accessType, pricePaid, overallProgressPercent | ✅ |
| `CourseVideo` | courseId, sectionId, title, duration | |
| `CourseSection` | courseId, title, order | |
| `CourseCoupon` | code, type, scope, discountPercentage, usageLimit, expiryDate | ✅ |
| `CourseCouponRedemption` | couponId, studentId, courseId | |
| `LiveSession` | courseId, title, zoomLink, scheduledAt | |
| `QuizSession` | studentId, quizType, topicId, answers, score, pointsAwarded, violationCount, violationEvents, configSnapshot, submitReason (MANUAL/TIME_EXPIRED/ANTI_CHEAT) | ✅ |
| `QuizQuestion` | question, options, correctIndex | |
| `QuizTopic` | subject, topic, level | |
| `Referral` | referrerId, refereeId, referralCode, bonusAwarded, status (COMPLETED/REVOKED) | ✅ |
| `Notification` | userId, type, message, href, isRead | |
| `PeerComment` | answerId, commenterId, content | |
| `AntiCheatAlert` | teacherId, studentId, consecutiveCount, status (WARNING/SUSPENDED) | |
| `Notice` | title, content | |
| `PlatformConfig` | 50+ configurable fields | ✅ |
| `PushSubscription` | userId, subscription endpoint, **platform** (web/ios/android) | |
| `VideoProgress` | userId, videoId, watchedPercent | |
| `ErrorLog` | error tracking | |
| `ApiRequestLog` | request logging | |
| `AIProviderConfig` | LLM key rotation | |
| `DeveloperConfig` | dev settings | |
| `CourseNotificationLog` | notification dedup | |
| `VerificationToken` | email verification | |
| `QuizGenerationLog` | quiz generation tracking | |

---

## 9. Design System & UI Guidelines

- **Aesthetic:** Premium, glassmorphism-heavy, subtle animations, dark/light mode
- **Color palette:** Extract CSS variables from `globals.css`, map to NativeWind theme tokens
- **Component mappings:**

| Web (Shadcn/Radix) | Mobile |
|---------------------|--------|
| Modals/dialogs | `@gorhom/bottom-sheet` |
| Toasts (`sonner`) | `react-native-toast-message` |
| Dropdowns (Radix) | `@react-native-picker/picker` or bottom sheet |
| Accordions | `react-native-collapsible` or custom animated view |
| Dark/Light (`next-themes`) | `useColorScheme()` from React Native |

**Key screens to build:**

- Suspended account screen (full-screen blocker, no dismissal)
- Onboarding video player (first-run per role)
- Question quota indicator badge
- Daily target progress widget (teacher)
- Referral sharing screen
- Manual payment screen (QR code + screenshot upload)
- Pending withdrawal status card
- Admin notice banner/modal

---

## 10. Push Notifications, Deep Links & Background Tasks

### Push Notifications
Use `expo-notifications` for FCM (Android) + APNs (iOS). Backend `PushSubscription` model needs `platform` field added (web/ios/android).

**Notification types to handle:**

| Event | Trigger | Deep Link |
|-------|---------|-----------|
| New question in feed | Teacher | Feed tab |
| Question accepted | Student | Channel |
| Incoming call | Any | Full-screen call UI |
| Withdrawal processed | Teacher/Student | Wallet |
| Monthly bonus awarded | Teacher | Wallet |
| Daily target achieved | Teacher | Wallet |
| Admin broadcast | Any | Notices screen |
| Course live session soon | Student | Course detail |

### Deep Link Schemes (configure via `expo-linking`)

```
questioncall://course/[id]           → Course detail
questioncall://workspace/[channelId] → Chat workspace
questioncall://wallet                → Wallet screen
questioncall://quiz/[topicId]        → Quiz session
questioncall://register?ref=CODE     → Signup with referral
questioncall://payment/success       → Payment verification callback
questioncall://payment/failure       → Payment failure handler
```

### Background Tasks
- **Answer timer:** Use local notifications to alert teacher when time is almost up (even backgrounded)
- **Quiz anti-cheat:** `AppState` API detects backgrounding → log violation
- **Video tracking:** Pause progress pings on AppState background or phone lock

---

## 11. Environment Variables & Config

```env
EXPO_PUBLIC_API_URL=https://[production-domain].com/api
EXPO_PUBLIC_PUSHER_KEY=[your_pusher_key]
EXPO_PUBLIC_PUSHER_CLUSTER=[your_pusher_cluster]
EXPO_PUBLIC_LIVEKIT_URL=[your_livekit_url]
EXPO_PUBLIC_ESEWA_MERCHANT_ID=[esewa_merchant_id]
EXPO_PUBLIC_KHALTI_PUBLIC_KEY=[khalti_public_key]
# DO NOT bundle NextAuth secrets, DB URIs, or any server-side secrets.
# All sensitive operations happen server-side via API calls.
```

Use EAS Build profiles (`development`, `staging`, `production`) with separate `.env` files. Define `EXPO_PUBLIC_API_URL` per profile in `eas.json`.

---

## 12. Testing & QA Requirements

**Critical User Journeys:**

| # | Journey | Priority |
|---|---------|----------|
| 1 | Post question → Accept → Chat → Solve → Rating → Wallet credit | 🔴 Critical |
| 2 | Withdrawal request → Admin approval → Balance update + push notification | 🔴 Critical |
| 3 | Manual payment with screenshot → Admin verify → Subscription active | 🔴 Critical |
| 4 | eSewa/Khalti WebView payment + redirect return | 🔴 Critical |
| 5 | Token refresh & session persistence on app restart | 🔴 Critical |
| 6 | Suspended account → blocked from all features | 🔴 Critical |
| 7 | Question limit reached → upgrade CTA shown | 🟡 Important |
| 8 | Quiz anti-cheat: backgrounding triggers violation, grace period works | 🟡 Important |
| 9 | Video call on cellular vs. Wi-Fi | 🟡 Important |
| 10 | Course purchase with coupon code | 🟡 Important |
| 11 | Referral code signup → bonus questions awarded on both sides | 🟡 Important |
| 12 | Daily target progress → bonus awarded at threshold | 🟡 Important |
| 13 | Duplicate withdrawal attempt → proper error shown | 🟡 Important |
| 14 | Onboarding video shown on first login per role | 🟢 Minor |
| 15 | Admin notice displayed and dismissible | 🟢 Minor |

**Tools:** Jest for unit testing Redux slices, Maestro (preferred) or Detox for E2E. Write E2E tests for journeys 1–5 minimum.

**Stress tests:** Toggle airplane mode mid-chat to verify Pusher reconnect. Test on the cheapest available Android device — that is most of the user base.

---

## 13. Build, Release & Store Submission

**Build command:** `eas build --profile production --platform all`

**Store review notes to write (verbatim clarity required):**
> "This is an educational tutoring marketplace. Teachers earn compensation in NPR for tutoring services rendered. The platform takes a commission. This is not gambling, not a financial product, and not user-to-user money transfer."

**Provide test accounts for reviewers:**
- One student with funded balance
- One teacher with pending withdrawal
- One admin

**iOS-specific risks:**
- Apple guideline 3.1.1: must use IAP for digital goods consumed in-app. Resolve in Sprint 0.
- Sign in with Apple is required if Google Sign-In is offered.
- Screenshot blocking is not possible — update all documentation accordingly.

**Compliance checklist:**
- Terms of Use and Privacy Policy rendered dynamically from `PlatformConfig` (never bundled static text)
- App Privacy questionnaire completed with accurate data collection disclosure
- IAP integrated (if Sprint 0 decision was option b)

---

## 14. Known Pitfalls (Web → Mobile)

| Web Pattern | Mobile Solution | Watch Out |
|-------------|----------------|-----------|
| `httpOnly` cookies (NextAuth) | Bearer JWT via `expo-secure-store` | Must build JWT bridge endpoint |
| `localStorage` / `sessionStorage` | `AsyncStorage` (non-sensitive) / `expo-secure-store` (sensitive) | NEVER store tokens in AsyncStorage |
| `window.location.href` redirects | `expo-linking` / `expo-router` navigation | Payment callbacks especially |
| `document.fullscreenElement` | N/A on mobile | Skip this quiz anti-cheat check |
| `document.hidden` / `visibilitychange` | `AppState` API (`active`/`background`/`inactive`) | Maps to TAB_HIDDEN violation |
| `window.onbeforeunload` | `AppState` change to `background` | Maps to BEFORE_UNLOAD violation |
| `setInterval` for video tracking | `setInterval` + AppState pause | Must pause when backgrounded |
| Pusher WebSockets | Same library | Aggressive reconnect — mobile drops sockets constantly |
| Cloudinary upload (server-side) | Same API, FormData from mobile | Manual payment screenshot upload |
| `next-themes` (dark/light) | `useColorScheme()` from React Native | Map CSS variables to theme object |
| Web Push (VAPID) | FCM + APNs via `expo-notifications` | Backend needs platform field on PushSubscription |
| `PlatformConfig` server-side cache | Fetch on launch + cache in Redux with TTL | Never hardcode. Refresh on foreground if stale. |
| `sonner` toasts | `react-native-toast-message` | Same UX patterns |
| Shadcn modals/dialogs | `@gorhom/bottom-sheet` | More native feel |
| Screenshot prevention | Android: `FLAG_SECURE` works. iOS: detection only, cannot block. | Do not tell iOS users screenshots are blocked |

---

## 15. Sprint-by-Sprint Build Plan (Sprints 0–8)

Each sprint is roughly 1–2 weeks for a single mid-level React Native developer. Each sprint ends with a demo-able, testable build.

---

### Sprint 0 — Pre-Flight Decisions & Project Bootstrap
**Duration:** 3–5 days  
**Goal:** Resolve all blocking product/legal/architecture decisions before any feature code is written.

#### Blocking Decisions (Must Resolve Before Sprint 1)

**Decision 1: Apple IAP strategy for paid courses**
Apple guideline 3.1.1 requires IAP for digital goods consumed in-app. eSewa/Khalti will likely be rejected on iOS for course purchases. Choose one:
- (a) Hide iOS course purchases entirely, route users to web browser to purchase
- (b) Integrate RevenueCat + Apple IAP for iOS only; keep eSewa/Khalti for Android
- (c) Reclassify as access to real-world tutoring (risky, Apple scrutinizes)

This decision changes Sprint 7 architecture. Do not skip it.

**Decision 2: JWT lifetime + refresh strategy**
Recommend: access token 15 min, refresh token 30 days. Backend must expose `/api/mobile/login` and `/api/mobile/refresh` before Sprint 1 starts.

**Decision 3: Withdrawal currency lock semantics**
Confirm with backend team: is `nprEquivalent` locked at request creation time or recomputed at admin approval? Doc says locked — verify before building withdrawal UI.

**Decision 4: Sign in with Apple scope**
Apple requires Sign in with Apple if any other third-party social login (e.g. Google) is offered. Confirm it is in scope — it is required, not optional.

#### Bootstrap Tasks
- `npx create-expo-app` with `expo-router` + TypeScript
- Configure NativeWind + extract/map theme tokens from `globals.css`
- Set up Redux Toolkit with 7 slices: `auth`, `user`, `feed`, `channel`, `channels`, `upload`, `config`
- Install and configure Sentry for crash + error reporting. Wire up before any other code.
- Configure EAS with `development`, `staging`, `production` profiles
- Set up `.env` per profile
- Add ESLint + Prettier + Husky pre-commit hook
- Copy `types/` folder from web repo, set up sync mechanism

**Definition of Done:** App boots to blank screen, theme tokens render correctly, Sentry receives a test crash, EAS build succeeds on both platforms.

---

### Sprint 1 — Auth, Session & Suspended-Account Gate
**Goal:** Users can sign up, sign in, sign out, and the app correctly gates suspended accounts.

- Build Phase 1 (Landing) and Phase 2 (Auth) screens
- Implement JWT bridge: `POST /api/mobile/login`, `POST /api/mobile/register`, `POST /api/mobile/refresh`
- Store access + refresh tokens in `expo-secure-store`
- Write Axios interceptor: attach Bearer token, handle 401 with one silent refresh attempt, force logout on refresh failure
- Implement Google Sign-In (`expo-auth-session`) and Sign in with Apple
- Add deep-link handler for email verification and password reset
- Fetch `GET /api/platform` (PlatformConfig) on launch → store in Redux `config` slice with 1-hour TTL
- Refresh PlatformConfig on every cold start and on foreground if cache is stale
- Show blocking splash until first PlatformConfig load completes
- On every foreground and immediately after login: fetch `/api/users/me`, check `isSuspended` → if true, navigate to `suspended.tsx`

**Definition of Done:** Sign up → email verify → log in → see empty home. Suspend a test user via admin panel → app shows full-screen blocker on next foreground.

---

### Sprint 2 — Navigation Shell, Profile, Menu & Onboarding
**Goal:** All five tabs navigable, profile editable, menu populated, first-run onboarding shown.

- Build bottom tab navigator: 5 tabs with correct icons, labels, role-based Tab 3 label swap
- Style Tab 3 center button as elevated/accent-colored
- Build Menu tab with all sections (Profile, Wallet, Services, Account, Danger Zone)
- Build Profile Edit screen and Activity stats screen
- Implement onboarding video screen: fetch from `/api/onboarding-video`, play once per role, mark `seenOnboardingRoles` on completion, allow re-watch from Menu
- Admin notice banner: on every foreground, fetch unseen notices, show dismissible modal, mark seen
- Wire global Pusher connection with exponential backoff reconnect (max 30s), reconnect on `AppState` change to active
- Subscribe to `user-${userId}` Pusher channel for user-scoped notifications

**Definition of Done:** All 5 tabs render, profile editable, onboarding video shown on first login per role, admin notices display and dismiss correctly.

---

### Sprint 3 — Question Posting & Live Feed
**Goal:** End-to-end question lifecycle from student post to teacher view.

- **Student (Ask tab):** Build question form with all validations (title 6–180, body ≤5000, image picker, format/visibility/subject/level/stream selectors). Show remaining quota badge computed from `effectiveLimit`. When quota zero → replace submit with "Upgrade Plan" CTA deep-linking to plans screen.
- **Optimistic UI:** Show question immediately in "My Questions" with "Posting..." badge. Reconcile when API responds. Do not make users wait for a spinner.
- **Teacher (Feed tab):** FlatList with pull-to-refresh, infinite scroll, Pusher-driven real-time inserts. Sort `resetCount` desc, `createdAt` desc. Show "Attempt X of Y" badge on reset questions. Accept button → confirmation modal showing countdown duration from `answerFormat` config.
- **Local notification:** When teacher accepts a question, schedule a local notification at T-60s warning that the timer is almost up (fires even when app is backgrounded).

**Definition of Done:** Student posts question → appears in teacher's feed within 2 seconds via Pusher → teacher accepts → countdown starts.

---

### Sprint 4 — Channels, Chat Workspace & Rating Flow
**Goal:** Full real-time chat with attachments, close flow, and rating.

- **Channels tab:** List with last-message preview, unread badges, channel status
- **Workspace screen:** FlatList `inverted={true}`, custom message renderer (text, image, system messages), send text/image/file
- **Pusher:** Subscribe to `channel-${channelId}` — bind `channel:message`, `message:marked`, `message:deleted`
- **Message retry queue:** Queue failed messages in Redux + AsyncStorage, show "Sending..." state, retry on network return. This is not optional.
- **Close Channel flow:** Confirmation → mark solved → 5-star rating modal (student) → submit → handle channel disappearing from active list gracefully (question may reappear in teacher feed if reset)

**Definition of Done:** Two test accounts chat in real time, send images, close channel, rate, see point balances update.

---

### Sprint 5 — Wallet, Subscriptions & Manual Payments
**Goal:** Wallet access gated by biometrics, withdrawal flow, subscription plans, manual payments.

- **Wallet screen:** Gate with `expo-local-authentication`. If no biometrics enrolled → require account password re-entry. Show point balance, NPR equivalent, transaction history with type badges and filters, pending withdrawal status card.
- **Withdrawal flow:** Enforce `minWithdrawalPoints`, block if PENDING request exists (both proactive UI and backend 400/11000 error), allow saving eSewa number, show locked NPR rate on confirmation screen.
- **Subscription Plans screen:** Compare all plans with current quota usage. Upgrade flow.
- **Manual Payment flow:** Show admin eSewa number + QR from `PlatformConfig.manualPaymentQrCodeUrl`, capture transaction ID + transactor name + optional screenshot, submit as `multipart/form-data`. Handle 409 (duplicate completed) with clear error.
- **Screenshot policy:** Android `FLAG_SECURE` on wallet/withdrawal screens. iOS: detect only, log/warn, do not promise blocking.
- **Push notifications:** Wire FCM/APNs in this sprint (needed for withdrawal alerts). Handle `withdrawal:processed`, `subscription:activated`, `monthly:bonus`, `daily:target` push types. Tap → deep link to wallet.

**Definition of Done:** Go plan purchased via manual payment → admin approves → subscription active. Teacher requests withdrawal → sees pending status → admin approves → balance updates with push notification received.

---

### Sprint 6 — Gateway Payments, Courses & Quizzes
**Goal:** eSewa/Khalti WebView flows, course playback with progress, quiz with corrected anti-cheat.

- **eSewa and Khalti:** Open `react-native-webview`, intercept success/failure redirect via URL pattern matching and deep link fallback. Verify on backend before showing success — never trust client-side redirect.
- **Courses tab:** Course library, course detail with sections + videos, `expo-video` for HLS/Mux, watch-time tracking (ping every 10s, pause on background/pause), enforce 90% threshold for section completion, coupon code input, distinct badges per access type.
- **Live Sessions:** `zoomus://` deep link with HTTPS fallback.
- **Quiz session:** Timer, question navigation, submission.
- **Anti-cheat with grace period:**
  - Log `TAB_HIDDEN` when `AppState` → background/inactive
  - Log `BACK_NAVIGATION` on Android hardware back button intercept
  - **Grace window:** If app returns to active within 2 seconds → do NOT log violation
  - Ignore first background event within 500ms of quiz start (spurious lifecycle events)
  - Skip `FULLSCREEN_EXIT` and `DUPLICATE_TAB` entirely
  - Auto-submit with `submitReason: "ANTI_CHEAT"` only when `violationCount >= violationWarningLimit`
  - Show warning modal at every violation

**Definition of Done:** Khalti payment for course succeeds → enrollment created → video plays → 90% watched → section marked complete. Quiz session can be taken; backgrounding triggers warning; hitting limit auto-submits.

---

### Sprint 7 — Calls, Course Studio & Remaining Services
**Goal:** Voice/video calls, teacher course studio view, referrals, leaderboard, peer comments, remaining menu items.

- **LiveKit calls:** Install `@livekit/components-react-native`, configure permissions in `app.json`. Build full-screen incoming call UI triggered by high-priority push notification (`type: "incoming_call"`). Build active call UI: video tiles, mute, speaker, end call. Handle Call Settings in Menu.
- **Course Studio (teacher):** For MVP, scope to "view my courses + sales". Allow course creation on web for v1. Expand in v1.1.
- **Referrals:** Share screen with code + native share sheet (`questioncall://register?ref=CODE`). Show referral history with status badges. Verify deep-link signup awards bonuses on both sides.
- Finish remaining Menu items: Leaderboard, Peer Comments, Notices history, Call Settings, Theme toggle, Change Password, Delete Account request.

**Definition of Done:** Two devices complete a video call. Teacher views courses and sales. Referral signup awards bonuses correctly.

---

### Sprint 8 — Polish, Accessibility, Compliance & Store Submission
**Goal:** Ship.

- Run all 15 Critical User Journeys with logged test reports
- Write Maestro E2E tests for journeys 1–5
- Stress-test Pusher reconnect by toggling airplane mode mid-chat
- Test on cheapest available Android device

**Accessibility pass:**
- Minimum 44pt touch targets on all interactive elements
- Screen reader labels (`accessibilityLabel`) on all interactive elements
- Sufficient contrast in both dark and light themes
- Dynamic type support for at minimum wallet and chat screens

**Compliance and store prep:**
- Render Terms of Use and Privacy Policy dynamically from `PlatformConfig` (never bundled static)
- Write App Store and Play Store review notes explaining business model clearly
- Provide reviewer test accounts (student, teacher, admin)
- Complete App Privacy questionnaire with accurate data disclosure
- Add Apple IAP for iOS course purchases if Sprint 0 decision was option (b)

**Definition of Done:** App approved on both App Store and Play Store. Production users onboarded.

---

## 16. Final Launch Checklist

### 🔴 Must-Have Before Launch
- [ ] API base URL configured → Vercel backend
- [ ] Auth converted from cookies to Bearer JWT with refresh token flow
- [ ] JWT bridge endpoints on backend (`/api/mobile/login`, `/api/mobile/refresh`)
- [ ] 401 interceptor: silent refresh → retry → force logout
- [ ] `isSuspended` check on every foreground → shows full-screen blocker
- [ ] Teacher qualification/monetization state gates wallet features
- [ ] PlatformConfig fetched on launch, cached with TTL, refreshed on foreground
- [ ] Pusher connecting with exponential backoff reconnect
- [ ] LiveKit audio/video permissions and connections working
- [ ] Wallet shows exact NPR equivalent (points × pointToNprRate)
- [ ] Withdrawal: atomic, one-pending-at-a-time, minimum enforced, locked NPR rate shown
- [ ] eSewa/Khalti via secure WebView + backend verification before success
- [ ] Manual payment with screenshot upload working
- [ ] Question posting respects plan limits + optimistic UI
- [ ] Quiz anti-cheat: backgrounding triggers violation, 2-second grace window in place
- [ ] Message retry queue for offline sends
- [ ] All business constants from PlatformConfig (zero hardcoding)
- [ ] Sentry configured and receiving crashes

### 🟡 Must-Have Before App Store Review
- [ ] Biometric gate on wallet/withdrawal (password fallback if no biometrics)
- [ ] Android `FLAG_SECURE` on wallet/withdrawal screens
- [ ] iOS screenshot policy corrected in all user-facing copy
- [ ] Terms of Use and Privacy Policy dynamic from DB
- [ ] Deep links working for all payment callbacks and referral codes
- [ ] Push notifications (FCM/APNs) delivering for all event types
- [ ] Withdrawal push notification on approval/rejection
- [ ] Admin notice system showing and dismissing correctly
- [ ] Onboarding video shown on first login per role
- [ ] Call settings configurable in Menu
- [ ] Sign in with Apple implemented (required on iOS if Google Sign-In present)
- [ ] Apple IAP decision from Sprint 0 implemented

### 🟢 Should-Have for Feature Parity
- [ ] Daily target progress tracker in teacher dashboard
- [ ] Course coupon code input on purchase screens
- [ ] Peer comment system for qualified teachers
- [ ] Referral sharing with deep link generation
- [ ] Question reset badge showing "Attempt X of Y"
- [ ] Subscription plan comparison with current quota display
- [ ] All 7 Redux slices mirrored (including `config`)
- [ ] Cron side-effects handled gracefully (sudden call end, channel close, surprise credits)
- [ ] Accessibility pass (touch targets, screen reader labels, contrast)
- [ ] E2E tests for top 5 critical user journeys