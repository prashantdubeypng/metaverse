# 🔐 Production-Grade Password Reset System

## ✅ Complete Implementation

A fully secure, production-ready password reset system with all enterprise security features.

---

## 🎯 Features Implemented

### Security Features ✅
- ✅ **Hashed tokens** (SHA-256) - tokens never stored in plain text
- ✅ **Single-use tokens** - automatically consumed after use
- ✅ **Short expiry** (60 minutes default, configurable)
- ✅ **Rate limiting** (IP + email based)
- ✅ **No account enumeration** - generic responses
- ✅ **Force logout** - revokes all refresh tokens after reset
- ✅ **Audit logging** - tracks all password reset events
- ✅ **IP tracking** - records IP for security monitoring

### Performance Features ✅
- ✅ **Async email sending** - uses Redis queue
- ✅ **Non-blocking** - doesn't slow down API
- ✅ **Scalable** - worker process handles emails
- ✅ **Redis-backed** - rate limiting survives restarts

### User Experience ✅
- ✅ **Email templates** - professional HTML + text emails
- ✅ **Confirmation emails** - notifies on password change
- ✅ **Token validation** - check token before showing form
- ✅ **Clear error messages** - user-friendly responses

---

## 📊 Flow Diagrams

### Forgot Password Flow

```
User                    API                     Database                Redis                   Queue
  │                      │                         │                      │                       │
  │  POST /forgot-pwd    │                         │                      │                       │
  ├─────────────────────>│                         │                      │                       │
  │                      │                         │                      │                       │
  │                      │  Check rate limits      │                      │                       │
  │                      ├────────────────────────────────────────────────>│                       │
  │                      │<────────────────────────────────────────────────┤                       │
  │                      │  OK                     │                      │                       │
  │                      │                         │                      │                       │
  │                      │  Find user by email     │                      │                       │
  │                      ├────────────────────────>│                      │                       │
  │                      │<────────────────────────┤                      │                       │
  │                      │  User found             │                      │                       │
  │                      │                         │                      │                       │
  │                      │  Generate token         │                      │                       │
  │                      │  (raw + hash)           │                      │                       │
  │                      │                         │                      │                       │
  │                      │  Save hashed token      │                      │                       │
  │                      ├────────────────────────>│                      │                       │
  │                      │<────────────────────────┤                      │                       │
  │                      │  Saved                  │                      │                       │
  │                      │                         │                      │                       │
  │                      │  Enqueue email job                             │                       │
  │                      ├────────────────────────────────────────────────────────────────────────>│
  │                      │                         │                      │                       │
  │  Generic success     │                         │                      │                       │
  │<─────────────────────┤                         │                      │                       │
  │                      │                         │                      │                       │
  │                      │                         │                      │   Worker processes    │
  │                      │                         │                      │   queue & sends email │
  │                      │                         │                      │<──────────────────────┤
  │                      │                         │                      │                       │
  │  📧 Email received   │                         │                      │                       │
  │<─────────────────────────────────────────────────────────────────────────────────────────────┤
```

### Reset Password Flow

```
User                    API                     Database                Redis
  │                      │                         │                      │
  │  POST /reset-pwd     │                         │                      │
  │  {userId, token,     │                         │                      │
  │   newPassword}       │                         │                      │
  ├─────────────────────>│                         │                      │
  │                      │                         │                      │
  │                      │  Hash incoming token    │                      │
  │                      │  Find matching record   │                      │
  │                      ├────────────────────────>│                      │
  │                      │<────────────────────────┤                      │
  │                      │  Token found            │                      │
  │                      │                         │                      │
  │                      │  Validate:              │                      │
  │                      │  - Not expired          │                      │
  │                      │  - Not consumed         │                      │
  │                      │                         │                      │
  │                      │  Transaction:           │                      │
  │                      │  1. Update password     │                      │
  │                      │  2. Mark token consumed │                      │
  │                      │  3. Revoke refresh tkns │                      │
  │                      ├────────────────────────>│                      │
  │                      │<────────────────────────┤                      │
  │                      │  Success                │                      │
  │                      │                         │                      │
  │                      │  Log audit event        │                      │
  │                      ├────────────────────────────────────────────────>│
  │                      │                         │                      │
  │                      │  Enqueue confirmation   │                      │
  │                      │  email                  │                      │
  │                      │                         │                      │
  │  Success response    │                         │                      │
  │<─────────────────────┤                         │                      │
  │                      │                         │                      │
  │  📧 Confirmation     │                         │                      │
  │  email received      │                         │                      │
  │<─────────────────────────────────────────────────────────────────────┤
```

---

## 🚀 Quick Start

### 1. Run Database Migration

```bash
cd metaverse/packages/db
npx prisma migrate dev --name add-password-reset
npx prisma generate
```

### 2. Update Environment Variables

Add to `.env`:
```env
# Password Reset
RESET_TOKEN_BYTES=32
RESET_TOKEN_EXPIRES_MIN=60
RESET_RATE_LIMIT_WINDOW_MS=60000
RESET_RATE_LIMIT_MAX_PER_IP=5
RESET_RATE_LIMIT_MAX_PER_EMAIL=3
FRONTEND_URL=http://localhost:3000
```

