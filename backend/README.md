# Backend image uploads

Image uploads are processed by the backend and stored in Cloudinary. The Cloudinary API secret must remain in `backend/.env`; never add it to a `VITE_` variable or send it to the frontend.

## Configure Cloudinary

1. In the Cloudinary Console, open **Dashboard** and copy the cloud name, API key, and API secret.
2. Copy `.env.example` to `.env` in this folder if you have not already done so.
3. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`. Keep the file untracked; `.gitignore` excludes it.
4. Restart the backend after changing environment values:

   ```powershell
   cd backend
   npm run dev
   ```

The application can start without Cloudinary configured, but upload endpoints respond with `503` and a configuration message. If any Cloudinary variable is provided, all three are required.

## Verify uploads

- Sign in and upload or replace the profile photo from the private profile dashboard.
- Add or edit a project, select an optional cover and up to five screenshots, and save. Existing project image previews can be removed individually.
- In the Cloudinary Console, check the `kozett/avatars` and `kozett/projects` folders.
- Replacing/removing an image updates the database first, then asks Cloudinary to delete the old asset. If cleanup fails, the backend logs a generic cleanup warning without printing credentials or asset identifiers.

Uploads accept JPEG, PNG, and WebP images up to 5 MB each. File signatures are checked on the backend; the browser-provided MIME type is not trusted.

## Demo profile

The demo profile uses the dedicated username `sahilx1`; it never adopts or modifies an existing unmarked account. In development, seed, verify, or remove it with:

```powershell
cd backend
npm run seed:demo
npm run seed:demo:verify
npm run seed:demo:remove
```

The seed script refuses `NODE_ENV=production`. If the username is already present without the matching seed marker, it stops without writing. When the username is unused, the script creates a public demo-only account using the reserved `.invalid` email domain and a randomly generated password hash that is never printed or returned. To use the private dashboard for this dedicated account, set your own `DEMO_ACCOUNT_PASSWORD` (at least 12 characters) in `backend/.env` and rerun the seed command; it updates only the password hash of the explicitly marked demo account. The login email is `sahilx1-demo@demo.invalid`. Cleanup only deletes an account carrying the exact demo seed marker.

Demo statistics, project records, and skill assessments are explicitly labeled `DEMO DATA`. The aggregate counts reported platform solves (not unique problems), excludes GitHub data, and is calculated from stored platform rows. Skill thresholds default to 85/60/40 and can be changed with `ASSESSMENT_EXCELLENT_MIN`, `ASSESSMENT_INTERMEDIATE_MIN`, and `ASSESSMENT_BEGINNER_MIN`; thresholds must descend in that order. Demo assessment results are not credentials and demo certifications are not verified.

The authenticated dashboard and public profile API load the saved demo snapshot from MongoDB. The public endpoint honors section visibility and serializes only public-safe demo fields; demo usernames and repository labels are illustrative and are not asserted to be real external accounts.

## Password recovery

User recovery starts at `/forgot-password`; administrator recovery starts at `/ad/forgot-password`. Each flow verifies a six-digit OTP before accepting a new password. OTPs and reset authorizations are stored only as keyed hashes, expire after five and ten minutes respectively, and are one-use. Recovery attempts are rate-limited, old codes are replaced, failed guesses are capped, and all existing sessions are revoked after a successful password update. Administrator recovery remains scoped to active administrator accounts and does not change roles.

No email provider is configured in this build. For local-only testing, set `PASSWORD_RESET_DEV_OTP_ENABLED=true` in `backend/.env`, keep `NODE_ENV=development`, and use a loopback `FRONTEND_ORIGIN` such as `http://localhost:5173`. When enabled, the server binds to `127.0.0.1` and the development UI shows the OTP in a warning dialog. The backend refuses to start with this flag enabled outside development or with a non-loopback frontend origin. Leave the flag `false` (the default) in all deployments; it is never returned in production.

Recovery endpoints are `POST /api/auth/forgot-password`, `/verify-reset-otp`, `/resend-reset-otp`, and `/reset-password`, with matching administrator-scoped endpoints under `/api/admin/auth/`. Connect a real email provider by implementing `PasswordResetDeliveryService` and keeping provider delivery separate from OTP storage, verification, and password-update logic; remove or disable the development adapter before enabling production email delivery.

## Administrator control center

Configure `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` through the backend's local environment file or deployment secret store. Do not put the password in source control or frontend variables. Then run the explicit bootstrap command from `backend`:

```powershell
npm run admin:bootstrap
```

