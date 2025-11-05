# Deploy on Replit

This guide covers deploying AttorneyLeads on Replit for both development and production.

## Development Deployment

### Initial Setup

1. **Open Replit Workspace**
   - Navigate to your Replit project
   - Ensure you're using Node 20, Python 3.11, and Postgres 16

2. **Configure Environment Variables**
   
   Go to the **Secrets** panel (🔒 icon in left sidebar) and add:
   
   **Required**:
   ```
   DATABASE_URL=<your-neon-postgres-url>
   AI_INTEGRATIONS_OPENAI_API_KEY=<your-openai-key>
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   SESSION_SECRET=<random-secure-string>
   ```
   
   **Optional** (for CRM features):
   ```
   PHANTOMBUSTER_API_KEY=<your-phantombuster-key>
   CALENDLY_API_KEY=<your-calendly-key>
   CALENDLY_USER_URI=<your-calendly-user-uri>
   GOOGLE_SHEETS_TOKEN=<your-sheets-token>
   ```

3. **Install Dependencies**
   
   In the Shell tab:
   ```bash
   npm install
   ```

4. **Initialize Database**
   
   Push the Drizzle schema to your Postgres database:
   ```bash
   npm run db:push
   ```
   
   If you get data-loss warnings:
   ```bash
   npm run db:push --force
   ```

5. **Start Development Server**
   
   ```bash
   npm run dev
   ```
   
   The application will be available at:
   - **Webview**: Click the webview icon or open the provided URL
   - **Port**: 5000 (automatically exposed by Replit)

### Development Workflow

The `.replit` configuration is already set up to:
- Use Node 20 runtime
- Run `npm run dev` automatically on "Start application" workflow
- Serve port 5000 externally
- Auto-restart on file changes (via Vite)

**Key Commands**:
```bash
# Development server (hot reload enabled)
npm run dev

# Run database migrations
npm run db:push

# Check logs
# Use Replit Console or check /tmp/logs/
```

## Production-like Deployment

For a production-style build and server:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Client**
   
   Compiles the React app for production:
   ```bash
   npm run build
   ```
   
   This creates optimized bundles in `client/dist/`.

3. **Start Production Server**
   
   ```bash
   npm start
   ```
   
   This serves:
   - API routes at `/api/**`
   - Built React SPA from `client/dist/`

4. **Verify Deployment**
   
   - Open `/` in browser → Should load React app
   - Call `/api/stats` → Should return JSON statistics
   - Check console → No errors

## Publishing on Replit

Replit provides one-click publishing for production deployment:

### Steps to Publish

1. **Click "Publish" Button**
   - Located in top-right corner of Replit editor
   - Opens publishing configuration panel

2. **Configure Publishing**
   - **Deployment name**: `attorneyleads-prod`
   - **Environment**: Production
   - **Build command**: `npm run build`
   - **Run command**: `npm start`
   - **Port**: 5000

3. **Set Production Secrets**
   
   Ensure all required secrets are set in Production environment:
   - `DATABASE_URL` (use production Neon database)
   - `AI_INTEGRATIONS_OPENAI_API_KEY`
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`
   - `SESSION_SECRET` (use strong random value)
   - CRM integration keys (if using)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Replit will provide a `.replit.app` domain

5. **Custom Domain** (Optional)
   
   To use your own domain:
   - Go to Replit deployment settings
   - Add custom domain (e.g., `app.attorneyleads.com`)
   - Configure DNS CNAME record pointing to Replit
   - Enable HTTPS (automatic via Replit)

### Post-Deployment Checks

After publishing, verify:

- [ ] Application loads at published URL
- [ ] `/api/stats` returns data
- [ ] Database connection working
- [ ] AI enrichment working (`/api/ai/test`)
- [ ] Scraping jobs can be created
- [ ] No console errors in production

## Database Setup (Neon)

### Creating Neon Database

1. **Sign up at Neon.tech**
   - Create free account
   - Or use Replit's built-in Postgres

2. **Create Database**
   - Name: `attorneyleads_prod`
   - Region: Choose closest to Replit servers (US East recommended)

3. **Get Connection String**
   - Copy `DATABASE_URL` from Neon dashboard
   - Format: `postgres://user:password@host.neon.tech/dbname`

4. **Add to Secrets**
   - Paste into Replit Secrets panel as `DATABASE_URL`

5. **Run Migrations**
   ```bash
   npm run db:push
   ```

