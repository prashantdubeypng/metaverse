# 📝 Production-Grade Logging System

## ✅ Complete Implementation

Your backend now has enterprise-grade logging with:
- ✅ **Structured JSON logs** (Pino)
- ✅ **Automatic file rotation** (daily + size-based)
- ✅ **Request tracing** (unique request IDs)
- ✅ **Error capture** (uncaught exceptions, unhandled rejections)
- ✅ **Sensitive data redaction** (passwords, tokens)
- ✅ **Multiple log files** (app.log, error.log, access.log)
- ✅ **Compression** (gzip for rotated files)
- ✅ **30-day retention** (configurable)
- ✅ **Console capture** (all console.log/error captured)
- ✅ **Prisma logging** (database queries and errors)

---

## 📁 Log Files

All logs are stored in `apps/http/logs/`:

| File | Purpose | Rotation |
|------|---------|----------|
| `app.log` | All application logs | Daily or 100MB |
| `error.log` | Errors only | Daily or 100MB |
| `access.log` | HTTP requests | Daily or 100MB |
| `*.log.gz` | Compressed archives | Kept for 30 days |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd metaverse/apps/http
npm install
```

New packages added:
- `pino` - Fast JSON logger
- `pino-http` - HTTP request logging
- `pino-pretty` - Pretty printing for development
- `rotating-file-stream` - Log rotation

### 2. Configure Environment

Add to `.env`:
```env
# Logging
LOG_LEVEL=info  # trace, debug, info, warn, error, fatal
NODE_ENV=production  # development or production
```

### 3. Start Server

```bash
npm run dev
```

Logs will be written to `logs/` directory.

---

## 📊 Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | Very detailed debugging | Function entry/exit |
| `debug` | Debugging information | Variable values, flow |
| `info` | General information | Server started, user logged in |
| `warn` | Warning conditions | Deprecated API used |
| `error` | Error conditions | Failed to process request |
| `fatal` | Fatal errors | Uncaught exception, exiting |

---

## 💻 Usage in Code

### Basic Logging

```typescript
import { logger } from './utils/logger';

// Info
logger.info('User logged in');
logger.info({ userId: '123', username: 'john' }, 'User logged in');

// Error
logger.error({ err: error }, 'Failed to process request');

// Warning
logger.warn({ userId: '123' }, 'Account locked');

// Debug
logger.debug({ query: 'SELECT *' }, 'Database query');
```

### Request-Scoped Logging

```typescript
// In route handlers, use req.log (includes request ID automatically)
router.post('/login', async (req, res) => {
  req.log.info({ username: req.body.username }, 'Login attempt');
  
  try {
    const result = await login(req.body);
    req.log.info({ userId: result.user.id }, 'Login successful');
    res.json(result);
  } catch (error) {
    req.log.error({ error }, 'Login failed');
    res.status(401).json({ error: 'Login failed' });
  }
});
```

### Child Loggers

```typescript
import { createChildLogger } from './utils/logger';

// Create logger with additional context
const userLogger = createChildLogger({ userId: '123', service: 'auth' });

userLogger.info('Processing user action');
// Output: {"userId":"123","service":"auth","msg":"Processing user action"}
```

---

## 🔍 Log Format

### Development (Pretty Print)

```
[10:30:45] INFO: Server started on port 8000
[10:30:46] INFO: ✓ Username bloom filter initialized
[10:30:50] INFO: POST /api/v1/auth/login 200 (45ms)
```

### Production (JSON)

```json
{
  "level": 30,
  "time": "2024-11-13T10:30:45.123Z",
  "pid": 12345,
  "hostname": "server-01",
  "service": "metaverse-http",
  "environment": "production",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "msg": "POST /api/v1/auth/login 200",
  "duration": 45,
  "statusCode": 200
}
```

---

## 🔒 Sensitive Data Redaction

The following fields are automatically redacted:

- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.newPassword`
- `req.body.token`
- `user.password`
- Any field named `password` or `token`

**Example:**
```json
{
  "req": {
    "body": {
      "username": "john",
      "password": "[REDACTED]"
    }
  }
}
```

---

## 🔄 Log Rotation

### Automatic Rotation

Logs rotate automatically when:
- **Daily**: At midnight (00:00)
- **Size**: File reaches 100MB

### Retention

- **Active logs**: Current day
- **Archived logs**: Last 30 days
- **Compression**: Gzip (.gz)

### Manual Rotation

```bash
# Force rotation (if needed)
kill -USR1 $(cat /var/run/app.pid)
```

---

## 📈 Monitoring

### Check Log Files

```bash
# View live logs
tail -f logs/app.log

# View errors only
tail -f logs/error.log

# View HTTP requests
tail -f logs/access.log

# Search logs
grep "error" logs/app.log
grep "userId.*123" logs/app.log
```

### Log Statistics

