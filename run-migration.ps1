# PowerShell script to run the database migration
# This script adds the original_id column to the SecurityLogAnalysis table

Write-Host "Starting database migration to add original_id column..." -ForegroundColor Green

# Check if psql is available
try {
    $psqlVersion = psql --version
    Write-Host "PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "PostgreSQL client (psql) not found. Please install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "You can download it from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

# Check if environment variables are set
if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_KEY) {
    Write-Host "SUPABASE_URL and SUPABASE_KEY environment variables are required." -ForegroundColor Red
    Write-Host "Please set them in your environment or .env file." -ForegroundColor Yellow
    exit 1
}

# Extract database connection details from SUPABASE_URL
$supabaseUrl = $env:SUPABASE_URL
$supabaseKey = $env:SUPABASE_KEY

# Parse the URL to get connection details
# Supabase URL format: https://your-project.supabase.co
$projectId = $supabaseUrl -replace "https://", "" -replace ".supabase.co", ""

Write-Host "Project ID: $projectId" -ForegroundColor Cyan

# Construct the database connection string
$dbHost = "db.$projectId.supabase.co"
$dbPort = "5432"
$dbName = "postgres"
$dbUser = "postgres"
$dbPassword = $supabaseKey

# Create connection string
$connectionString = "postgresql://$dbUser`:$dbPassword@$dbHost`:$dbPort/$dbName"

Write-Host "Running migration script..." -ForegroundColor Yellow

try {
    # Run the migration script
    psql $connectionString -f "add_original_id_column.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "The original_id column has been added to the SecurityLogAnalysis table." -ForegroundColor Green
    } else {
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error running migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Migration script execution completed." -ForegroundColor Green