### Database Schema

The Drizzle schema in `shared/schema.ts` defines 7 tables:
- `arrest_records` - Core arrest record data
- `scrape_jobs` - Scraping job tracking
- `duplicate_candidates` - Duplicate detection results
- `crm_prospects` - CRM prospect database
- `outreach_campaigns` - Campaign tracking
- `scheduled_meetings` - Calendly meeting records
- `crm_sync_logs` - Export/sync history

**No manual SQL needed** - `drizzle-kit push` handles everything.

## Environment-Specific Configuration

### Development (.env.local)

```bash
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://localhost/attorneyleads_dev
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
SESSION_SECRET=dev-secret-change-me
```

### Production (Replit Secrets)

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://user:pass@neon.tech/attorneyleads_prod
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
SESSION_SECRET=strong-random-production-secret-here
```

## Troubleshooting Deployment

### Port Binding Issues

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
```bash
# Kill existing process
pkill -f "node server"

# Restart
npm run dev
```

### Database Connection Failures

**Error**: `Error connecting to database`

**Solution**:
1. Verify `DATABASE_URL` is set correctly
2. Check Neon database is active (not suspended)
3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

### Build Failures

**Error**: `Module not found` or `Cannot find module`

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf client/node_modules/.vite

# Rebuild
npm run build
```

### AI Integration Not Working

**Error**: AI enrichment fails, `/api/ai/test` returns error

**Solution**:
1. Check API key is valid and not expired
2. Verify base URL is correct
3. Test OpenAI directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $AI_INTEGRATIONS_OPENAI_API_KEY"
   ```

### Static Assets Not Loading

**Error**: 404 on `/assets/*` files

**Solution**:
1. Ensure `npm run build` completed successfully
2. Check `client/dist/` directory exists
3. Verify Vite config serves static files correctly
4. Check server logs for static file serving errors

## Performance Optimization

### For Production

1. **Enable Compression**
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

2. **Set Caching Headers**
   ```typescript
   app.use('/assets', express.static('client/dist/assets', {
     maxAge: '1y',
     immutable: true
   }));
   ```

3. **Database Connection Pooling**
   ```typescript
   // Already configured in server/db.ts via Drizzle
   // Neon handles pooling automatically
   ```

4. **Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   
   app.use('/api/', limiter);
   ```

## Monitoring & Logging

### Replit Logs

- Access via Replit Console
- Logs stored in `/tmp/logs/`
- Workflow logs auto-rotate

### Custom Logging

```typescript
// Structured logging (recommended)
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

logger.info({ userId: 123 }, 'User logged in');
logger.error({ err }, 'Failed to process request');
```

### Metrics Tracking

Recommended tools:
- **Sentry** - Error tracking
- **Posthog** - Product analytics
- **Datadog** - APM and monitoring

## Backup Strategy

### Database Backups

**Automated** (Neon):
- Daily automatic backups
- 7-day retention (free tier)
- 30-day retention (paid tier)

**Manual Backup**:
```bash
# Export all data
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Code Backups

- Primary: Git repository (GitHub, GitLab)
- Secondary: Replit auto-saves
- Recommended: Daily commits to version control

## Security Checklist

Before going live:

- [ ] All secrets stored in Replit Secrets (not committed)
- [ ] `SESSION_SECRET` is strong random value
- [ ] Database uses strong password
- [ ] HTTPS enabled (automatic on Replit)
- [ ] Rate limiting enabled
- [ ] Input validation via Zod on all endpoints
- [ ] CORS configured appropriately
- [ ] Security headers set (consider `helmet`)
- [ ] Error messages don't leak sensitive info
- [ ] Database connection uses SSL

## Rollback Procedure

If deployment issues occur:

1. **Revert to Previous Version**
   ```bash
   git revert HEAD
   git push
   ```

2. **Redeploy**
   - Click "Deploy" in Replit again
   - Or restart with `npm start`

3. **Database Rollback**
   - If schema changed, restore from backup
   - Run: `psql $DATABASE_URL < backup_before_deploy.sql`

## Support & Resources

- **Replit Docs**: https://docs.replit.com
- **Neon Docs**: https://neon.tech/docs
- **Drizzle Docs**: https://orm.drizzle.team
- **Project Docs**: See `/docs` directory in repo

For issues, check:
1. Replit Console logs
2. `docs/OPERATIONS.md` runbooks
3. GitHub Issues (if using)
