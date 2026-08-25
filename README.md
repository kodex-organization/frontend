# CueCloud Frontend - Dev 4 Handoff

Last audited against the local codebase: 2026-08-21.

This is the frontend handoff for Phase 4, Dev 4. It records the current Next.js
application, API/auth behavior, completed screens, placeholders, and the UI work
required for all 12 features.

The backend handoff is in `../backend/README.md`. Read both files before making
Phase 4 changes because branch switching, tenant isolation, super-admin auth,
impersonation, and export security cannot be implemented only in the browser.

## Project at a Glance

- Framework: Next.js 15 App Router, React 19, TypeScript.
- Styling: Tailwind CSS with shared controls under `src/components/ui`.
- Icons: `lucide-react`.
- Notifications: Firebase Web Messaging plus in-app notification APIs.
- Offline data: Dexie/IndexedDB and sync helpers.
- Frontend URL: `http://localhost:3001`.
- Backend URL: `http://localhost:3000/api/v1`.
- Current frontend typecheck: passing with `npm.cmd run typecheck`.
- Automated frontend tests: none; `tests/unit` and `tests/e2e` contain only
  `.gitkeep` files.

## Local Setup

```powershell
npm install
npm.cmd run dev
```

The frontend uses `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=CueCloud
```

Firebase browser values are optional and may also be present. Do not put server
private keys or backend secrets in any `NEXT_PUBLIC_*` variable.

Run the backend on port 3000 before logging in. Useful checks:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## API Proxy and Recent Login Fix

Browser API calls use the pathname from `NEXT_PUBLIC_API_URL`, currently
`/api/v1`. Next.js rewrites that path to the backend origin.

The correct flow is:

```text
Browser POST http://localhost:3001/api/v1/auth/login
  -> Next.js rewrite
Backend POST http://localhost:3000/api/v1/auth/login
```

`next.config.ts` was fixed so the destination is `${apiUrl}/:path*`. The old
destination added `/api/v1` twice and caused login to return 404. Restart the
frontend dev server after changing `next.config.ts` or `.env.local`.

The shared client is `src/lib/api/client.ts`. It:

- Adds the bearer access token.
- Sends the httpOnly refresh cookie with `credentials: "include"`.
- Adds device and branch headers from the JWT.
- Deduplicates token refresh after a 401.
- Clears local auth state when refresh fails.
- Unwraps the shared `{ success, data, error }` API envelope.

## Current Auth and Routing

Auth files:

- `src/features/auth/index.ts`: login, PIN login, logout, language, staff API.
- `src/lib/auth/session.ts`: local access-token/user storage and JWT parsing.
- `src/lib/auth/auth-context.tsx`: app auth state and redirects.
- `src/components/security/ProtectedRoute.tsx`: frontend role guard.

Only the short-lived access token and public user are in localStorage. The
refresh token is an httpOnly backend cookie. Current browser roles are OWNER,
MANAGER, ACCOUNTANT, and CASHIER. `SessionUser` has one `branchId`; there is no
assigned-branches collection or SUPER_ADMIN role yet.

Owner/operations route group:

| Route | Current state |
| --- | --- |
| `/login` | Working password and PIN login UI |
| `/dashboard` | Existing dashboard feature |
| `/floor-view` | Working floor status, timers, notifications |
| `/sessions` | Session operations UI |
| `/catalog` | Table/rate-plan management UI |
| `/billing` and `/billing/[id]` | Invoice, payment, discount, void UI |
| `/udhaar` | Balances, ledger, aging, settlement, threshold UI |
| `/customers` and `/customers/[id]` | Customer list/profile/history UI |
| `/governance` | Approval, override, handover, takeover, audit UI |
| `/notifications` | Notification preferences/devices/logs UI |
| `/sync-status` | Offline/sync state UI |
| `/settings/staff` | Staff creation UI |
| `/settings/security` | Device and login-history UI |
| `/reports` | Placeholder text only |

Super-admin route group:

| Route | Current state |
| --- | --- |
| `/tenants` | Placeholder text only |
| `/audit` | Placeholder text only |

`src/features/tenancy`, `reporting`, `dashboard`, and `audit` are mostly marker
files, not Phase 4 implementations. The super-admin layout is not protected by
an auth or role guard.

## Dev 4 Frontend Work

### 1. Cross-Branch Reports - Must Have

Replace the `/reports` placeholder with an OWNER-only reporting workspace:

- Date range and multi-branch filters.
- Consolidated revenue, sessions, session duration, udhaar issued/received, and
  outstanding udhaar.
- Per-branch comparison table.
- Loading, empty, partial-data, error, and retry states.
- Export action only after the backend provides an authorized export/report.

Do not aggregate by downloading every tenant record into the browser. The
backend must return tenant-scoped aggregates.

### 2. Branch Switching UI - Must Have

Add a branch selector to `OwnerShell`, preferably near the current user identity
or page header. Load only branches assigned to the logged-in user. Hide or
disable it when only one branch is available.

On switch:

1. Call the backend switch endpoint.
2. Replace the access token and stored `SessionUser.branchId` atomically.
3. Update `AuthContext` immediately.
4. Clear/refetch branch-scoped screen state and notification state.
5. Reset or re-scope offline/Dexie data so records from the previous branch are
   never displayed under the new branch.
6. Navigate to a valid route and show a concise success/error notification.

Do not make an `X-Branch-Id` header alone authoritative. The backend must issue
a token for a branch after validating assignment, and refresh must preserve it.

### 3. Branch Delete Guard UI - Must Have

