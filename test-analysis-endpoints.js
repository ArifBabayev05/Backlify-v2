const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/analysis`;

// Sample Windows Security log data for testing
const sampleLogs = [
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T10:03:03.9717533Z",
    "RecordId": 280795,
    "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: SYSTEM Account Domain: NT AUTHORITY Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Process ID: 0x0 Process Name: - Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: NtLmSsp Authentication Package: NTLM Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. The name is the computer name of the remote computer. The Detailed Authentication Information fields indicate the details of the authentication package used for the logon attempt. The Transited Services field indicates which intermediate services participated in the logon request. The Package Name field indicates which sub-protocol was used in the NTLM protocol. The Key Length field indicates the length of the generated session key. This will be 0 if no session key was requested."
  },
  {
    "Id": 4625,
    "TimeCreated": "2025-01-27T12:53:41.4701566Z",
    "RecordId": 280796,
    "Message": "An account failed to log on. Subject: Security ID: S-1-5-18 Account Name: SYSTEM Account Domain: NT AUTHORITY Logon ID: 0x3E7 Logon Type: 2 Account For Which Logon Failed: Security ID: S-1-0-0 Account Name: Pikachu Account Domain: DESKTOP-9EHJI2B Failure Reason: Unknown user name or bad password. Status: 0xC000006D Sub Status: 0xC000006A Process Information: Process ID: 0x0 Process Name: - Network Information: Workstation Name: DESKTOP-9EHJI2B Source Network Address: 127.0.0.1 Source Port: 0 Detailed Authentication Information: Logon Process: NtLmSsp Authentication Package: NTLM Transited Services: - Package Name (NTLM only): - Key Length: 0 This event is generated when a logon request fails. It is generated on the computer where access was attempted. The Subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe. The Logon Type field indicates the kind of logon that was requested. The most common types are 2 (interactive) and 3 (network). The Process Information fields indicate which account and process on the system requested the logon. The Network Information fields indicate where a remote logon request originated. The name is the computer name of the remote computer. The Detailed Authentication Information fields indicate the details of the authentication package used for the logon attempt. The Transited Services field indicates which intermediate services participated in the logon request. The Package Name field indicates which sub-protocol was used in the NTLM protocol. The Key Length field indicates the length of the generated session key. This will be 0 if no session key was requested."
  }
];

async function testAnalysisEndpoints() {
  console.log('🧪 Testing Security Log Analysis Endpoints\n');

  try {
    // Test 1: POST /api/analysis - Analyze logs
    console.log('1. Testing POST /api/analysis (Analyze logs)...');
    const analyzeResponse = await axios.post(API_BASE, sampleLogs, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Analysis successful!');
    console.log('Response:', JSON.stringify(analyzeResponse.data, null, 2));
    
    const analysisId = analyzeResponse.data.data?.id;
    if (!analysisId) {
      throw new Error('No analysis ID returned');
    }

    console.log(`\nAnalysis ID: ${analysisId}\n`);

    // Test 2: GET /api/analysis - Get all analyses
    console.log('2. Testing GET /api/analysis (Get all analyses)...');
    const getAllResponse = await axios.get(API_BASE);
    
    console.log('✅ Get all analyses successful!');
    console.log('Total analyses:', getAllResponse.data.pagination?.total || 0);
    console.log('Analyses returned:', getAllResponse.data.data?.length || 0);

    // Test 3: GET /api/analysis/:id - Get specific analysis
    console.log(`\n3. Testing GET /api/analysis/${analysisId} (Get specific analysis)...`);
    const getByIdResponse = await axios.get(`${API_BASE}/${analysisId}`);
    
    console.log('✅ Get specific analysis successful!');
    console.log('Analysis data:', JSON.stringify(getByIdResponse.data.data, null, 2));

    // Test 4: Test filtering
    console.log('\n4. Testing GET /api/analysis with filters...');
    const filterResponse = await axios.get(`${API_BASE}?risk_level=Medium&limit=10`);
    
    console.log('✅ Filtered results successful!');
    console.log('Filtered analyses:', filterResponse.data.data?.length || 0);

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the tests
testAnalysisEndpoints();
