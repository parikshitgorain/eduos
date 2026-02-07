# AI Kill Switch Test Script (PowerShell)
# Demonstrates the kill switch functionality

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "AI Kill Switch Test Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:3000/api/v1/ai"
$AI_SERVICE_URL = "http://localhost:8000/api/v1"

# Test 1: Check initial status
Write-Host "1. Checking initial kill switch status..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Test AI service when enabled
Write-Host "2. Testing AI service (should work when enabled)..." -ForegroundColor Yellow
try {
    $body = @{
        student1 = @{
            first_name = "John"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
        student2 = @{
            first_name = "Jon"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$AI_SERVICE_URL/semantic/pairwise-similarity" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "Semantic Similarity: $($response.semantic_similarity)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Disable AI services
Write-Host "3. Disabling AI services via kill switch..." -ForegroundColor Yellow
try {
    $body = @{
        enable = $false
        reason = "Testing kill switch functionality"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch/toggle" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Verify disabled
Write-Host "4. Verifying kill switch is disabled..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Test AI service when disabled (should be blocked)
Write-Host "5. Testing AI service (should be blocked)..." -ForegroundColor Yellow
try {
    $body = @{
        student1 = @{
            first_name = "John"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
        student2 = @{
            first_name = "Jon"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$AI_SERVICE_URL/semantic/pairwise-similarity" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "Unexpected: AI service was not blocked!" -ForegroundColor Red
    $response | ConvertTo-Json -Depth 10
} catch {
    if ($_.Exception.Response.StatusCode -eq 503) {
        Write-Host "✓ AI service correctly blocked (503 Service Unavailable)" -ForegroundColor Green
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Detail: $($errorDetails.detail)" -ForegroundColor Cyan
    } else {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Re-enable AI services
Write-Host "6. Re-enabling AI services..." -ForegroundColor Yellow
try {
    $body = @{
        enable = $true
        reason = "Test complete - re-enabling AI"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch/toggle" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Verify enabled
Write-Host "7. Verifying kill switch is enabled..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 8: Test AI service when re-enabled
Write-Host "8. Testing AI service (should work again)..." -ForegroundColor Yellow
try {
    $body = @{
        student1 = @{
            first_name = "John"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
        student2 = @{
            first_name = "Jon"
            last_name = "Doe"
            date_of_birth = "2005-03-15"
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$AI_SERVICE_URL/semantic/pairwise-similarity" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "Semantic Similarity: $($response.semantic_similarity)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 9: Check history
Write-Host "9. Checking kill switch history..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/kill-switch/history?limit=5" -Method Get
    Write-Host "History entries: $($response.data.history.Count)" -ForegroundColor Cyan
    $response.data.history | ForEach-Object {
        Write-Host "  - $($_.action) by $($_.user_id) at $($_.timestamp)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Kill Switch Test Complete!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