Add owner branch-management UI after backend branch CRUD exists. Before delete,
show a confirmation naming the branch. When the API returns
`BRANCH_DELETE_BLOCKED`, display blocker counts for active/paused sessions and
unsettled udhaar. Do not remove the branch optimistically before server success.

After deleting the active branch, switch to another assigned branch using the
server flow and refresh branch lists.

### 4. Tenant Isolation Tests - Must Have

Add frontend unit and E2E infrastructure. At minimum test:

- A switched branch refreshes data and does not show stale previous-branch rows.
- Users cannot select or force an unassigned branch.
- OWNER cross-branch reports contain only the current tenant.
- Direct URLs cannot bypass role guards.
- Super-admin screens require real super-admin auth.
- Impersonation clearly identifies the target tenant and can be ended.
- Export/download links cannot be reused by a different tenant/user.

Frontend tests complement backend isolation tests; browser route guards are not
a security boundary.

### 5. Peak-Hour Rate Multiplier - Should Have

Add a branch settings editor for one or more peak rules: day(s), local start/end
time, multiplier, enabled state, and effective dates if supported. Use numeric
validation and show overlapping-rule errors from the API. Session screens should
display the applied rate returned by the backend, not recalculate money in the
browser.

### 6. Subscription Management - Must Have

Add protected super-admin pages for plans and tenant subscriptions. Support plan,
billing cycle, status, payment status, period dates, next billing date, and grace
period. Include filters and explicit confirmation for suspension/cancellation.

### 7. Platform Health Dashboard - Must Have

Add a protected super-admin dashboard with platform totals, active sessions,
tenant/branch usage, sync heartbeat health, failed sync batches, notification
failures, and API error rate. Include timestamp/freshness and drill-down filters;
do not label missing telemetry as zero.

### 8. Support Impersonation - Must Have

Only a real authenticated platform admin may start impersonation. The start flow
must select tenant/branch, valid consent, reason, and allowed scope. While active,
show a persistent high-visibility banner with tenant, admin, reason/scope, expiry,
and an End Impersonation command. Keep normal admin and impersonation sessions
separate so exiting reliably restores the admin context.

### 9. System Announcements - Must Have

Add super-admin create/edit/preview/publish/archive screens. Add a tenant-facing
announcement banner or inbox in the owner dashboard, honoring audience, start,
expiry, and read/dismiss state returned by the backend.

### 10. Release Management - Must Have

Add super-admin release/channel pages for version, channel, status, notes,
publish time, and minimum supported version. Add tenant channel assignment.
This UI manages metadata; it must not expose server deployment commands.

### 11. Data Export on Demand - Must Have

Add a tenant-owner export request/history screen and optionally a super-admin
diagnostic view. Show queued/running/completed/failed/expired states, creation and
expiry time, format, size/checksum where available, and an authorized download
action. Never generate a full tenant export only in the browser.

### 12. Impersonation Audit - Must Have

Replace the `/audit` placeholder with a searchable super-admin audit view. Show
consent, original admin, target tenant/branch, start/end, reason, expiry, end
reason, and linked actions. Audit details must make impersonated actions visibly
different from ordinary tenant-user actions.

## Recommended Frontend Structure

Keep the current feature-based organization:

```text
src/features/tenancy/
  api.ts
  types.ts
  branch-switcher.tsx
  branch-management.tsx

src/features/reporting/
  api.ts
  types.ts
  cross-branch-report.tsx

src/features/super-admin/
  api.ts
  types.ts
  subscription/
  health/
  impersonation/
  announcements/
  releases/
  exports/
  audit/
```

Use the existing `apiFetch` client and UI controls. Keep money/time calculations
on the backend and display returned values using branch currency/timezone.

## Known Gaps and Risks

- Reports, tenants, and platform audit pages are placeholders.
- No branch selector or assigned-branch API exists.
- `SessionUser` and AuthContext support only one fixed branch.
- Access-token refresh currently reverts to backend `User.branchId` unless the
  backend refresh-session model is changed.
- Super-admin routes have no protection and no SUPER_ADMIN role/identity.
- Offline/Dexie state must be audited before switching branches; visual state
  reset alone is not enough for isolation.
- Backend billing and sync currently have known unscoped routes. Do not call a
  feature complete until the backend README's isolation risks are fixed.
- There is no frontend test runner or test suite yet.
- Some current UI/API modules handle legacy response shapes; new Phase 4 APIs
  should use the shared envelope consistently.

## Completion Checklist

- Both projects typecheck and build.
- All 12 features have real loading, empty, error, and permission states.
- Branch switching survives refresh, access-token rotation, and multiple tabs.
- No stale previous-branch data remains visible after a switch.
- Super-admin pages are protected by server-issued admin authentication.
- Impersonation is always visible and has a reliable exit path.
- Tenant users receive only applicable active announcements.
- Export downloads are authorized and expired links fail cleanly.
- Unit and E2E tests cover branch, tenant, role, and impersonation boundaries.
- The login proxy remains `/api/v1/*` on port 3001 to `/api/v1/*` on port 3000.

## Recommended Implementation Order

1. Wait for/finalize backend auth and isolation contracts.
2. Extend auth state for assigned branches and secure branch switching.
3. Build branch management, reports, and peak-hour settings.
4. Add real super-admin auth protection and navigation.
5. Build subscription, health, announcements, releases, and export screens.
6. Build consent/impersonation and linked audit screens.
7. Add unit/E2E tests and verify cross-tenant behavior with two tenants.
