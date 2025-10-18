const AnalysisService = require('../services/analysisService');
const { setCorsHeaders } = require('../middleware/corsMiddleware');

class AnalysisController {
  constructor() {
    this.analysisService = new AnalysisService();
  }

  /**
   * Analyze security logs endpoint
   * POST /api/analysis
   */
  async analyzeLogs(req, res) {
    try {
      setCorsHeaders(res, req);

      // Check if request body exists
      if (!req.body) {
        return res.status(400).json({
          success: false,
          error: 'No data provided',
          details: 'Please provide Windows Security log JSON data'
        });
      }

      // Handle both single object and array of objects
      let rawLogs = req.body;
      if (!Array.isArray(rawLogs)) {
        rawLogs = [rawLogs];
      }

      // Validate that we have log data
      if (rawLogs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No log data provided',
          details: 'Please provide at least one Windows Security log entry'
        });
      }

      // Analyze logs using the service
      const result = await this.analysisService.analyzeLogs(rawLogs);

      res.status(201).json({
        success: true,
        message: 'Logs analyzed successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in analyzeLogs controller:', error);
      
      if (error.message.includes('AI analysis failed')) {
        return res.status(500).json({
          success: false,
          error: 'AI analysis failed',
          details: error.message
        });
      }

      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to save analysis results'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Analysis failed',
        details: error.message
      });
    }
  }

  /**
   * Get all analysis results endpoint
   * GET /api/analysis
   */
  async getAllAnalysis(req, res) {
    try {
      setCorsHeaders(res, req);

      const { 
        limit = 100, 
        offset = 0, 
        risk_level, 
        user, 
        machine, 
        from_date, 
        to_date,
        sort_by = 'timestamp_created',
        sort_order = 'desc'
      } = req.query;

      // Validate query parameters
      const parsedLimit = Math.min(parseInt(limit) || 100, 1000); // Max 1000 results per request
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      // Build filters
      const filters = {};
      if (risk_level) filters.risk_likelihood = risk_level;
      if (user) filters.detected_user = user;
      if (machine) filters.machine_name = machine;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;

      const result = await this.analysisService.getAllAnalysis(
        parsedLimit, 
        parsedOffset, 
        filters,
        sort_by,
        sort_order
      );

      res.json({
        success: true,
        data: result.analyses,
        pagination: {
          total: result.total,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: result.total > (parsedOffset + parsedLimit)
        },
        filters: filters
      });
    } catch (error) {
      console.error('Error in getAllAnalysis controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve analysis results'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get analysis results',
        details: error.message
      });
    }
  }

  /**
   * Get all versions of an analysis by original_id endpoint
   * GET /api/analysis/versions/:originalId
   */
  async getAnalysisVersions(req, res) {
    try {
      setCorsHeaders(res, req);

      const { originalId } = req.params;
      
      if (!originalId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid original analysis ID',
          details: 'Please provide a valid original analysis ID'
        });
      }

      const results = await this.analysisService.getAnalysisVersions(originalId);
      
      res.json({
        success: true,
        data: results,
        count: results.length,
        original_id: originalId
      });
    } catch (error) {
      console.error('Error in getAnalysisVersions controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve analysis versions'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get analysis versions',
        details: error.message
      });
    }
  }

  /**
   * Get database statistics endpoint
   * GET /api/analysis/stats
   */
  async getDatabaseStats(req, res) {
    try {
      setCorsHeaders(res, req);

      const stats = await this.analysisService.getDatabaseStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getDatabaseStats controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get database statistics',
        details: error.message
      });
    }
  }

  /**
   * Get AI limits configuration endpoint
   * GET /api/analysis/ai-limits
   */
  async getAILimits(req, res) {
    try {
      setCorsHeaders(res, req);

      const limits = this.analysisService.getAILimits();
      
      res.json({
        success: true,
        data: limits
      });
    } catch (error) {
      console.error('Error in getAILimits controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get AI limits',
        details: error.message
      });
    }
  }

  /**
   * Update AI limits configuration endpoint
   * PUT /api/analysis/ai-limits
   */
  async updateAILimits(req, res) {
    try {
      setCorsHeaders(res, req);

      const { maxChars, maxLogs, truncateMessage, maxMessageLength } = req.body;
      
      const newLimits = {};
      if (maxChars !== undefined) newLimits.maxChars = maxChars;
      if (maxLogs !== undefined) newLimits.maxLogs = maxLogs;
      if (truncateMessage !== undefined) newLimits.truncateMessage = truncateMessage;
      if (maxMessageLength !== undefined) newLimits.maxMessageLength = maxMessageLength;

      const updatedLimits = this.analysisService.updateAILimits(newLimits);
      
      res.json({
        success: true,
        message: 'AI limits updated successfully',
        data: updatedLimits
      });
    } catch (error) {
      console.error('Error in updateAILimits controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to update AI limits',
        details: error.message
      });
    }
  }

  /**
   * Test email configuration endpoint
   * POST /api/analysis/test-email
   */
  async testEmailConfiguration(req, res) {
    try {
      setCorsHeaders(res, req);

      const result = await this.analysisService.testEmailConfiguration();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          messageId: result.messageId
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in testEmailConfiguration controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to test email configuration',
        details: error.message
      });
    }
  }

  /**
   * Send threat report email endpoint
   * POST /api/analysis/:id/send-report
   */
  async sendThreatReport(req, res) {
    try {
      setCorsHeaders(res, req);

      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis ID',
          details: 'Please provide a valid analysis ID'
        });
      }

      const result = await this.analysisService.sendManualThreatReport(id);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          analysisId: result.analysisId
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in sendThreatReport controller:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to send threat report',
        details: error.message
      });
    }
  }

  /**
   * Get specific analysis result endpoint
   * GET /api/analysis/:id
   */
  async getAnalysisById(req, res) {
    try {
      setCorsHeaders(res, req);

      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis ID',
          details: 'Please provide a valid analysis ID'
        });
      }

      const result = await this.analysisService.getAnalysisById(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
          details: 'The requested analysis could not be found'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getAnalysisById controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve analysis result'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get analysis result',
        details: error.message
      });
    }
  }
}

module.exports = AnalysisController;
