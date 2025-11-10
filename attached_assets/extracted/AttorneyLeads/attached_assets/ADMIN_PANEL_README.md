
# Admin Panel + Admin Bootstrap + Admin Link on Landing

This patch adds an Admin Panel at **/admin/users**, server-side admin APIs, and a landing page **Admin login** link.

## Save your Admin secrets (Replit → Tools → Secrets)
Create the following secrets (env vars):
```
ADMIN_EMAIL=elite@lawpracticepros.com
ADMIN_PASSWORD=EliteLaw2025!
ADMIN_NAME=Jarred
```
> You can change these values anytime; re-run the bootstrap route to sync.

## Bootstrap the Admin user
Run this once (e.g., from your terminal or via a quick `curl`):
```bash
curl -X POST https://YOUR-APP-URL/api/admin/bootstrap
```
- If the user doesn’t exist, it will be created as **admin**.
- If it exists, it will be **promoted to admin**, **activated**, and the password will be updated to match your secret.

## Routes added
- `GET /api/admin/users` — list users (admin only)
- `PATCH /api/admin/users/:id` — update role (`user|admin`) and active flag (admin only)
- `POST /api/admin/users/:id/reset` — trigger reset token (returns token only in test mode)

## Client pages
- `client/src/pages/admin/index.tsx` — Admin Panel UI
- `client/src/pages/login-landing.tsx` — now includes an **Admin login** link at the bottom
- `client/src/App.ROUTES.ADMIN.txt` — snippet to register the route `/admin/users`

## Server wiring
In your server bootstrap (where you mount routes), add:
```ts
import { registerAdminRoutes } from "./server/admin-routes";
import { registerAdminBootstrap } from "./server/admin-bootstrap";

registerAdminRoutes(app);
registerAdminBootstrap(app);
```

Admin users automatically have **full access** to `/api/admin/*` endpoints and the Admin Panel. Make sure other server endpoints that require elevated access check `req.session.user.role === "admin"` if needed.