```bash
# Count errors today
grep "\"level\":50" logs/app.log | wc -l

# Count requests by status code
grep "\"statusCode\":200" logs/access.log | wc -l
grep "\"statusCode\":500" logs/access.log | wc -l

# Find slow requests (>1000ms)
grep "\"duration\":[0-9]\{4,\}" logs/access.log
```

### Disk Usage

```bash
# Check log directory size
du -sh logs/

# List log files by size
ls -lh logs/

# Clean old logs (older than 30 days)
find logs/ -name "*.log.gz" -mtime +30 -delete
```

---

## 🚀 Centralized Logging (Recommended)

### Option 1: Fluent Bit → Elasticsearch

**Install Fluent Bit:**
```bash
# Ubuntu/Debian
curl https://packages.fluentbit.io/fluentbit.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install fluent-bit
```

**Configure** (`/etc/fluent-bit/fluent-bit.conf`):
```ini
[INPUT]
    Name              tail
    Path              /path/to/metaverse/apps/http/logs/app.log
    Parser            json
    Tag               app.logs

[OUTPUT]
    Name              es
    Match             *
    Host              elasticsearch.example.com
    Port              9200
    Index             metaverse-logs
    Type              _doc
```

### Option 2: Filebeat → Elasticsearch

**Install Filebeat:**
```bash
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.x.x-linux-x86_64.tar.gz
tar xzvf filebeat-8.x.x-linux-x86_64.tar.gz
```

**Configure** (`filebeat.yml`):
```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /path/to/metaverse/apps/http/logs/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch.example.com:9200"]
  index: "metaverse-logs-%{+yyyy.MM.dd}"
```

### Option 3: Docker Logging Driver

**docker-compose.yml:**
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
```

---

## 🐛 Troubleshooting

### Logs Not Being Written

**Check permissions:**
```bash
ls -la logs/
chmod 755 logs/
```

**Check disk space:**
```bash
df -h
```

**Check process:**
```bash
ps aux | grep node
```

### Log Files Too Large

**Reduce log level:**
```env
LOG_LEVEL=warn  # Only warnings and errors
```

**Reduce retention:**
```typescript
// In logger.config.ts
maxFiles: 7,  // Keep only 7 days
```

### Missing Logs

**Check if logger is initialized:**
```typescript
import { logger } from './utils/logger';
logger.info('Test log');
```

**Check console capture:**
```typescript
console.log('This should appear in logs');
```

---

## 📊 Log Analysis

### Using jq (JSON processor)

```bash
# Pretty print
cat logs/app.log | jq '.'

# Filter by level
cat logs/app.log | jq 'select(.level == 50)'  # Errors only

# Filter by request ID
cat logs/app.log | jq 'select(.requestId == "abc-123")'

# Count by status code
cat logs/access.log | jq '.statusCode' | sort | uniq -c

# Average response time
cat logs/access.log | jq '.duration' | awk '{sum+=$1; count++} END {print sum/count}'
```

### Using grep

```bash
# Find all errors
grep '"level":50' logs/app.log

# Find specific user
grep '"userId":"123"' logs/app.log

# Find slow requests
grep '"duration":[0-9]\{4,\}' logs/access.log
```

---

## 🔐 Security Best Practices

### 1. Protect Log Files

```bash
# Set proper permissions
chmod 640 logs/*.log
chown app:app logs/*.log
```

### 2. Redact Sensitive Data

Already configured in `logger.config.ts`:
- Passwords
- Tokens
- Authorization headers
- Cookies

### 3. Encrypt Logs at Rest

```bash
# Use encrypted filesystem
cryptsetup luksFormat /dev/sdb1
cryptsetup open /dev/sdb1 logs
mkfs.ext4 /dev/mapper/logs
mount /dev/mapper/logs /var/log/app
```

### 4. Secure Log Transmission

Use TLS for shipping logs:
```yaml
# Filebeat with TLS
output.elasticsearch:
  hosts: ["https://elasticsearch.example.com:9200"]
  ssl.certificate_authorities: ["/etc/pki/root/ca.pem"]
```

---

## 📚 Additional Resources

- [Pino Documentation](https://getpino.io/)
- [Fluent Bit Documentation](https://docs.fluentbit.io/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/)
- [Log Rotation Best Practices](https://www.loggly.com/ultimate-guide/managing-log-files/)

---

## ✅ Checklist

- [ ] Logs directory created (`logs/`)
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Server started successfully
- [ ] Logs being written to files
- [ ] Log rotation working
- [ ] Sensitive data redacted
- [ ] Error capture working
- [ ] Request IDs in logs
- [ ] Centralized logging configured (optional)

---

## 🎉 You're Ready!

Your logging system is production-ready with:
- ✅ Structured JSON logs
- ✅ Automatic rotation and compression
- ✅ 30-day retention
- ✅ Error capture
- ✅ Request tracing
- ✅ Sensitive data redaction

**All logs are reliably saved and ready for analysis! 🚀**
