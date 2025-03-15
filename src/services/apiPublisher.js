const { v4: uuidv4 } = require('uuid');

class APIPublisher {
  constructor() {
    this.apiInstances = new Map();
    this.apiMetadata = new Map();
  }

  publishAPI(router, metadata = {}) {
    const apiId = metadata.apiId || uuidv4();
    this.apiInstances.set(apiId, router);
    
    // Store metadata about this API
    this.apiMetadata.set(apiId, {
      ...metadata,
      apiId,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    });
    
    // Persist API metadata to database
    this._persistApiMetadata(apiId, metadata);
    
    return apiId;
  }

  getRouter(apiId) {
    // Update last accessed time
    if (this.apiMetadata.has(apiId)) {
      this.apiMetadata.get(apiId).lastAccessed = new Date().toISOString();
    }
    
    // If router exists, return it
    if (this.apiInstances.has(apiId)) {
      return this.apiInstances.get(apiId);
    }
    
    // If router doesn't exist, try to restore it
    return this._restoreAPI(apiId);
  }

  unpublishAPI(apiId) {
    this.apiInstances.delete(apiId);
    this.apiMetadata.delete(apiId);
    // Also remove from database
    this._removeApiMetadata(apiId);
    return true;
  }
  
  // Persist API metadata to database
  async _persistApiMetadata(apiId, metadata) {
    try {
      // Create Supabase client for persistence
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      // Store in a dedicated table
      const { error } = await supabase
        .from('api_registry')
        .upsert({ 
          api_id: apiId,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (error) {
        console.error('Error persisting API metadata:', error);
      }
    } catch (error) {
      console.error('Failed to persist API metadata:', error);
    }
  }
  
  // Remove API metadata from database
  async _removeApiMetadata(apiId) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      const { error } = await supabase
        .from('api_registry')
        .delete()
        .eq('api_id', apiId);
        
      if (error) {
        console.error('Error removing API metadata:', error);
      }
    } catch (error) {
      console.error('Failed to remove API metadata:', error);
    }
  }
  
  // Restore API from metadata
  async _restoreAPI(apiId) {
    try {
      // Get metadata from database
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      const { data, error } = await supabase
        .from('api_registry')
        .select('metadata')
        .eq('api_id', apiId)
        .single();
        
      if (error || !data) {
        console.error('API not found in registry:', apiId);
        return null;
      }
      
      // Parse metadata, ensure it's an object
      let metadata;
      try {
        metadata = typeof data.metadata === 'string' 
          ? JSON.parse(data.metadata) 
          : data.metadata;
      } catch (e) {
        console.error('Error parsing API metadata:', e);
        return null;
      }
      
      // Only proceed if we have tables information
      if (!metadata || !metadata.tables || !Array.isArray(metadata.tables)) {
        console.error('Invalid API metadata format:', metadata);
        return null;
      }
      
      // Import required modules
      const apiGenerator = require('./apiGenerator');
      
      // Regenerate the API
      const userId = metadata.userId || 'default';
      console.log(`Regenerating API ${apiId} for user ${userId}`);
      
      // Create a new Express router for this API
      const regeneratedRouter = apiGenerator.generateEndpoints(metadata.tables, userId);
      
      // Store the regenerated API router
      this.apiInstances.set(apiId, regeneratedRouter);
      
      return regeneratedRouter;
    } catch (error) {
      console.error('Failed to restore API:', error);
      return null;
    }
  }
  
  // Load all APIs on server start
  async loadAllAPIs() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      const { data, error } = await supabase
        .from('api_registry')
        .select('api_id, metadata');
        
      if (error) {
        console.error('Error loading APIs from registry:', error);
        return;
      }
      
      console.log(`Found ${data.length} APIs in registry. Restoring...`);
      
      // Import required services
      const APIGeneratorController = require('../controllers/apiGeneratorController');
      const apiGeneratorController = new APIGeneratorController();
      
      // Restore each API
      for (const item of data) {
        try {
          const apiId = item.api_id;
          const metadata = JSON.parse(item.metadata);
          
          // Regenerate the API
          const regeneratedAPI = await apiGeneratorController.regenerateAPI(metadata);
          
          if (regeneratedAPI) {
            this.apiInstances.set(apiId, regeneratedAPI);
            this.apiMetadata.set(apiId, {
              ...metadata,
              apiId,
              restored: true,
              lastAccessed: new Date().toISOString()
            });
            console.log(`Successfully restored API: ${apiId}`);
          }
        } catch (err) {
          console.error(`Failed to restore API ${item.api_id}:`, err);
        }
      }
    } catch (error) {
      console.error('Failed to load APIs:', error);
    }
  }
}

module.exports = new APIPublisher(); 