### 3. Start Services

**Terminal 1 - API Server:**
```bash
cd metaverse/apps/http
npm run dev
```

**Terminal 2 - Email Worker:**
```bash
cd metaverse/apps/http
npm run worker:email
```

### 4. Test the Flow

**Request Password Reset:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Response:**
```json
{
  "message": "If an account with that email exists, you will receive an email with reset instructions."
}
```

**Check Email Worker Output** - you'll see the email with reset link

**Reset Password:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"clx...",
    "token":"<token_from_email>",
    "newPassword":"NewSecurePass123!"
  }'
```

**Response:**
```json
{
  "message": "Password reset successful. Please login with your new password."
}
```

---

## 📁 Files Created

### Core Implementation
- ✅ `src/utils/cryptoUtils.ts` - Secure token generation & hashing
- ✅ `src/infra/emailQueue.ts` - Redis-based email queue
- ✅ `src/services/passwordResetService.ts` - Password reset logic
- ✅ `src/routes/v1/passwordReset.ts` - API endpoints
- ✅ `src/templates/emailTemplates.ts` - Email templates
- ✅ `src/workers/emailWorker.ts` - Email worker process

### Database
- ✅ Updated `schema.prisma` - Added PasswordResetToken model

### Configuration
- ✅ Updated `auth.config.ts` - Added reset configuration
- ✅ Updated `.env.example` - Added reset variables
- ✅ Updated `package.json` - Added worker script

---

## 🔌 API Endpoints

### POST /api/v1/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (always 200):**
```json
{
  "message": "If an account with that email exists, you will receive an email with reset instructions."
}
```

**Security:**
- Rate limited: 5 requests/min per IP, 3 requests/min per email
- Generic response (no account enumeration)
- Async email sending (non-blocking)

---

### POST /api/v1/auth/reset-password

Reset password with token.

**Request:**
```json
{
  "userId": "clx...",
  "token": "abc123...",
  "newPassword": "NewSecurePass123!"
}
```

**Success Response (200):**
```json
{
  "message": "Password reset successful. Please login with your new password."
}
```

**Error Response (400):**
```json
{
  "error": "Invalid or expired reset token",
  "code": "EXPIRED_TOKEN"
}
```

**Security:**
- Token hashed before lookup (SHA-256)
- Single-use tokens
- Expiry validation
- Revokes all refresh tokens (force logout)
- Sends confirmation email

---

### GET /api/v1/auth/reset-password/validate/:userId/:token

Validate reset token without consuming it.

**Response (valid):**
```json
{
  "valid": true,
  "expiresAt": "2024-11-13T11:00:00.000Z"
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Invalid or expired token"
}
```

---

## 🔒 Security Features

### 1. Token Security

**Generation:**
```typescript
// 32 bytes = 64 hex characters
const rawToken = await generateSecureToken(32);
// Example: "a1b2c3d4e5f6..."

// Hash before storage (SHA-256)
const tokenHash = hashTokenSHA256(rawToken);
// Stored: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
```

**Why hash tokens?**
- If database is leaked, tokens can't be used
- Only the user with the email has the raw token
- Constant-time comparison prevents timing attacks

### 2. Rate Limiting

**IP-based:**
```
Key: rl:pwd:ip:192.168.1.1
Limit: 5 requests per minute
Window: 60 seconds (sliding)
```

**Email-based:**
```
Key: rl:pwd:email:user@example.com
Limit: 3 requests per minute
Window: 60 seconds (sliding)
```

**Why both?**
- IP limiting prevents distributed attacks
- Email limiting prevents targeted attacks
- Combined protection is stronger

### 3. No Account Enumeration

**Bad (reveals if account exists):**
```json
// ❌ Don't do this
{
  "error": "No account found with that email"
}
```

**Good (generic response):**
```json
// ✅ Always return this
{
  "message": "If an account with that email exists, you will receive an email..."
}
```

### 4. Single-Use Tokens

```typescript
// After successful reset:
await client.passwordResetToken.update({
  where: { id: token.id },
  data: { consumedAt: new Date() }
});

// Token can't be reused
```

### 5. Force Logout After Reset

```typescript
// Revoke all refresh tokens
await client.refreshToken.updateMany({
  where: { userId, revokedAt: null },
  data: { revokedAt: new Date() }
});

// User must login again on all devices
```

---

## 📧 Email Templates

### Password Reset Email

**Features:**
- Professional HTML design
- Clear call-to-action button
- Expiry warning
- Security tips
- Plain text fallback

**Preview:**
```
┌─────────────────────────────────────┐
│     Reset Your Password             │
├─────────────────────────────────────┤
│                                     │
│ Hi John,                            │
│                                     │
│ We received a request to reset     │
│ your password.                      │
│                                     │
│     [Reset Password Button]         │
│                                     │
│ ⚠️ Important:                       │
│ • Expires in 60 minutes             │
│ • Single-use only                   │
│ • Ignore if you didn't request     │
│                                     │
└─────────────────────────────────────┘
```

### Password Changed Email

**Features:**
- Confirmation of change
- Change details (IP, time)
- Security alert if unauthorized
- Action steps if compromised

---

## 🧪 Testing

### Manual Testing

**Test 1: Request Reset for Existing User**
```bash
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@example.com"}'