Bootstrap is never invoked on application startup. It hashes the password, creates a superadmin that must change the initial password at `/ad/login`, refuses to overwrite a regular account using that email, and does not reset an existing administrator. Both variables must be set together. In production, use the command only as a controlled deployment operation after confirming the configured MongoDB target.

The current admin APIs provide live overview aggregates, administrator-authenticated user/KDR inspection and account status controls, issued-certificate search/revocation, official feed-post publishing, post/comment report review, read-only withdrawal review, and append-only admin audit events. Certificate revocations change public verification status without changing historical assessment results. Report resolution does not automatically hide content or suspend an account.

Administrators with the `admin` or `superadmin` role can manage official Feed posts in `/ad/content/feed-posts`: create and edit drafts, attach validated Cloudinary images with alt text, publish, unpublish, or archive content, and restore archived posts to drafts. Only published posts are shown in the public Feed; existing user posts remain published by default. Permanent deletion is limited to drafts without likes, comments, bookmarks, or reports. Publication changes, edits, image changes, and deletion are audited.

Withdrawal requests currently support only `processing`, `review_pending`, and `rejected`. There is no persisted approval/completion state or payout integration, so the admin console is intentionally read-only for withdrawals and does not claim that any payout is complete. Assessment catalog editing, user-content hide/restore, contest/leaderboard administration, earning configuration, reward schedule editing, financial adjustments, announcements, and versioned platform settings are not enabled in this admin release.

## Earn rewards

Daily check-in rewards are enabled by default. `EARN_DAILY_CHECK_IN_ENABLED=false` disables the check-in opportunity; `EARN_MIN_WITHDRAWAL_PAISE` sets the minimum manual-review withdrawal request (default `10000`, or ₹100.00). Rewards use integer paise and the `Asia/Kolkata` calendar day. The server applies the configured streak tiers and stores claims in the authenticated user's ledger.

Withdrawal requests reserve available funds and remain pending manual review. The application has no payout provider or administrator workflow, so a request does not transfer money and this release cannot approve, reject, or complete requests. Do not represent a review request as a completed payout.

## Contest hub

`GET /api/contests` synchronizes the contest cache on demand from the official Codeforces API (`contest.list`) and then reads MongoDB. There are no background timers. The provider request has a five-second timeout, is attempted at most once per five minutes per running server, and failures leave previously cached results available. The sync accepts contests starting from the previous 30 days through the next 365 days. Codeforces is the only contest feed currently integrated; recognized platforms without a feed return no contests. No sample or generated contests are inserted.

Public endpoints:

- `GET /api/contests?search=&platform=&status=&page=1&limit=20&sort=soonest` returns `{ success, contests, page, limit, total, totalPages, lastSyncedAt, sources }`. `platform` accepts `Codeforces`, `CodeChef`, `LeetCode`, `GeeksforGeeks`, `HackerRank`, `HackerEarth`, `GitHub`, or `all`; unsupported providers have no cached contests. `status` is `upcoming`, `ongoing`, `finished`, or `all`. `sort` is `soonest`, `latest`, or `title`. Each contest has `{ id, externalContestId, title, platform, startTime, endTime, durationSeconds, status, contestUrl, registrationUrl, source, lastSyncedAt }`. `id` is the MongoDB ID; `externalContestId` is the Codeforces ID. Status is calculated from current time. Codeforces does not supply registration state in this feed, so `registrationStatus` is omitted.
- `GET /api/contests/:id` returns `{ success, contest }` for a MongoDB contest ID.

Authenticated endpoints:

- `GET /api/contests/performance` returns `{ success, platforms, combined, source }`. It uses real Codeforces rating history only; without a linked Codeforces profile and real history, `platforms` is empty and `combined` has zero counts.
- `GET /api/contests/ratings?platform=Codeforces` returns `{ success, ratings, platform, lastSyncedAt }`. Ratings are synchronized only for the current user when their saved Codeforces platform URL is an HTTPS `codeforces.com/profile/{handle}` URL. Other recognized platforms return an empty array. `ratings` entries contain `externalContestId`, `contestName`, `rank`, `oldRating`, `newRating`, `ratingChange`, `ratingUpdateTime`, and `source`.
- `GET /api/contests/my-contests` returns only the current user's bookmarked or participation-tracked contests as `{ success, contests }`; each item combines the public contest fields with `{ bookmarkId, participationStatus, personalNote, bookmarked }`.
- `POST /api/contests/:id/bookmark` and `DELETE /api/contests/:id/bookmark` return `{ success, saved, userContest? }`.
- `PATCH /api/contests/:id/participation` accepts `{ status, personalNote? }`, where status is `planned`, `registered`, `participated`, or `missed` and notes are limited to 1000 characters. It returns `{ success, userContest }`.

