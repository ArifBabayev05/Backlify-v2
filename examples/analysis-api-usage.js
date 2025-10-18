/**
 * Security Log Analysis API Usage Examples
 * 
 * This file demonstrates how to use the Security Log Analysis API endpoints
 * to analyze Windows Security logs and retrieve structured analysis results.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/analysis';

// Example Windows Security log data
const sampleSecurityLogs = [
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T10:03:03.9717533Z",
    "RecordId": 280795,
    "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: SYSTEM Account Domain: NT AUTHORITY Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Process ID: 0x0 Process Name: - Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0"
  },
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T12:53:41.4701566Z",
    "RecordId": 280796,
    "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: SYSTEM Account Domain: NT AUTHORITY Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Process ID: 0x0 Process Name: - Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0"
  },
  {
    "Id": 4624,
    "TimeCreated": "2025-01-27T14:15:30.1234567Z",
    "RecordId": 280797,
    "Message": "An account was successfully logged on. Subject: Security ID: S-1-5-18 Account Name: SYSTEM Account Domain: NT AUTHORITY Logon ID: 0x3E7 Logon Type: 2 New Logon: Security ID: S-1-5-21-1234567890-1234567890-1234567890-1001 Account Name: Administrator Account Domain: DESKTOP-9EHJI2B Logon ID: 0x12345 Logon GUID: {12345678-1234-1234-1234-123456789012} Process Information: Process ID: 0x0 Process Name: - Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0"
  }
];

/**
 * Example 1: Analyze security logs
 */
async function analyzeLogs() {
  console.log('🔍 Analyzing security logs...\n');
  
  try {
    const response = await axios.post(API_BASE_URL, sampleSecurityLogs, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Analysis completed successfully!');
    console.log('Analysis ID:', response.data.data.id);
    console.log('Risk Score:', response.data.data.risk_score);
    console.log('Risk Level:', response.data.data.risk_likelihood);
    console.log('Detected User:', response.data.data.detected_user);
    console.log('Machine Name:', response.data.data.machine_name);
    console.log('\nSummary:');
    response.data.data.summary_bullets.forEach((bullet, index) => {
      console.log(`  ${index + 1}. ${bullet}`);
    });
    console.log('\nTop Indicators:');
    response.data.data.top_indicators.forEach((indicator, index) => {
      console.log(`  ${index + 1}. ${indicator}`);
    });
    console.log('\nRecommendations:');
    response.data.data.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    return response.data.data.id;
  } catch (error) {
    console.error('❌ Analysis failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 2: Get all analyses with filtering
 */
async function getAllAnalyses() {
  console.log('\n📊 Retrieving all analyses...\n');
  
  try {
    // Get all analyses
    const allResponse = await axios.get(API_BASE_URL);
    console.log(`Total analyses: ${allResponse.data.pagination.total}`);
    console.log(`Analyses returned: ${allResponse.data.data.length}`);

    // Get high-risk analyses only
    const highRiskResponse = await axios.get(`${API_BASE_URL}?risk_level=High&limit=10`);
    console.log(`\nHigh-risk analyses: ${highRiskResponse.data.data.length}`);

    // Get analyses for specific user
    const userResponse = await axios.get(`${API_BASE_URL}?user=Pikachu&limit=5`);
    console.log(`Analyses for Pikachu: ${userResponse.data.data.length}`);

    // Get recent analyses (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentResponse = await axios.get(`${API_BASE_URL}?from_date=${yesterday.toISOString()}&sort_by=timestamp_created&sort_order=desc`);
    console.log(`Recent analyses (last 24h): ${recentResponse.data.data.length}`);

    return allResponse.data.data;
  } catch (error) {
    console.error('❌ Failed to retrieve analyses:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 3: Get specific analysis by ID
 */
async function getAnalysisById(analysisId) {
  console.log(`\n🔍 Retrieving analysis ${analysisId}...\n`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/${analysisId}`);
    
    console.log('✅ Analysis retrieved successfully!');
    console.log('Analysis Details:');
    console.log(`  ID: ${response.data.data.id}`);
    console.log(`  User: ${response.data.data.detected_user}`);
    console.log(`  Machine: ${response.data.data.machine_name}`);
    console.log(`  Risk Score: ${response.data.data.risk_score}`);
    console.log(`  Risk Level: ${response.data.data.risk_likelihood}`);
    console.log(`  Confidence: ${response.data.data.confidence}`);
    console.log(`  Created: ${response.data.data.timestamp_created}`);
    
    console.log('\nBehavior Breakdown:');
    Object.entries(response.data.data.behavior_breakdown).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\nAlert Flags:');
    Object.entries(response.data.data.alert_flags).forEach(([key, value]) => {
      console.log(`  ${key}: ${value ? '🚨' : '✅'}`);
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to retrieve analysis:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 4: Dashboard data aggregation
 */
async function getDashboardData() {
  console.log('\n📈 Getting dashboard data...\n');
  
  try {
    // Get risk distribution
    const riskDistribution = {};
    const riskLevels = ['Low', 'Medium', 'High'];
    
    for (const level of riskLevels) {
      const response = await axios.get(`${API_BASE_URL}?risk_level=${level}&limit=1000`);
      riskDistribution[level] = response.data.data.length;
    }

    console.log('Risk Distribution:');
    Object.entries(riskDistribution).forEach(([level, count]) => {
      console.log(`  ${level}: ${count} analyses`);
    });

    // Get top users by analysis count
    const allAnalyses = await axios.get(`${API_BASE_URL}?limit=1000`);
    const userCounts = {};
    
    allAnalyses.data.data.forEach(analysis => {
      const user = analysis.detected_user || 'Unknown';
      userCounts[user] = (userCounts[user] || 0) + 1;
    });

    const topUsers = Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    console.log('\nTop Users by Analysis Count:');
    topUsers.forEach(([user, count], index) => {
      console.log(`  ${index + 1}. ${user}: ${count} analyses`);
    });

    // Get average risk score
    const avgRiskScore = allAnalyses.data.data.reduce((sum, analysis) => sum + analysis.risk_score, 0) / allAnalyses.data.data.length;
    console.log(`\nAverage Risk Score: ${avgRiskScore.toFixed(2)}`);

    return {
      riskDistribution,
      topUsers,
      avgRiskScore,
      totalAnalyses: allAnalyses.data.data.length
    };
  } catch (error) {
    console.error('❌ Failed to get dashboard data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main function to run all examples
 */
async function runExamples() {
  console.log('🚀 Security Log Analysis API Examples\n');
  console.log('=====================================\n');

  try {
    // Example 1: Analyze logs
    const analysisId = await analyzeLogs();

    // Example 2: Get all analyses
    await getAllAnalyses();

    // Example 3: Get specific analysis
    await getAnalysisById(analysisId);

    // Example 4: Dashboard data
    await getDashboardData();

    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n💥 Examples failed:', error.message);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

module.exports = {
  analyzeLogs,
  getAllAnalyses,
  getAnalysisById,
  getDashboardData
};
