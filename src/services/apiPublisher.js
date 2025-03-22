const { v4: uuidv4 } = require('uuid');

class APIPublisher {
  constructor() {
    this.apiInstances = new Map();
    this.apiMetadata = new Map();
    
    // Initialize the api_registry table
    // We can't use await in the constructor, so use a promise and handle errors
    this._initializeRegistry().catch(error => {
      console.error('Failed to initialize API registry:', error);
    });
  }

  // Add method to ensure api_registry table exists
  async _initializeRegistry() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      
      // Check if Supabase config is present
      if (!config.supabase || !config.supabase.url || !config.supabase.key) {
        console.error('Supabase configuration is missing or incomplete. Check your .env file.');
        return;
      }
      
      console.log('Initializing API registry table...');
      
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      // First check if the table exists by trying to query it
      const { error: queryError } = await supabase
        .from('api_registry')
        .select('api_id')
        .limit(1);
      
      if (queryError && queryError.code === '42P01') {
        console.log('API registry table does not exist. Creating it...');
        
        // Try to create the table through either execute_sql or direct SQL in Supabase dashboard
        console.error('Table "api_registry" does not exist. Please create it manually with the following SQL:');
        console.error(`
          CREATE TABLE api_registry (
            api_id UUID PRIMARY KEY,
            metadata JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        `);
        
        // Note: We won't attempt to create it automatically as it requires admin privileges 
        // that the service role API key might not have.
      } else if (queryError) {
        console.error('Error checking if api_registry table exists:', queryError);
      } else {
        console.log('API registry table exists.');
      }
    } catch (error) {
      console.error('Error initializing API registry:', error);
    }
  }

  publishAPI(router, metadata = {}) {
    const apiId = metadata.apiId || uuidv4();
    
    // IMPORTANT: Clone the metadata to prevent reference sharing
    const safeMetadata = JSON.parse(JSON.stringify({
      ...metadata,
      apiId,
      userId: metadata.userId || 'default',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    }));
    
    // Make sure the router has the user ID assigned to it (in case it wasn't set already)
    // Use read-only property if not already defined
    if (!router.hasOwnProperty('userId')) {
      Object.defineProperty(router, 'userId', {
        value: safeMetadata.userId,
        writable: false,
        enumerable: true
      });
    }
    
    // Log which API is being published and for which user
    console.log(`Publishing API ${apiId} for user ${router.userId}`);
    
    // Store router in the map
    this.apiInstances.set(apiId, router);
    
    // Store metadata about this API with userId explicitly included
    this.apiMetadata.set(apiId, safeMetadata);
    
    // Persist API metadata to database
    this._persistApiMetadata(apiId, safeMetadata);
    
    return apiId;
  }

  getRouter(apiId) {
    // Update last accessed time if the API exists
    if (this.apiMetadata.has(apiId)) {
      const metadata = this.apiMetadata.get(apiId);
      metadata.lastAccessed = new Date().toISOString();
      
      // Log which API is being accessed
      console.log(`Accessing API ${apiId} for user ${metadata.userId || 'default'}`);
    }
    
    // If router exists, return it
    if (this.apiInstances.has(apiId)) {
      const router = this.apiInstances.get(apiId);
      console.log(`Found router instance ${router._instanceId} for API ${apiId}`);
      return router;
    }
    
    // If router doesn't exist, try to restore it
    console.log(`Router not found for API ${apiId}, attempting to restore...`);
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
      
      // Check if Supabase config is present
      if (!config.supabase || !config.supabase.url || !config.supabase.key) {
        console.error('Supabase configuration is missing or incomplete. Check your .env file.');
        return;
      }
      
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      // The metadata should already have userId included, but ensure it's there
      const dataToStore = typeof metadata === 'string' 
        ? JSON.parse(metadata) 
        : metadata;
      
      if (!dataToStore.userId) {
        dataToStore.userId = 'default';
      }
      
      console.log(`Persisting API ${apiId} for user ${dataToStore.userId}`);
      
      // Prepare the record object
      const record = { 
        api_id: apiId,
        metadata: JSON.stringify(dataToStore),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      
      // Store in a dedicated table
      const { data, error } = await supabase
        .from('api_registry')
        .upsert(record)
        .select();
        
      if (error) {
        console.error('Error persisting API metadata:', error);
        // Log more specific error details
        if (error.code === '42P01') {
          console.error('Table "api_registry" does not exist. Create it with the following SQL:');
          console.error(`
            CREATE TABLE api_registry (
              api_id UUID PRIMARY KEY,
              metadata JSONB NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
          `);
        } else if (error.code === '42703') {
          console.error('Column error. Check that the table has the correct schema.');
        } else if (error.code === '23505') {
          console.error('Duplicate key error. The API ID already exists.');
        } else {
          console.error('Database error details:', error.details || 'No additional details');
        }
      } else {
        console.log(`Successfully persisted API ${apiId} to database.`);
      }
    } catch (error) {
      console.error('Failed to persist API metadata:', error);
      // Log out error stack trace for debugging
      console.error(error.stack);
    }
  }
  
  // Remove API metadata from database
  async _removeApiMetadata(apiId) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../config/config');
      
      // Check if Supabase config is present
      if (!config.supabase || !config.supabase.url || !config.supabase.key) {
        console.error('Supabase configuration is missing or incomplete. Check your .env file.');
        return;
      }
      
      const supabase = createClient(config.supabase.url, config.supabase.key);
      
      console.log(`Removing API ${apiId} from the database`);
      
      const { data, error } = await supabase
        .from('api_registry')
        .delete()
        .eq('api_id', apiId)
        .select();
        
      if (error) {
        console.error('Error removing API metadata:', error);
        // Log more specific error details
        if (error.code === '42P01') {
          console.error('Table "api_registry" does not exist.');
        } else {
          console.error('Database error details:', error.details || 'No additional details');
        }
      } else {
        console.log(`Successfully removed API ${apiId} from database.`);
      }
    } catch (error) {
      console.error('Failed to remove API metadata:', error);
      console.error(error.stack);
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
      
      // Get userId from metadata or use default
      const userId = metadata.userId || 'default';
      console.log(`Restoring API ${apiId} for user ${userId}`);
      
      // Only proceed if we have tables information
      if (!metadata || !metadata.tables || !Array.isArray(metadata.tables)) {
        console.error('Invalid API metadata format:', metadata);
        return null;
      }
      
      // Deep clone the tables to prevent any shared references
      const safeTableSchemas = JSON.parse(JSON.stringify(metadata.tables));
      
      // Import required modules - IMPORTANT: Get a fresh reference each time
      const { generateEndpoints } = require('../services/apiGenerator');
      
      // Create a new Express router for this API - with the isolated schemas
      console.log(`Creating new router for API ${apiId}`);
      const regeneratedRouter = generateEndpoints(safeTableSchemas, userId);
      
      // Store the regenerated API router
      this.apiInstances.set(apiId, regeneratedRouter);
      
      // Update metadata to ensure userId is stored correctly - use a safe clone
      const safeMetadata = JSON.parse(JSON.stringify({
        ...metadata,
        apiId,
        userId: userId,
        restored: true,
        lastAccessed: new Date().toISOString()
      }));
      
      this.apiMetadata.set(apiId, safeMetadata);
      
      console.log(`Successfully restored API: ${apiId} with router instance ${regeneratedRouter._instanceId}`);
      
      return regeneratedRouter;
    } catch (error) {
      console.error('Failed to restore API:', error);
      return null;
    }
  }
  
  // Load all APIs from registry on startup
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
      
      // Import the APIGeneratorController module
      // but get a fresh controller instance for each API to avoid shared state
      
      // Restore each API
      for (const item of data) {
        try {
          const apiId = item.api_id;
          // Parse metadata safely
          let metadata;
          try {
            metadata = typeof item.metadata === 'string' 
              ? JSON.parse(item.metadata) 
              : item.metadata;
          } catch (e) {
            console.error(`Error parsing metadata for API ${apiId}:`, e);
            continue;
          }
          
          // Log API being restored with its userId
          const userId = metadata.userId || 'default';
          console.log(`Restoring API ${apiId} for user ${userId}`);
          
          // Clone the metadata to prevent shared references
          const safeMetadata = JSON.parse(JSON.stringify(metadata));
          
          // Load the API directly using our restore method
          // which creates a new router instance each time
          const regeneratedRouter = await this._restoreAPI(apiId);
          
          if (!regeneratedRouter) {
            console.error(`Failed to restore API: ${apiId}`);
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

// Export a singleton instance of the APIPublisher
module.exports = new APIPublisher(); 