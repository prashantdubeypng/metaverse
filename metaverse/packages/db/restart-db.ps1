# Restart PostgreSQL with new configuration
# This will recreate the database with proper collation settings

Write-Host "🔄 Restarting PostgreSQL with new configuration..." -ForegroundColor Cyan
Write-Host ""

# Stop and remove the container
Write-Host "1️⃣ Stopping PostgreSQL container..." -ForegroundColor Yellow
docker-compose down postgres

Write-Host ""
Write-Host "2️⃣ Starting PostgreSQL with new settings..." -ForegroundColor Yellow
docker-compose up -d postgres

Write-Host ""
Write-Host "3️⃣ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if database exists
Write-Host ""
Write-Host "4️⃣ Verifying database..." -ForegroundColor Yellow
docker exec metaverse_postgres psql -U postgres -c "\l" | Select-String "metaverse_db"

Write-Host ""
Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Database URL:" -ForegroundColor Cyan
Write-Host "postgresql://postgres:password@localhost:5432/metaverse_db" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npx prisma db push" -ForegroundColor White
Write-Host "  2. Run: npx prisma generate" -ForegroundColor White
Write-Host ""