Bookmark and participation writes require the authenticated session and the existing CSRF cookie/header pair. A Codeforces registration URL is constructed using its canonical contest registration path because the public feed does not provide a separate URL; registration availability is not asserted.

## Kozett Feed

All feed endpoints are mounted at `/api/feed`, require the existing authenticated session, and protect writes with the existing CSRF cookie/header pair. List endpoints accept `limit` (default 20, maximum 50) and return `{ success, items, nextCursor }`; pass `nextCursor` as `cursor` to continue. Post and comment summaries include only public identity fields (`id`, `name`, `username`, `avatar`), never email or other private profile data. Avatar URLs also honor `visibility.avatar`. Private bookmarks and viewer state are returned only to the signed-in user.

- `GET /posts?mode=latest|following|trending&cursor=<opaque>&limit=20` (`mode` defaults to `latest`; limit is capped at 50) returns `{ success, items, nextCursor }`. Each post contains `{ id, author, text, link, projectLink, codeSnippet, hashtags, images, likesCount, commentsCount, likedByMe, savedByMe, following, createdAt, updatedAt, isAuthor }`. Modes use stored posts and engagement only; the service creates no sample content.
- `GET /hashtags/trending?limit=10` returns `{ success, items: [{ hashtag, postCount }], periodDays: 7, since }`, calculated from posts created in the trailing seven days by real public accounts only. Results are sorted by post count (then tag), and `limit` is capped at 20.
- `GET /suggestions?cursor=<opaque>&limit=20` returns `{ success, items, nextCursor }` for real public users with usernames, excluding the current user, followed users, seeded demo accounts, and demo-profile accounts. Each item includes public identity fields, `followersCount`, and `following: false`.
- `POST /posts` accepts `{ text?, link?, projectLink?: { title, url }, codeSnippet?: { language, code } }` and returns `{ success, post }`. Text is limited to 5000 characters; project links require a title and HTTP(S) URL; code snippets are limited to 50 language characters and 10000 code characters. At least one of text, link, project link, or code snippet is required. Hashtags are extracted from text.
- `GET/PATCH/DELETE /posts/:postId` reads or changes only visible posts; editing and deletion require ownership. `PATCH` accepts `text`, `link`, `projectLink`, and/or `codeSnippet`; pass `null` for either structured field to clear it.
- `POST /posts/:postId/images` accepts multipart field `image`, verifies JPEG/PNG/WebP signatures, and uploads to Cloudinary. Up to six images per post are allowed. `DELETE /posts/:postId/images/:imageId` removes an owned image. Image summaries return `{ id, url }`; Cloudinary public IDs are never sent to clients.
- `PUT/DELETE /posts/:postId/like` are idempotent and return `{ success, liked, likesCount }`. `GET /posts/:postId/comments?cursor=&limit=` returns `{ success, items, nextCursor }`; each comment contains `{ id, postId, author, text, createdAt, updatedAt, isAuthor }` (`author` is the public identity summary or `null`). `POST /posts/:postId/comments` accepts `{ text }` (1–2000 characters). `PATCH/DELETE /comments/:commentId` require comment ownership.
- `PUT/DELETE /users/:userId/follow` follow/unfollow public profiles and return `{ success, following, followersCount, followingCount }`. `GET /users/:userId/follow-counts` returns both counts and `isFollowing`.
- `PUT/DELETE /posts/:postId/bookmark` save/remove a private bookmark. `GET /saved` returns the current user's saved posts using the normal post-page shape.
- `GET /notifications?unreadOnly=true|false&cursor=&limit=` returns `{ success, items, unreadCount, nextCursor }`; `PATCH /notifications/:notificationId/read`, `PATCH /notifications/:notificationId/unread`, and `PATCH /notifications/read-all` update only the current user's notifications. Like, comment, and follow notification events are deduplicated.
- `GET /search?q=&type=posts|users&cursor=&limit=` performs bounded literal search (2–80 characters); post search checks text, hashtags, link URLs, and `projectLink.title`, and regular-expression syntax is escaped.
- `POST /posts/:postId/report` and `POST /comments/:commentId/report` accept `{ reason, details? }`, where `reason` is `spam`, `harassment`, `inappropriate`, `misinformation`, or `other`, and `details` is optional (maximum 1000 characters). Reports are stored for review, deduplicated per reporter and target, not automatically moderated, and retained if the reported post/comment is later deleted.

Post text, comments, links, uploads, reports, and interaction records are bounded and ownership-checked. Post visibility follows the author's `visibility.publicProfile` setting; private accounts' content is not included in public feed/search results.
