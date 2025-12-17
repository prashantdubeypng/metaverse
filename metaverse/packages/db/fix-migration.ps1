# Fix Prisma Migration Error (P3014)
# This script fixes PostgreSQL collation issues and creates shadow database

Write-Host "🔧 Fixing PostgreSQL Migration Issues..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1️⃣ Checking Docker..." -ForegroundColor Yellow
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Check if PostgreSQL container is running
Write-Host "2️⃣ Checking PostgreSQL container..." -ForegroundColor Yellow
$pgRunning = docker-compose ps postgres | Select-String "Up"
if (-not $pgRunning) {
    Write-Host "⚠️  PostgreSQL not running. Starting..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}
Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
Write-Host ""

# Fix template1 collation
Write-Host "3️⃣ Fixing template1 collation..." -ForegroundColor Yellow
docker-compose exec -T postgres psql -U postgres -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Collation fixed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Collation fix skipped (may not be needed)" -ForegroundColor Yellow
}
Write-Host ""

# Create shadow database
Write-Host "4️⃣ Creating shadow database..." -ForegroundColor Yellow
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS metaverse_shadow;" > $null 2>&1
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE metaverse_shadow;" > $null 2>&1
docker-compose exec -T postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE metaverse_shadow TO postgres;" > $null 2>&1
Write-Host "✅ Shadow database created" -ForegroundColor Green
Write-Host ""

# List databases
Write-Host "5️⃣ Verifying databases..." -ForegroundColor Yellow
docker-compose exec -T postgres psql -U postgres -c "\l" | Select-String "metaverse"
Write-Host ""

# Run migration
Write-Host "6️⃣ Running Prisma migration..." -ForegroundColor Yellow
Write-Host ""
npx prisma migrate dev --name add-auth-security

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Generate Prisma client: npx prisma generate" -ForegroundColor White
    Write-Host "  2. Start your app: cd ../../apps/http && npm run dev" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Migration failed. See error above." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try these alternatives:" -ForegroundColor Yellow
    Write-Host "  1. Use db push: npx prisma db push" -ForegroundColor White
    Write-Host "  2. Reset database: docker-compose down -v && docker-compose up -d" -ForegroundColor White
    Write-Host "  3. See MIGRATION_FIX_GUIDE.md for more options" -ForegroundColor White
    Write-Host ""
}
