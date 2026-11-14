# Private photo uploads

The upload page is `/admin.html`. Only someone with the admin password can upload; uploaded photos are public so website visitors can see them.

## Vercel setup

1. Deploy this project to Vercel.
2. In the Vercel project, create and connect a Blob store under **Storage**. This provides `BLOB_READ_WRITE_TOKEN` to the project.
3. In **Settings → Environment Variables**, set these for **Production**:
   - `ADMIN_PASSWORD`: a unique, randomly generated password with at least 12 characters. Use a longer password and keep it private.
   - `SESSION_SECRET`: a random secret with at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Redeploy after connecting storage and adding the variables.
5. Visit `/admin.html`, sign in, and upload JPG, PNG, or WebP photos up to 4 MB each.

Do not put the password, session secret, or Blob token in website files or source control. The sign-in cookie expires after eight hours; changing the password revokes existing sessions.

The login endpoint applies a per-instance lockout after repeated failed attempts. Because Vercel functions can run in multiple instances, configure a Vercel Firewall rate limit for `/api/login` as an additional production safeguard.
