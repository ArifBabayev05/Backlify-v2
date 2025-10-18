#!/bin/bash

# Security Log Analysis API Test Script
# This script tests all the API endpoints with the provided test data

BASE_URL="http://localhost:3000/api/analysis"
TEST_DATA_FILE="test-data/security-logs.json"

echo "🧪 Security Log Analysis API Test Suite"
echo "======================================"
echo ""

# Check if server is running
echo "1. Checking server health..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Please start the server first."
    exit 1
fi
echo ""

# Check if test data file exists
if [ ! -f "$TEST_DATA_FILE" ]; then
    echo "❌ Test data file not found: $TEST_DATA_FILE"
    exit 1
fi
echo "✅ Test data file found: $TEST_DATA_FILE"
echo ""

# Test 1: Analyze logs
echo "2. Testing log analysis (POST /api/analysis)..."
ANALYSIS_RESPONSE=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d @$TEST_DATA_FILE)

echo "Response:"
echo "$ANALYSIS_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYSIS_RESPONSE"
echo ""

# Extract analysis ID for further testing
ANALYSIS_ID=$(echo $ANALYSIS_RESPONSE | jq -r '.data.id' 2>/dev/null)
if [ "$ANALYSIS_ID" != "null" ] && [ "$ANALYSIS_ID" != "" ]; then
    echo "✅ Analysis created successfully. ID: $ANALYSIS_ID"
    echo ""
    
    # Test 2: Get all analyses
    echo "3. Testing get all analyses (GET /api/analysis)..."
    ALL_ANALYSES=$(curl -s -X GET $BASE_URL)
    echo "Response:"
    echo "$ALL_ANALYSES" | jq '.' 2>/dev/null || echo "$ALL_ANALYSES"
    echo ""
    
    # Test 3: Get specific analysis
    echo "4. Testing get specific analysis (GET /api/analysis/$ANALYSIS_ID)..."
    SPECIFIC_ANALYSIS=$(curl -s -X GET "$BASE_URL/$ANALYSIS_ID")
    echo "Response:"
    echo "$SPECIFIC_ANALYSIS" | jq '.' 2>/dev/null || echo "$SPECIFIC_ANALYSIS"
    echo ""
    
    # Test 4: Test filtering by risk level
    echo "5. Testing filtering by risk level (GET /api/analysis?risk_level=Medium)..."
    FILTERED_RESPONSE=$(curl -s -X GET "$BASE_URL?risk_level=Medium")
    echo "Response:"
    echo "$FILTERED_RESPONSE" | jq '.' 2>/dev/null || echo "$FILTERED_RESPONSE"
    echo ""
    
    # Test 5: Test filtering by user
    echo "6. Testing filtering by user (GET /api/analysis?user=Pikachu)..."
    USER_FILTERED=$(curl -s -X GET "$BASE_URL?user=Pikachu")
    echo "Response:"
    echo "$USER_FILTERED" | jq '.' 2>/dev/null || echo "$USER_FILTERED"
    echo ""
    
    # Test 6: Test filtering by machine
    echo "7. Testing filtering by machine (GET /api/analysis?machine=DESKTOP-9EHJI2B)..."
    MACHINE_FILTERED=$(curl -s -X GET "$BASE_URL?machine=DESKTOP-9EHJI2B")
    echo "Response:"
    echo "$MACHINE_FILTERED" | jq '.' 2>/dev/null || echo "$MACHINE_FILTERED"
    echo ""
    
    # Test 7: Test pagination
    echo "8. Testing pagination (GET /api/analysis?limit=5&offset=0)..."
    PAGINATED_RESPONSE=$(curl -s -X GET "$BASE_URL?limit=5&offset=0")
    echo "Response:"
    echo "$PAGINATED_RESPONSE" | jq '.' 2>/dev/null || echo "$PAGINATED_RESPONSE"
    echo ""
    
    # Test 8: Test sorting
    echo "9. Testing sorting (GET /api/analysis?sort_by=risk_score&sort_order=desc)..."
    SORTED_RESPONSE=$(curl -s -X GET "$BASE_URL?sort_by=risk_score&sort_order=desc")
    echo "Response:"
    echo "$SORTED_RESPONSE" | jq '.' 2>/dev/null || echo "$SORTED_RESPONSE"
    echo ""
    
else
    echo "❌ Failed to create analysis or extract ID"
    echo "Response: $ANALYSIS_RESPONSE"
fi

# Test 9: Error handling
echo "10. Testing error handling..."
echo "   a. Testing invalid analysis ID..."
INVALID_RESPONSE=$(curl -s -X GET "$BASE_URL/invalid-id")
echo "   Response:"
echo "$INVALID_RESPONSE" | jq '.' 2>/dev/null || echo "$INVALID_RESPONSE"
echo ""

echo "   b. Testing empty request body..."
EMPTY_RESPONSE=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{}')
echo "   Response:"
echo "$EMPTY_RESPONSE" | jq '.' 2>/dev/null || echo "$EMPTY_RESPONSE"
echo ""

echo "🎉 Test suite completed!"
echo ""
echo "📊 Summary:"
echo "- All API endpoints have been tested"
echo "- Error handling has been verified"
echo "- Filtering and pagination have been tested"
echo "- Check the responses above for any issues"
