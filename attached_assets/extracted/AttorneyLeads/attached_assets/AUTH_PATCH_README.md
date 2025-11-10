
# Auth Patch — Secure Email/Password Login with Admin Panel

This patch adds:
- Postgres-backed **users** table (Drizzle)
- Cookie **sessions** (express-session + connect-pg-simple)
- **/api/auth** endpoints: bootstrap, register, login, logout, whoami
- **Admin users page** at `/admin/users`
- **Login page** at `/login` and route protection via `<PrivateRoute/>`
- Header Login/Logout controls

## Environment
Add the following to your `.env`:
```
DATABASE_URL=<your Neon Postgres URL>
SESSION_SECRET=<random-long-string>
SESSION_COOKIE_NAME=sid
SESSION_TTL_MS=28800000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeMeLong12Chars
```

## Migrate DB
```
npm run db:push
```

This will create `users` and `session` tables (session table is created at runtime if missing).

## Bootstrap first admin
Once the app is running, call:
```
POST /api/auth/bootstrap
```
(Only works when no users exist.)

## Login
Go to `/login`, sign in, then access the app normally.