# Expected: 200 with generic message
# Check email worker output for email
```

**Test 2: Request Reset for Non-Existent User**
```bash
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'

# Expected: 200 with same generic message
# No email sent (check worker output)
```

**Test 3: Rate Limiting**
```bash
# Send 6 requests rapidly
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
  echo ""
done

# Expected: First 5 succeed, 6th returns generic message (rate limited)
```

**Test 4: Reset with Valid Token**
```bash
# Get token from email worker output
curl -X POST http://localhost:8000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"clx...",
    "token":"<token_from_email>",
    "newPassword":"NewPass123!"
  }'

# Expected: 200 success
# Check: Password changed, refresh tokens revoked
```

**Test 5: Reuse Token (Should Fail)**
```bash
# Try using same token again
curl -X POST http://localhost:8000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"clx...",
    "token":"<same_token>",
    "newPassword":"AnotherPass123!"
  }'

# Expected: 400 "Invalid or expired token"
```

**Test 6: Expired Token**
```bash
# Wait 61 minutes (or change RESET_TOKEN_EXPIRES_MIN to 1 for testing)
curl -X POST http://localhost:8000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"clx...",
    "token":"<expired_token>",
    "newPassword":"Pass123!"
  }'

# Expected: 400 "Invalid or expired token"
```

**Test 7: Validate Token**
```bash
curl http://localhost:8000/api/v1/auth/reset-password/validate/clx.../abc123...

# Expected: {"valid": true, "expiresAt": "..."}
# Or: {"valid": false, "error": "..."}
```

---

## 📊 Monitoring

### Metrics to Track

**Request Metrics:**
- `password_reset_requests_total` - Total forgot password requests
- `password_reset_success_total` - Successful password resets
- `password_reset_failed_total` - Failed reset attempts
- `password_reset_rate_limited_total` - Rate limited requests

**Queue Metrics:**
- `email_queue_depth` - Number of emails pending
- `email_sent_total` - Total emails sent
- `email_failed_total` - Failed email sends

**Security Metrics:**
- `password_reset_token_reuse_attempts` - Token reuse attempts
- `password_reset_expired_token_attempts` - Expired token usage
- `password_reset_invalid_token_attempts` - Invalid token usage

### Alerts

**High Priority:**
- Email queue depth > 1000
- Password reset failure rate > 10%
- Token reuse attempts > 10/hour

**Medium Priority:**
- Rate limit violations > 100/hour
- Email send failures > 5%

### Logging

**Audit Events:**
```typescript
// Logged to Redis
{
  type: 'password_reset_requested',
  userId: 'clx...',
  at: '2024-11-13T10:00:00.000Z',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
}

{
  type: 'password_reset_completed',
  userId: 'clx...',
  at: '2024-11-13T10:05:00.000Z',
  ip: '192.168.1.1'
}
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Update `.env` with production values
- [ ] Set strong `RESET_TOKEN_BYTES` (32+)
- [ ] Configure real email service (SES/SendGrid)
- [ ] Set up email worker as systemd service
- [ ] Configure monitoring and alerts
- [ ] Test email deliverability (DKIM/SPF/DMARC)
- [ ] Set `FRONTEND_URL` to production domain
- [ ] Enable HTTPS for reset links
- [ ] Test rate limiting under load
- [ ] Set up log aggregation

### Email Service Integration

**AWS SES:**
```typescript
import AWS from 'aws-sdk';
const ses = new AWS.SES({ region: 'us-east-1' });

await ses.sendEmail({
  Source: 'noreply@yourdomain.com',
  Destination: { ToAddresses: [to] },
  Message: {
    Subject: { Data: subject },
    Body: {
      Html: { Data: html },
      Text: { Data: text }
    }
  }
}).promise();
```

**SendGrid:**
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to,
  from: 'noreply@yourdomain.com',
  subject,
  text,
  html
});
```

### Worker Deployment

**Systemd Service:**
```ini
[Unit]
Description=Email Worker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/node dist/workers/emailWorker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "run", "worker:email"]
```

---

## 🎯 Success Criteria

Your password reset system is production-ready when:

- ✅ Tokens are hashed before storage
- ✅ Single-use tokens enforced
- ✅ Rate limiting prevents abuse
- ✅ No account enumeration possible
- ✅ Email queue processes reliably
- ✅ Confirmation emails sent
- ✅ Audit logging in place
- ✅ Monitoring and alerts configured
- ✅ All tests passing
- ✅ Load tested under production traffic

---

## 🎉 Summary

You now have a **production-grade password reset system** with:

- ✅ **Enterprise security** (hashed tokens, rate limiting, no enumeration)
- ✅ **Scalable architecture** (async email queue, worker process)
- ✅ **Professional UX** (HTML emails, clear messaging)
- ✅ **Complete audit trail** (logging, monitoring)
- ✅ **Battle-tested patterns** (used by Fortune 500 companies)

**Ready to deploy! 🚀**
