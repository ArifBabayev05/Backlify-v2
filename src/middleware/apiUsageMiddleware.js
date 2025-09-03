const { createClient } = require('@supabase/supabase-js');

class ApiUsageMiddleware {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Middleware to track API usage
   */
  trackUsage() {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to capture response data
      res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Track usage asynchronously (don't block response)
        setImmediate(async () => {
          try {
            await this.logApiUsage(req, res, responseTime, data);
          } catch (error) {
            console.error('Error logging API usage:', error);
          }
        }.bind(this));
        
        // Call original json method
        return originalJson.call(this, data);
      }.bind(res);
      
      next();
    };
  }

  /**
   * Log API usage to database
   * @private
   */
  async logApiUsage(req, res, responseTime, responseData) {
    try {
      // Skip tracking for certain endpoints
      if (this.shouldSkipTracking(req.path)) {
        return;
      }

      const userId = req.user?.id || null;
      const endpoint = req.path;
      const method = req.method;
      const statusCode = res.statusCode;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      const requestSize = req.get('Content-Length') ? parseInt(req.get('Content-Length')) : 0;
      const responseSize = JSON.stringify(responseData).length;
      const errorMessage = statusCode >= 400 ? this.extractErrorMessage(responseData) : null;

      await this.supabase
        .from('api_usage')
        .insert([{
          user_id: userId,
          endpoint: endpoint,
          method: method,
          status_code: statusCode,
          response_time: responseTime,
          ip_address: ipAddress,
          user_agent: userAgent,
          request_size: requestSize,
          response_size: responseSize,
          error_message: errorMessage
        }]);

    } catch (error) {
      console.error('Error logging API usage:', error);
    }
  }

  /**
   * Check if endpoint should skip tracking
   * @private
   */
  shouldSkipTracking(path) {
    const skipPaths = [
      '/health',
      '/api/health',
      '/api/user/logs', // Avoid infinite recursion
      '/api/user/usage', // Avoid infinite recursion
      '/docs',
      '/swagger.json'
    ];

    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  /**
   * Extract error message from response data
   * @private
   */
  extractErrorMessage(responseData) {
    if (typeof responseData === 'object' && responseData !== null) {
      return responseData.error || responseData.message || 'Unknown error';
    }
    return null;
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStats(userId, startDate, endDate) {
    try {
      let query = this.supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: usage, error } = await query;

      if (error) {
        throw error;
      }

      return this.calculateUsageStats(usage);
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      throw error;
    }
  }

  /**
   * Calculate usage statistics from raw data
   * @private
   */
  calculateUsageStats(usage) {
    const totalCalls = usage.length;
    const successfulCalls = usage.filter(u => u.status_code >= 200 && u.status_code < 300).length;
    const errorRate = totalCalls > 0 ? ((totalCalls - successfulCalls) / totalCalls * 100).toFixed(1) : 0;
    const avgResponseTime = totalCalls > 0 ? Math.round(usage.reduce((sum, u) => sum + u.response_time, 0) / totalCalls) : 0;

    // Group by endpoint
    const endpointStats = {};
    usage.forEach(u => {
      if (!endpointStats[u.endpoint]) {
        endpointStats[u.endpoint] = {
          calls: 0,
          success: 0,
          totalResponseTime: 0
        };
      }
      endpointStats[u.endpoint].calls++;
      if (u.status_code >= 200 && u.status_code < 300) {
        endpointStats[u.endpoint].success++;
      }
      endpointStats[u.endpoint].totalResponseTime += u.response_time;
    });

    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        calls: stats.calls,
        success: ((stats.success / stats.calls) * 100).toFixed(1),
        avgResponseTime: Math.round(stats.totalResponseTime / stats.calls)
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return {
      totalCalls,
      successfulCalls,
      errorRate: parseFloat(errorRate),
      avgResponseTime,
      topEndpoints
    };
  }
}

// Create singleton instance
const apiUsageMiddleware = new ApiUsageMiddleware();

module.exports = apiUsageMiddleware;
