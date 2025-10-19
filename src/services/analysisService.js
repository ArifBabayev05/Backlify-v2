const { createClient } = require('@supabase/supabase-js');
const MistralService = require('./mistralService');
const EmailService = require('./emailService');
const config = require('../config/config');

class AnalysisService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    this.mistralService = MistralService;
    this.emailService = EmailService;
    this.tableName = 'SecurityLogAnalysis'; // Default table name
    
    // Email configuration
    this.adminEmail = 'arifrb@code.edu.az';
    this.emailThresholds = {
      low: 0,      // Send emails for all threats (including score 0)
      medium: 0,   // Send emails for medium and high
      high: 0      // Send emails for high threats
    };
    
    // AI request limits (Mistral free version limits)
    this.aiLimits = {
      maxChars: 8000,        // Maximum characters to send to AI
      maxLogs: 10,           // Maximum number of log entries to process
      truncateMessage: true, // Whether to truncate long messages
      maxMessageLength: 2000 // Maximum message length per log entry
    };
  }

  /**
   * Truncate and limit log data to fit AI limits
   * @param {Array} rawLogs - Array of Windows Security log entries
   * @returns {Object} Truncated logs and metadata
   */
  truncateLogsForAI(rawLogs) {
    console.log(`📊 Original logs count: ${rawLogs.length}`);
    
    // Limit number of log entries
    let limitedLogs = rawLogs.slice(0, this.aiLimits.maxLogs);
    console.log(`📊 Limited to ${limitedLogs.length} log entries`);
    
    // Truncate long messages if enabled
    if (this.aiLimits.truncateMessage) {
      limitedLogs = limitedLogs.map(log => {
        if (log.Message && log.Message.length > this.aiLimits.maxMessageLength) {
          const truncatedMessage = log.Message.substring(0, this.aiLimits.maxMessageLength) + '... [TRUNCATED]';
          console.log(`✂️ Truncated message from ${log.Message.length} to ${truncatedMessage.length} chars`);
          return {
            ...log,
            Message: truncatedMessage
          };
        }
        return log;
      });
    }
    
    // Calculate total character count
    const totalChars = JSON.stringify(limitedLogs).length;
    console.log(`📊 Total characters: ${totalChars}`);
    
    // If still too long, further truncate
    if (totalChars > this.aiLimits.maxChars) {
      console.log(`⚠️ Data too large (${totalChars} chars), further truncating...`);
      
      // Remove less important fields to reduce size
      limitedLogs = limitedLogs.map(log => {
        const essentialLog = {
          TimeCreated: log.TimeCreated,
          LogName: log.LogName,
          Id: log.Id,
          LevelDisplayName: log.LevelDisplayName,
          RecordId: log.RecordId,
          MachineName: log.MachineName,
          UserId: log.UserId,
          Message: log.Message ? log.Message.substring(0, 1500) + '... [TRUNCATED]' : log.Message,
          ParsedFields: {}
        };
        return essentialLog;
      });
      
      const newTotalChars = JSON.stringify(limitedLogs).length;
      console.log(`📊 After truncation: ${newTotalChars} chars`);
      
      // If still too long, reduce number of logs
      if (newTotalChars > this.aiLimits.maxChars) {
        const targetLogs = Math.floor(limitedLogs.length * (this.aiLimits.maxChars / newTotalChars));
        limitedLogs = limitedLogs.slice(0, Math.max(1, targetLogs));
        console.log(`📊 Final log count: ${limitedLogs.length}`);
      }
    }
    
    const finalChars = JSON.stringify(limitedLogs).length;
    console.log(`✅ Final data size: ${finalChars} characters (${limitedLogs.length} logs)`);
    
    return {
      logs: limitedLogs,
      originalCount: rawLogs.length,
      finalCount: limitedLogs.length,
      originalChars: JSON.stringify(rawLogs).length,
      finalChars: finalChars,
      truncated: rawLogs.length > limitedLogs.length || finalChars < JSON.stringify(rawLogs).length
    };
  }

  /**
   * Analyze Windows Security logs using AI
   * @param {Array} rawLogs - Array of Windows Security log entries
   * @returns {Object} Analysis result
   */
  async analyzeLogs(rawLogs) {
    const startTime = Date.now();
    const logId = `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[${logId}] 🚀 Analysis process started`);
      console.log(`[${logId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${logId}] 📊 Input: ${rawLogs.length} log entries received`);
      console.log(`[${logId}] 🕒 Start time: ${new Date(startTime).toISOString()}`);
      
      // Log input sample
      console.log(`[${logId}] 📝 Sample of first log entry:`, 
        JSON.stringify(rawLogs[0], null, 2));
      
      // Truncate logs to fit AI limits
      console.log(`[${logId}] 📋 Starting log truncation process...`);
      const truncationResult = this.truncateLogsForAI(rawLogs);
      const processedLogs = truncationResult.logs;
      
      console.log(`[${logId}] 📊 Truncation results:`);
      console.log(`[${logId}] ├── Original count: ${truncationResult.originalCount} logs`);
      console.log(`[${logId}] ├── Final count: ${truncationResult.finalCount} logs`);
      console.log(`[${logId}] ├── Original size: ${(truncationResult.originalChars / 1024).toFixed(2)} KB`);
      console.log(`[${logId}] └── Final size: ${(truncationResult.finalChars / 1024).toFixed(2)} KB`);
      
      if (truncationResult.truncated) {
        console.log(`[${logId}] ⚠️ Data was truncated to meet AI limits`);
        console.log(`[${logId}] ├── Reduction: ${((1 - truncationResult.finalChars / truncationResult.originalChars) * 100).toFixed(1)}%`);
        console.log(`[${logId}] └── Logs removed: ${truncationResult.originalCount - truncationResult.finalCount}`);
      }
      
      // Prepare AI prompts
      console.log(`[${logId}] 🤖 Preparing AI analysis request...`);
      const systemPrompt = this.getAnalysisSystemPrompt();
      const userPrompt = this.formatLogsForAI(processedLogs);
      
      console.log(`[${logId}] 📤 AI Request details:`);
      console.log(`[${logId}] ├── System prompt length: ${systemPrompt.length} chars`);
      console.log(`[${logId}] ├── User prompt length: ${userPrompt.length} chars`);
      console.log(`[${logId}] └── Total request size: ${systemPrompt.length + userPrompt.length} chars`);

      // Send to AI for analysis
      console.log(`[${logId}] 🔄 Sending request to AI service...`);
      const aiRequestStart = Date.now();
      const aiResponse = await this.mistralService.generateCompletion(systemPrompt, userPrompt);
      const aiRequestDuration = Date.now() - aiRequestStart;
      
      console.log(`[${logId}] ✅ AI response received:`);
      console.log(`[${logId}] ├── Response time: ${aiRequestDuration}ms`);
      console.log(`[${logId}] ├── Response length: ${aiResponse?.length || 0} chars`);
      console.log(`[${logId}] └── Processing rate: ${((aiResponse?.length || 0) / aiRequestDuration).toFixed(2)} chars/ms`);
      
      // Parse AI response
      let analysisResult;
      try {
        console.log(`[${logId}] 🔍 Parsing AI response...`);
        const cleanedResponse = this.cleanAIResponse(aiResponse);
        analysisResult = JSON.parse(cleanedResponse);
        console.log(`[${logId}] ✅ Successfully parsed AI response`);
        console.log(`[${logId}] ├── Analysis ID: ${analysisResult.unique_id}`);
        console.log(`[${logId}] ├── Risk Score: ${analysisResult.risk_assessment.score}`);
        console.log(`[${logId}] ├── Risk Level: ${analysisResult.risk_assessment.likelihood}`);
        console.log(`[${logId}] └── Confidence: ${analysisResult.risk_assessment.confidence}`);
      } catch (parseError) {
        console.error(`[${logId}] ❌ Failed to parse AI response:`, parseError);
        console.error(`[${logId}] Raw AI response:`, aiResponse);
        throw new Error('AI analysis failed: Invalid JSON response from AI');
      }

      // Validate result structure
      console.log(`[${logId}] 🔍 Validating analysis result structure...`);
      this.validateAnalysisResult(analysisResult);
      console.log(`[${logId}] ✅ Analysis result validation passed`);

      // Save to database
      console.log(`[${logId}] 💾 Saving analysis to database...`);
      const dbStart = Date.now();
      const savedResult = await this.saveAnalysisResult(analysisResult, rawLogs, truncationResult);
      console.log(`[${logId}] ✅ Database save completed in ${Date.now() - dbStart}ms`);
      console.log(`[${logId}] ├── Record ID: ${savedResult.id}`);
      console.log(`[${logId}] └── Original ID: ${savedResult.original_id}`);
      
      // Check email notifications
      console.log(`[${logId}] 📧 Checking email notification requirements...`);
      const emailStart = Date.now();
      await this.sendThreatReportIfNeeded(savedResult);
      console.log(`[${logId}] ✅ Email check completed in ${Date.now() - emailStart}ms`);
      
      // Final timing summary
      const totalDuration = Date.now() - startTime;
      console.log(`[${logId}] 📊 Process Summary:`);
      console.log(`[${logId}] ├── Total duration: ${totalDuration}ms`);
      console.log(`[${logId}] ├── AI processing: ${aiRequestDuration}ms (${((aiRequestDuration/totalDuration)*100).toFixed(1)}%)`);
      console.log(`[${logId}] ├── Database ops: ${Date.now() - dbStart}ms (${(((Date.now() - dbStart)/totalDuration)*100).toFixed(1)}%)`);
      console.log(`[${logId}] └── Email checks: ${Date.now() - emailStart}ms (${(((Date.now() - emailStart)/totalDuration)*100).toFixed(1)}%)`);
      console.log(`[${logId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${logId}] ✨ Analysis process completed successfully`);

      return savedResult;
    } catch (error) {
      console.error(`[${logId}] ❌ Error in analyzeLogs service after ${Date.now() - startTime}ms:`);
      console.error(`[${logId}] ├── Error type: ${error.constructor.name}`);
      console.error(`[${logId}] ├── Message: ${error.message}`);
      console.error(`[${logId}] └── Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Get all analysis results with filtering and pagination
   * @param {number} limit - Maximum number of results
   * @param {number} offset - Offset for pagination
   * @param {Object} filters - Filter criteria
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - Sort order (asc/desc)
   * @returns {Object} Analysis results with pagination info
   */
  async getAllAnalysis(limit, offset, filters = {}, sortBy = 'timestamp_created', sortOrder = 'desc') {
    try {
      // Try with retry logic for schema cache issues
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          let query = this.supabase
            .from(this.tableName)
            .select('*', { count: 'exact' });

          // Apply filters
          if (filters.risk_likelihood) {
            query = query.eq('risk_likelihood', filters.risk_likelihood);
          }
          if (filters.detected_user) {
            query = query.ilike('detected_user', `%${filters.detected_user}%`);
          }
          if (filters.machine_name) {
            query = query.ilike('machine_name', `%${filters.machine_name}%`);
          }
          if (filters.from_date) {
            query = query.gte('timestamp_created', filters.from_date);
          }
          if (filters.to_date) {
            query = query.lte('timestamp_created', filters.to_date);
          }
          // Add filter for original_id if needed
          if (filters.original_id) {
            query = query.eq('original_id', filters.original_id);
          }

          // Apply sorting
          query = query.order(sortBy, { ascending: sortOrder === 'asc' });

          // Apply pagination
          query = query.range(offset, offset + limit - 1);

          const { data: analyses, error, count } = await query;

          if (error) {
            // If it's a schema cache issue, try to refresh and retry
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
              console.log('Schema cache issue detected in getAllAnalysis, refreshing...');
              await this.refreshSchemaCache();
              retries--;
              if (retries > 0) {
                console.log(`Retrying getAllAnalysis... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                continue;
              }
            }
            throw new Error(`Database error: ${error.message}`);
          }

          console.log(`Retrieved ${analyses?.length || 0} analysis records (Total: ${count || 0})`);
          return {
            analyses: analyses || [],
            total: count || 0
          };
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            console.log(`getAllAnalysis failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      console.error('Error in getAllAnalysis service:', error);
      throw error;
    }
  }

  /**
   * Get all versions of an analysis by original_id
   * @param {string} originalId - Original analysis ID
   * @returns {Array} Array of all analysis versions
   */
  async getAnalysisVersions(originalId) {
    try {
      // Try with retry logic for schema cache issues
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('original_id', originalId)
            .order('timestamp_created', { ascending: false });

          if (error) {
            // If it's a schema cache issue, try to refresh and retry
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
              console.log('Schema cache issue detected in getAnalysisVersions, refreshing...');
              await this.refreshSchemaCache();
              retries--;
              if (retries > 0) {
                console.log(`Retrying getAnalysisVersions... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                continue;
              }
            }
            throw new Error(`Database error: ${error.message}`);
          }

          console.log(`Found ${data?.length || 0} versions for original_id: ${originalId}`);
          return data || [];
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            console.log(`getAnalysisVersions failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      console.error('Error in getAnalysisVersions service:', error);
      throw error;
    }
  }

  /**
   * Get specific analysis result by ID
   * @param {string} id - Analysis ID
   * @returns {Object|null} Analysis result or null if not found
   */
  async getAnalysisById(id) {
    try {
      // Try with retry logic for schema cache issues
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              return null; // Not found
            }
            // If it's a schema cache issue, try to refresh and retry
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
              console.log('Schema cache issue detected in getAnalysisById, refreshing...');
              await this.refreshSchemaCache();
              retries--;
              if (retries > 0) {
                console.log(`Retrying getAnalysisById... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                continue;
              }
            }
            throw new Error(`Database error: ${error.message}`);
          }

          return data;
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            console.log(`getAnalysisById failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      console.error('Error in getAnalysisById service:', error);
      throw error;
    }
  }

  /**
   * Get the AI analysis system prompt
   * @returns {string} System prompt for AI analysis
   */
  getAnalysisSystemPrompt() {
    return `TASK: Analyze the provided events and return only one JSON object (no explanations, no extra text). The JSON must exactly match the schema below and must include a clear numeric insider-threat risk score and a categorical likelihood (Low/Medium/High). This output will be consumed directly by a dashboard, so strict types and keys are required.

SCHEMA (required keys & types):
{
  "unique_id": string, // unique id for this analysis (use the event 'Id' if same for all events; else generate "<firstEventId>-<firstRecordId>" or use provided 'id' field). MUST be unique string.
  "detected_user": string|null, // username detected (e.g., "Pikachu", "mehriban", "SYSTEM"), null if not found
  "machine_name": string|null, // host (e.g., "DESKTOP-9EHJI2B")
  "time_range": { // inclusive range of events analyzed
    "from": string, // ISO8601 (earliest event TimeCreated)
    "to": string // ISO8601 (latest event TimeCreated)
  },
  "summary": [ string, ... ], // 2-4 short bullets describing notable behaviors
  "risk_assessment": {
    "likelihood": "Low"|"Medium"|"High", // categorical label
    "score": number, // integer 0-100 (required)
    "confidence": number, // float 0.0-1.0 estimate of model confidence (required)
    "justification": string // 1-2 sentence justification for score
  },
  "top_indicators": [ string, string, string ], // exactly three 1-sentence indicators affecting the score
  "recommendations": [ string, string, string ], // exactly three prioritized Blue-Team actions (brief)
  "behavior_breakdown": { // numeric counts across event categories (integers)
    "auth_events": integer,
    "process_events": integer,
    "network_events": integer,
    "usb_events": integer,
    "dns_queries": integer
  },
  "chart_summaries": { // small arrays for dashboard charts (use up to last 10 points)
    "risk_over_time": [ { "timestamp": string, "score": integer } , ... ],
    "event_type_distribution": { "logon": integer, "process_creation": integer, "network": integer, "usb": integer, "dns": integer }
  },
  "alert_flags": { // boolean flags used for quick UI badges
    "suspicious_process": boolean,
    "external_ip_detected": boolean,
    "multiple_failed_logins": boolean,
    "admin_privilege_used": boolean
  }
}

IMPORTANT RULES & FORMATTING:

Return only JSON that exactly conforms to the schema above. No extra keys at top level (you may include extra keys nested inside objects only if absolutely necessary, but avoid them). If a value is unknown, use null for strings, and 0 for counts, and false for booleans.
Risk score must be an integer 0-100. Use this mapping to set the likelihood label:

0–33 => "Low"
34–66 => "Medium"
67–100 => "High"
Ensure the numeric score and likelihood are consistent.

confidence must be a decimal between 0.0 and 1.0 expressing how confident you are in the assessment.
summary must contain 2–4 concise bullet strings (not paragraphs).
top_indicators must contain exactly 3 short (<= 25 words) sentences — each a single reason/indicator.
recommendations must contain exactly 3 prioritized actions, short imperative sentences (e.g., "Investigate file X", "Revoke temporary access to Y").
time_range.from and time_range.to must be ISO8601 strings and represent earliest/latest TimeCreated found in input.
Populate behavior_breakdown by counting the number of events in the input that match categories: treat event Id (4624/4625) and message contents to infer auth_events; lines mentioning "Process" or event Ids for process creation -> process_events; presence of an IP or "Source Network" -> network_events; "USB" / "Removable" -> usb_events; DNS-looking strings or "dns" -> dns_queries.
Build chart_summaries.risk_over_time using the events' timestamps. If only one event present, include a single point (timestamp = event time, score = same risk score).
unique_id must be deterministic from the input when possible (prefer Id or RecordId); if multiple events with same Id, use <firstId>-<firstRecordId>.
If the input is an array of events, aggregate and analyze them as one user-host session. If a clear username cannot be found across events, set detected_user to null but still produce analysis.
Do not produce markdown, code block fences, or any commentary. Strict JSON ONLY.

EXAMPLE (for reference; DO NOT OUTPUT THE EXAMPLE):
{
  "unique_id":"4625-280795",
  "detected_user":"Pikachu",
  "machine_name":"DESKTOP-9EHJI2B",
  "time_range":{"from":"2025-10-18T10:03:03.9717533Z","to":"2025-10-18T12:53:41.4701566Z"},
  "summary":["Two failed interactive logon attempts for account 'Pikachu' from localhost.","Attempts originated from svchost.exe with no external IP.","Repeated failures within hours indicate possible credential guessing."],
  "risk_assessment":{"likelihood":"Medium","score":45,"confidence":0.78,"justification":"Multiple failed interactive logons from local process increase risk of credential guessing, but no evidence of lateral movement or data access."},
  "top_indicators":["Repeated failed logons for the same non-standard account.","Source address is localhost (127.0.0.1) which may indicate automated or local process attempts.","Caller process 'svchost.exe' initiated the requests and should be validated for legitimacy."],
  "recommendations":["Investigate the svchost.exe process hash on the host and verify binary integrity.","Audit local scheduled tasks and services for credential misuse.","Force a password reset for 'Pikachu' if found in AD and monitor additional login attempts."],
  "behavior_breakdown":{"auth_events":2,"process_events":0,"network_events":2,"usb_events":0,"dns_queries":0},
  "chart_summaries":{"risk_over_time":[{"timestamp":"2025-10-18T10:03:03.9717533Z","score":45},{"timestamp":"2025-10-18T12:53:41.4701566Z","score":45}],"event_type_distribution":{"logon":2,"process_creation":0,"network":0,"usb":0,"dns":0}},
  "alert_flags":{"suspicious_process":true,"external_ip_detected":false,"multiple_failed_logins":true,"admin_privilege_used":false}
}`;
  }

  /**
   * Format logs for AI analysis
   * @param {Array} rawLogs - Raw log entries
   * @returns {string} Formatted logs for AI
   */
  formatLogsForAI(rawLogs) {
    return `Please analyze the following Windows Security log entries:

${JSON.stringify(rawLogs, null, 2)}

Return only the JSON analysis result according to the schema provided.`;
  }

  /**
   * Clean AI response to extract JSON
   * @param {string} response - Raw AI response
   * @returns {string} Cleaned JSON string
   */
  cleanAIResponse(response) {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*$/g, '');
    cleaned = cleaned.replace(/```/g, '');
    
    // Find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    return cleaned.trim();
  }

  /**
   * Validate analysis result structure
   * @param {Object} result - Analysis result to validate
   */
  validateAnalysisResult(result) {
    try {
      const requiredFields = [
        'unique_id', 'detected_user', 'machine_name', 'time_range',
        'summary', 'risk_assessment', 'top_indicators', 'recommendations',
        'behavior_breakdown', 'chart_summaries', 'alert_flags'
      ];

      // Check for missing required fields
      const missingFields = requiredFields.filter(field => !(field in result));
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate risk assessment
      if (!result.risk_assessment || typeof result.risk_assessment !== 'object') {
        throw new Error('Invalid risk_assessment object');
      }

      // Validate risk score
      if (typeof result.risk_assessment.score !== 'number' || 
          isNaN(result.risk_assessment.score) || 
          result.risk_assessment.score < 0 || 
          result.risk_assessment.score > 100) {
        throw new Error('Risk score must be a number between 0 and 100');
      }

      // Validate risk likelihood
      if (!['Low', 'Medium', 'High'].includes(result.risk_assessment.likelihood)) {
        throw new Error('Risk likelihood must be one of: Low, Medium, High');
      }

      // Validate arrays with specific lengths
      if (!Array.isArray(result.summary) || result.summary.length < 2) {
        throw new Error('Summary must be an array with at least 2 items');
      }

      if (!Array.isArray(result.top_indicators) || result.top_indicators.length !== 3) {
        throw new Error('Top indicators must be an array with exactly 3 items');
      }

      if (!Array.isArray(result.recommendations) || result.recommendations.length !== 3) {
        throw new Error('Recommendations must be an array with exactly 3 items');
      }

      // Validate time range
      if (!result.time_range || !result.time_range.from || !result.time_range.to) {
        throw new Error('Invalid time range format');
      }

      // If all validations pass, return true
      return true;
    } catch (error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Save analysis result to database
   * @param {Object} analysisResult - AI analysis result
   * @param {Array} rawLogs - Original raw logs
   * @param {Object} truncationResult - Truncation metadata
   * @returns {Object} Saved analysis result
   */
  async saveAnalysisResult(analysisResult, rawLogs, truncationResult = null) {
    try {
      // Generate unique ID to prevent data loss from overwrites
      const timestamp = Date.now();
      const uniqueId = `${analysisResult.unique_id}-${timestamp}`;
      
      // Map AI response to database schema
      const dbRecord = {
        id: uniqueId,
        original_id: analysisResult.unique_id, // Keep original ID for reference
        detected_user: analysisResult.detected_user,
        machine_name: analysisResult.machine_name,
        time_from: analysisResult.time_range.from,
        time_to: analysisResult.time_range.to,
        risk_score: analysisResult.risk_assessment.score,
        risk_likelihood: analysisResult.risk_assessment.likelihood,
        risk_justification: analysisResult.risk_assessment.justification,
        confidence: analysisResult.risk_assessment.confidence,
        summary_bullets: analysisResult.summary,
        top_indicators: analysisResult.top_indicators,
        recommendations: analysisResult.recommendations,
        behavior_breakdown: analysisResult.behavior_breakdown,
        chart_risk_history: analysisResult.chart_summaries.risk_over_time,
        chart_event_dist: analysisResult.chart_summaries.event_type_distribution,
        alert_flags: analysisResult.alert_flags,
        timestamp_created: new Date().toISOString(),
        raw_input: rawLogs,
        // Add truncation metadata
      };

      // Try to insert with retry logic for schema cache issues
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          // Check if record with same original_id already exists
          const { data: existingRecord, error: checkError } = await this.supabase
            .from(this.tableName)
            .select('id, timestamp_created')
            .eq('original_id', analysisResult.unique_id)
            .order('timestamp_created', { ascending: false })
            .limit(1);

          if (checkError && !checkError.message.includes('schema cache')) {
            console.log('Error checking for existing record:', checkError.message);
          }

          // Always insert as new record to preserve all data
          const { data, error } = await this.supabase
            .from(this.tableName)
            .insert([dbRecord])
            .select()
            .single();

          if (error) {
            // If it's a schema cache issue, try to refresh and retry
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
              console.log('Schema cache issue detected, refreshing...');
              await this.refreshSchemaCache();
              retries--;
              if (retries > 0) {
                console.log(`Retrying database operation... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                continue;
              }
            }
            throw new Error(`Database error: ${error.message}`);
          }

          console.log(`Analysis result saved successfully with ID: ${data.id} (Original ID: ${analysisResult.unique_id})`);
          console.log(`Total records with original_id '${analysisResult.unique_id}': ${existingRecord ? existingRecord.length + 1 : 1}`);
          return data;
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            console.log(`Database operation failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      console.error('Error saving analysis result:', error);
      throw error;
    }
  }

  /**
   * Send threat report email if threshold is met
   * @param {Object} analysisResult - Analysis result from database
   */
  async sendThreatReportIfNeeded(analysisResult) {
    try {
      const riskLevel = analysisResult.risk_likelihood?.toLowerCase();
      const riskScore = analysisResult.risk_score || 0;
      
      // Check if we should send email based on risk level
      const shouldSendEmail = this.shouldSendThreatEmail(riskLevel, riskScore);
      
      if (!shouldSendEmail) {
        console.log(`Threat email not sent - Risk level: ${riskLevel}, Score: ${riskScore} (below threshold)`);
        return;
      }

      console.log(`Sending threat report email for ${riskLevel} risk (score: ${riskScore})`);
      
      // Prepare threat data for email
      const threatData = {
        id: analysisResult.id,
        detected_user: analysisResult.detected_user,
        machine_name: analysisResult.machine_name,
        risk_score: analysisResult.risk_score,
        risk_likelihood: analysisResult.risk_likelihood,
        risk_justification: analysisResult.risk_justification,
        confidence: analysisResult.confidence,
        summary_bullets: analysisResult.summary_bullets,
        top_indicators: analysisResult.top_indicators,
        recommendations: analysisResult.recommendations,
        behavior_breakdown: analysisResult.behavior_breakdown,
        alert_flags: analysisResult.alert_flags,
        time_from: analysisResult.time_from,
        time_to: analysisResult.time_to,
        timestamp_created: analysisResult.timestamp_created
      };

      // Send the threat report email
      console.log(`Attempting to send threat report email to ${this.adminEmail}...`);
      const emailResult = await this.emailService.sendThreatReportEmail(threatData);
      
      if (emailResult.success) {
        console.log(`✅ Threat report email sent successfully to ${this.adminEmail}`);
        console.log(`Email Message ID: ${emailResult.messageId}`);
      } else {
        console.error(`❌ Failed to send threat report email: ${emailResult.error}`);
        console.error(`Email service error details:`, emailResult);
      }
      
    } catch (error) {
      console.error('Error in sendThreatReportIfNeeded:', error);
      // Don't throw error - email failure shouldn't break the analysis
    }
  }

  /**
   * Determine if threat email should be sent based on risk level and score
   * @param {string} riskLevel - Risk level (low, medium, high)
   * @param {number} riskScore - Risk score (0-100)
   * @returns {boolean} True if email should be sent
   */
  shouldSendThreatEmail(riskLevel, riskScore) {
    // Send emails for ALL threats regardless of level or score
    console.log(`Checking email threshold - Risk level: ${riskLevel}, Score: ${riskScore}`);
    
    // Always send emails for any threat detection
    return true;
  }

  /**
   * Get AI limits configuration
   * @returns {Object} AI limits configuration
   */
  getAILimits() {
    return {
      ...this.aiLimits,
      description: {
        maxChars: 'Maximum characters to send to AI (Mistral free version limit)',
        maxLogs: 'Maximum number of log entries to process',
        truncateMessage: 'Whether to truncate long messages',
        maxMessageLength: 'Maximum message length per log entry'
      }
    };
  }

  /**
   * Update AI limits configuration
   * @param {Object} newLimits - New limits configuration
   * @returns {Object} Updated limits
   */
  updateAILimits(newLimits) {
    this.aiLimits = {
      ...this.aiLimits,
      ...newLimits
    };
    console.log('AI limits updated:', this.aiLimits);
    return this.aiLimits;
  }

  /**
   * Test email configuration
   * @returns {Object} Test result
   */
  async testEmailConfiguration() {
    try {
      console.log('Testing email configuration...');
      
      // Test basic email sending
      const testEmailData = {
        to: this.adminEmail,
        from: process.env.SMTP_USER, // Use the authenticated SMTP user
        subject: '🧪 Email Configuration Test - Backlify Security System',
        html: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email to verify that the email service is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>System:</strong> Backlify Security Analysis</p>
          <p><strong>Recipient:</strong> ${this.adminEmail}</p>
        `,
        replyTo: 'security@backlify.app', // Set reply-to for responses
        metadata: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };

      const result = await this.emailService.sendFlexibleEmail(testEmailData);
      
      if (result.success) {
        console.log('✅ Email configuration test successful');
        return {
          success: true,
          message: 'Email configuration is working correctly',
          messageId: result.messageId
        };
      } else {
        console.error('❌ Email configuration test failed:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Error testing email configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually send threat report email for specific analysis
   * @param {string} analysisId - Analysis ID
   * @returns {Object} Result object
   */
  async sendManualThreatReport(analysisId) {
    try {
      console.log(`Sending manual threat report for analysis ID: ${analysisId}`);
      
      // Get analysis result from database
      const analysisResult = await this.getAnalysisById(analysisId);
      
      if (!analysisResult) {
        return {
          success: false,
          error: 'Analysis not found'
        };
      }

      // Prepare threat data for email
      const threatData = {
        id: analysisResult.id,
        detected_user: analysisResult.detected_user,
        machine_name: analysisResult.machine_name,
        risk_score: analysisResult.risk_score,
        risk_likelihood: analysisResult.risk_likelihood,
        risk_justification: analysisResult.risk_justification,
        confidence: analysisResult.confidence,
        summary_bullets: analysisResult.summary_bullets,
        top_indicators: analysisResult.top_indicators,
        recommendations: analysisResult.recommendations,
        behavior_breakdown: analysisResult.behavior_breakdown,
        alert_flags: analysisResult.alert_flags,
        time_from: analysisResult.time_from,
        time_to: analysisResult.time_to,
        timestamp_created: analysisResult.timestamp_created
      };

      // Send the threat report email
      const emailResult = await this.emailService.sendThreatReportEmail(threatData);
      
      if (emailResult.success) {
        console.log(`Manual threat report email sent successfully to ${this.adminEmail}`);
        return {
          success: true,
          message: 'Threat report email sent successfully',
          analysisId: analysisId
        };
      } else {
        console.error(`Failed to send manual threat report email: ${emailResult.error}`);
        return {
          success: false,
          error: `Failed to send email: ${emailResult.error}`
        };
      }
      
    } catch (error) {
      console.error('Error in sendManualThreatReport:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get database statistics for monitoring data retention
   * @returns {Object} Database statistics
   */
  async getDatabaseStats() {
    try {
      const { data: totalCount, error: countError } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      const { data: recentData, error: recentError } = await this.supabase
        .from(this.tableName)
        .select('timestamp_created, original_id')
        .order('timestamp_created', { ascending: false })
        .limit(100);

      const { data: uniqueOriginals, error: uniqueError } = await this.supabase
        .from(this.tableName)
        .select('original_id')
        .not('original_id', 'is', null);

      // Count unique original IDs
      const uniqueOriginalIds = new Set(uniqueOriginals?.map(item => item.original_id) || []);
      
      // Count versions per original ID
      const versionCounts = {};
      uniqueOriginals?.forEach(item => {
        versionCounts[item.original_id] = (versionCounts[item.original_id] || 0) + 1;
      });

      const stats = {
        total_records: totalCount?.length || 0,
        unique_original_analyses: uniqueOriginalIds.size,
        recent_analyses: recentData?.length || 0,
        version_distribution: versionCounts,
        latest_analysis: recentData?.[0]?.timestamp_created || null,
        table_name: this.tableName,
        timestamp: new Date().toISOString()
      };

      console.log('Database Statistics:', JSON.stringify(stats, null, 2));
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async refreshSchemaCache() {
    try {
      console.log('Attempting to refresh schema cache...');
      // Try to query a simple table to refresh the schema cache
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('Schema refresh error:', error.message);
        // Try alternative table name variations
        const alternativeNames = ['securityloganalysis', 'SecurityLogAnalysis', 'security_log_analysis'];
        for (const tableName of alternativeNames) {
          try {
            const { error: altError } = await this.supabase
              .from(tableName)
              .select('id')
              .limit(1);
            if (!altError) {
              console.log(`Found table with name: ${tableName}`);
              this.tableName = tableName;
              return;
            }
          } catch (e) {
            console.log(`Table ${tableName} not found`);
          }
        }
      } else {
        console.log('Schema refresh completed successfully');
      }
    } catch (error) {
      console.log('Schema refresh attempt completed with error:', error.message);
    }
  }
}

module.exports = AnalysisService;
