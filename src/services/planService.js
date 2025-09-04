const axios = require('axios');

class PlanService {
  constructor() {
    this.plansCache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get all available plans from the payment API
   * @returns {Promise<Array>} Array of plan objects
   */
  async getPlans() {
    try {
      // Check if we have valid cached data
      if (this.plansCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.plansCache;
      }

      const response = await axios.get('https://backlify-v2.onrender.com/api/payment/plans', {
        timeout: 10000
      });

      if (response.data.success && response.data.data) {
        this.plansCache = response.data.data;
        this.cacheExpiry = Date.now() + this.cacheDuration;
        return this.plansCache;
      }

      throw new Error('Invalid response from plans API');
    } catch (error) {
      console.error('Error fetching plans:', error.message);
      console.error('Full error:', error);
      
      // Return fallback plans if API fails
      return this.getFallbackPlans();
    }
  }

  /**
   * Get a specific plan by ID
   * @param {string} planId - Plan ID to fetch
   * @returns {Promise<Object|null>} Plan object or null if not found
   */
  async getPlanById(planId) {
    const plans = await this.getPlans();
    return plans.find(plan => plan.id === planId) || null;
  }

  /**
   * Get plan limits (max projects and requests)
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Object with maxProjects and maxRequests
   */
  async getPlanLimits(planId) {
    const plan = await this.getPlanById(planId);
    
    if (!plan) {
      return { maxProjects: 0, maxRequests: 0 };
    }

    // Parse limits from features array
    const maxProjects = this.extractLimitFromFeatures(plan.features, 'projects');
    const maxRequests = this.extractLimitFromFeatures(plan.features, 'requests');

    return {
      maxProjects,
      maxRequests,
      planName: plan.name,
      isUnlimited: planId === 'enterprise'
    };
  }

  /**
   * Extract numeric limit from features array
   * @param {Array} features - Array of feature strings
   * @param {string} type - Type of limit to extract ('projects' or 'requests')
   * @returns {number} Extracted limit or 0 if not found
   */
  extractLimitFromFeatures(features, type) {
    if (!Array.isArray(features)) return 0;

    for (const feature of features) {
      const lowerFeature = feature.toLowerCase();
      
      if (type === 'projects' && lowerFeature.includes('project')) {
        if (lowerFeature.includes('unlimited')) {
          return Infinity;
        }
        
        const match = lowerFeature.match(/(\d+)\s*project/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      
      if (type === 'requests' && lowerFeature.includes('request')) {
        if (lowerFeature.includes('unlimited')) {
          return Infinity;
        }
        
        const match = lowerFeature.match(/(\d+)\s*request/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }

    return 0;
  }

  /**
   * Fallback plans in case API is unavailable
   * @returns {Array} Array of fallback plan objects
   */
  getFallbackPlans() {
    return [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 0,
        currency: 'USD',
        features: [
          '2 Projects',
          '1000 requests/month',
          'Email support'
        ]
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        price: 9.99,
        currency: 'USD',
        features: [
          '10 Projects',
          '10000 requests/month',
          'Priority support',
          'Custom domains'
        ]
      },
      {
        id: 'enterprise',
        name: 'Enterprise Plan',
        price: 29.99,
        currency: 'USD',
        features: [
          'Unlimited Projects',
          'Unlimited requests',
          '24/7 support',
          'Custom integrations'
        ]
      }
    ];
  }

  /**
   * Check if a plan has unlimited access
   * @param {string} planId - Plan ID to check
   * @returns {Promise<boolean>} True if plan has unlimited access
   */
  async isUnlimitedPlan(planId) {
    const limits = await this.getPlanLimits(planId);
    return limits.isUnlimited;
  }
}

module.exports = PlanService;
