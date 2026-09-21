# StreamWave Security Policy

StreamWave takes security seriously. This document outlines our security architecture, policy, vulnerability reporting process, and baseline controls implemented across all platform subsystems as of Phase 30.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability within StreamWave, please report it privately:
- **Email**: `security@streamwave.local` (or designated security contact)
- **Do NOT** disclose vulnerabilities in public GitHub issues or forums.
- Include detailed steps to reproduce the issue (proof of concept, HTTP requests, or environment setup).
- We acknowledge reports within 48 hours and provide a timeline for remediation.

---

## 2. Core Security Architecture

### 2.1 Defense in Depth & Zero Trust Client Input
- **Server-Side Enforcement**: All authorization, authentication, sanitization, role checks, and quota validations are strictly performed on the backend. Client-provided state is never implicitly trusted.
- **Principle of Least Privilege**: Database connections use restricted operational privileges; users only have access to their own resources unless granted specific admin or moderator roles.
- **Fail-Safe Defaults**: Access is denied by default unless explicitly permitted by an authentication or authorization rule.

---

## 3. Threat Mitigation & Controls

### 3.1 Authentication & Session Management
- **Password Hashing**: Passwords are cryptographically salted and hashed using `bcrypt` with work factor 12 (`SALT_ROUNDS = 12`).
- **Account Lockout**: After 5 consecutive failed login attempts, user accounts are locked for 15 minutes.
- **Generic Auth Error Messages**: Login and registration error messages are generic (`"Invalid credentials"` or `"Password does not meet security requirements."`) to prevent user enumeration.
- **JWT & Session Invalidation**: Dual-token architecture (Access Token + Refresh Token). JWTs are cryptographically signed with high-entropy secrets and verified on every protected request. Refresh tokens are stored hashed in the database and revoked upon logout or password reset.
- **Device & Session Tracking**: Active user sessions are tracked with IP and User-Agent fingerprints, allowing users to revoke specific sessions or all other devices.

### 3.2 Injection Prevention (SQLi & NoSQLi)
- **Parameterized Queries**: All database interactions use MySQL parameterized/prepared statements (`?` placeholders) via `mysql2/promise`.
- **Wildcard Escaping**: User inputs targeting `LIKE` queries are escaped (`escapeLikeWildcards`) to prevent LIKE wildcard denial of service or data leakage.
- **No Dynamic SQL String Interpolation**: Codebase audits enforce zero dynamic string concatenation in SQL queries.

### 3.3 Cross-Site Scripting (XSS) & Content Security
- **HTML Sanitization**: All user-generated content (video titles, descriptions, comments, chat messages, user display names, bios) is sanitized server-side via `sanitizeText` to strip dangerous HTML tags and script injections.
- **URL Protocol Validation**: Profile websites and external links are strictly validated (`sanitizeUrl`) to only allow `http:` and `https:`, blocking `javascript:`, `data:`, and `vbscript:` schemes.
- **Content Security Policy (CSP)**: HTTP headers configure strict CSP rules:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com`
  - `img-src 'self' data: https: blob:`
  - `connect-src 'self' ws: wss: https://api.razorpay.com`
  - `frame-ancestors 'self'` (Clickjacking protection via `X-Frame-Options: SAMEORIGIN`)
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff` is enforced by Helmet.

### 3.4 Broken Object-Level Authorization (IDOR) & Privilege Escalation
- **Ownership Verification**: Resource modification (editing or deleting videos, comments, playlists, channels) strictly verifies that `resource.user_id === authenticatedUser.id` or that the user has `ADMIN` role.
- **Mass Assignment Protection**: Profile and resource updates explicitly whitelist allowable update fields. Roles (`role = 'ADMIN'`) cannot be escalated through user profile updates.
- **Admin Isolation**: Admin routes (`/api/admin/*`) require both valid authentication and the `ADMIN` role (`requireAdmin` middleware), returning `403 Forbidden` for unauthorized users.

### 3.5 File Upload Security & Path Traversal Prevention
- **Path Confinement**: All file upload operations use `path.resolve` and enforce that target destinations are strictly prefixed by the canonical `UPLOADS_ROOT` directory, neutralizing `../` path traversal attacks.
- **Extension & Magic-Byte Whitelisting**: Uploads are restricted by extension and verified against permitted MIME types (e.g., MP4/WebM for videos, JPEG/PNG/WebP for images). Dangerous executable formats (`.exe`, `.sh`, `.php`, `.js`, `.bat`) are rejected.
- **File Size Limits**: File size maximums are enforced at both the multer middleware level and HTTP request body limit level.
- **Access Control on Sensitive Storage**: Call files directory (`/uploads/call-files`) is explicitly protected with 403 Forbidden against direct static file serving.

### 3.6 WebRTC & Socket.IO Security
- **Socket Authentication Middleware**: Socket.IO connections require a valid JWT token; unauthenticated connections are rejected immediately upon handshake.
- **Room Authorization**: Users can only join, sync, or send WebRTC signals (`offer`, `answer`, `ice-candidate`) to rooms where they are active, verified participants.
- **Signaling Throttling**: Event-based rate limiting on sockets prevents signaling floods, typing indicator spam, and DoS.
- **In-Call Data Protection**: In-call chat messages and file transfers are validated, sanitized, and scoped strictly to authorized room participants.

### 3.7 Payment Gateway & Webhook Security
- **Cryptographic Signatures**: Razorpay payment verifications and webhooks use HMAC-SHA256 signature verification with `crypto.timingSafeEqual` to prevent timing attacks.
- **Order Idempotency**: Payment processing checks transaction status before updating balances or subscriptions, preventing double-credit attacks.
- **Rate Limiting on Payments**: Dedicated rate limiters on payment creation and verification prevent carding and payment abuse.

### 3.8 Information Disclosure & Error Handling
- **Production Error Masking**: In `NODE_ENV === 'production'`, HTTP 500 errors return a generic response (`"Something went wrong. Please try again."`), masking stack traces, internal paths, and SQL error details.
- **Startup Security Validation**: During server startup, critical security variables (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`) are validated to ensure the server never runs with default or insecure secrets.

---

## 4. Security Checklist Summary

| Domain | Control | Implementation |
|---|---|---|
| Passwords | Bcrypt 12 rounds | `authController.js` |
| Lockout | 5 attempts / 15 min lock | `authController.js` |
| Token Revocation | Refresh token blacklist/DB tracking | `authController.js`, `authMiddleware.js` |
| CSRF / Headers | Helmet CSP, HSTS, frameguard | `server.js` |
| Rate Limiting | IP & route-specific limiters | `rateLimiter.js`, `routes/*.js` |
| Input Sanitization | HTML stripping & URL validation | `sanitizer.js`, `authValidation.js` |
| SQLi Prevention | Prepared statements & LIKE escaping | `mysql2`, `sanitizer.js` |
| Upload Validation | Whitelists, size limits, path confinement | `uploadMiddleware.js`, `storageService.js` |
| WebRTC Signaling | JWT auth, membership check, rate limiting | `socketServer.js`, `roomSignaling.js` |
| Payments | HMAC-SHA256 timing-safe verification | `razorpayService.js`, `paymentService.js` |
| Admin Access | RBAC middleware & audit logging | `roleMiddleware.js`, `adminRoutes.js` |

---
*Last updated: Phase 30 Security Hardening*
