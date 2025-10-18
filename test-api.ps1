# Security Log Analysis API Test Script for Windows PowerShell
# This script tests all the API endpoints with the provided test data

$BaseUrl = "http://localhost:3000/api/analysis"
$TestDataFile = "test-data/security-logs.json"

Write-Host "🧪 Security Log Analysis API Test Suite" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Check if server is running
Write-Host "1. Checking server health..." -ForegroundColor Yellow
try {
    $HealthResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -ErrorAction Stop
    Write-Host "✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Please start the server first." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check if test data file exists
if (-not (Test-Path $TestDataFile)) {
    Write-Host "❌ Test data file not found: $TestDataFile" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Test data file found: $TestDataFile" -ForegroundColor Green
Write-Host ""

# Test 1: Analyze logs
Write-Host "2. Testing log analysis (POST /api/analysis)..." -ForegroundColor Yellow
try {
    $LogData = Get-Content $TestDataFile -Raw
    $AnalysisResponse = Invoke-WebRequest -Uri $BaseUrl -Method POST -ContentType "application/json" -Body $LogData -ErrorAction Stop
    $AnalysisJson = $AnalysisResponse.Content | ConvertFrom-Json
    
    Write-Host "Response:" -ForegroundColor Cyan
    $AnalysisJson | ConvertTo-Json -Depth 10 | Write-Host
    
    if ($AnalysisJson.success) {
        $AnalysisId = $AnalysisJson.data.id
        Write-Host "✅ Analysis created successfully. ID: $AnalysisId" -ForegroundColor Green
        Write-Host ""
        
        # Test 2: Get all analyses
        Write-Host "3. Testing get all analyses (GET /api/analysis)..." -ForegroundColor Yellow
        try {
            $AllAnalyses = Invoke-WebRequest -Uri $BaseUrl -Method GET -ErrorAction Stop
            $AllAnalysesJson = $AllAnalyses.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $AllAnalysesJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error getting all analyses: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 3: Get specific analysis
        Write-Host "4. Testing get specific analysis (GET /api/analysis/$AnalysisId)..." -ForegroundColor Yellow
        try {
            $SpecificAnalysis = Invoke-WebRequest -Uri "$BaseUrl/$AnalysisId" -Method GET -ErrorAction Stop
            $SpecificAnalysisJson = $SpecificAnalysis.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $SpecificAnalysisJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error getting specific analysis: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 4: Test filtering by risk level
        Write-Host "5. Testing filtering by risk level (GET /api/analysis?risk_level=Medium)..." -ForegroundColor Yellow
        try {
            $FilteredResponse = Invoke-WebRequest -Uri "$BaseUrl?risk_level=Medium" -Method GET -ErrorAction Stop
            $FilteredJson = $FilteredResponse.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $FilteredJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error filtering by risk level: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 5: Test filtering by user
        Write-Host "6. Testing filtering by user (GET /api/analysis?user=Pikachu)..." -ForegroundColor Yellow
        try {
            $UserFiltered = Invoke-WebRequest -Uri "$BaseUrl?user=Pikachu" -Method GET -ErrorAction Stop
            $UserFilteredJson = $UserFiltered.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $UserFilteredJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error filtering by user: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 6: Test filtering by machine
        Write-Host "7. Testing filtering by machine (GET /api/analysis?machine=DESKTOP-9EHJI2B)..." -ForegroundColor Yellow
        try {
            $MachineFiltered = Invoke-WebRequest -Uri "$BaseUrl?machine=DESKTOP-9EHJI2B" -Method GET -ErrorAction Stop
            $MachineFilteredJson = $MachineFiltered.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $MachineFilteredJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error filtering by machine: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 7: Test pagination
        Write-Host "8. Testing pagination (GET /api/analysis?limit=5&offset=0)..." -ForegroundColor Yellow
        try {
            $PaginatedResponse = Invoke-WebRequest -Uri "$BaseUrl?limit=5&offset=0" -Method GET -ErrorAction Stop
            $PaginatedJson = $PaginatedResponse.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $PaginatedJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error testing pagination: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
        # Test 8: Test sorting
        Write-Host "9. Testing sorting (GET /api/analysis?sort_by=risk_score&sort_order=desc)..." -ForegroundColor Yellow
        try {
            $SortedResponse = Invoke-WebRequest -Uri "$BaseUrl?sort_by=risk_score&sort_order=desc" -Method GET -ErrorAction Stop
            $SortedJson = $SortedResponse.Content | ConvertFrom-Json
            Write-Host "Response:" -ForegroundColor Cyan
            $SortedJson | ConvertTo-Json -Depth 10 | Write-Host
            Write-Host ""
        } catch {
            Write-Host "❌ Error testing sorting: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }
        
    } else {
        Write-Host "❌ Failed to create analysis: $($AnalysisJson.error)" -ForegroundColor Red
        Write-Host "Details: $($AnalysisJson.details)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error in log analysis: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}
Write-Host ""

# Test 9: Error handling
Write-Host "10. Testing error handling..." -ForegroundColor Yellow
Write-Host "   a. Testing invalid analysis ID..." -ForegroundColor Yellow
try {
    $InvalidResponse = Invoke-WebRequest -Uri "$BaseUrl/invalid-id" -Method GET -ErrorAction Stop
    $InvalidJson = $InvalidResponse.Content | ConvertFrom-Json
    Write-Host "   Response:" -ForegroundColor Cyan
    $InvalidJson | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "   Response: $($_.Exception.Message)" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "   b. Testing empty request body..." -ForegroundColor Yellow
try {
    $EmptyResponse = Invoke-WebRequest -Uri $BaseUrl -Method POST -ContentType "application/json" -Body '{}' -ErrorAction Stop
    $EmptyJson = $EmptyResponse.Content | ConvertFrom-Json
    Write-Host "   Response:" -ForegroundColor Cyan
    $EmptyJson | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "   Response: $($_.Exception.Message)" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "🎉 Test suite completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Yellow
Write-Host "- All API endpoints have been tested" -ForegroundColor White
Write-Host "- Error handling has been verified" -ForegroundColor White
Write-Host "- Filtering and pagination have been tested" -ForegroundColor White
Write-Host "- Check the responses above for any issues" -ForegroundColor White
