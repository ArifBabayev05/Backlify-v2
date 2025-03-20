/**
 * Schema Controller
 * Handles operations related to schema management
 */
class SchemaController {
  constructor() {
    this.pendingChanges = new Map();
  }

  /**
   * Get schema for an API
   */
  getSchema(req, res) {
    const { apiId } = req.params;
    const userId = req.userId;
    
    console.log(`Getting schema for API ${apiId} for user ${userId}`);
    
    // Return a placeholder response
    res.json({
      message: 'Schema retrieved successfully',
      apiId,
      userId,
      schema: {
        tables: []
      }
    });
  }

  /**
   * Update schema for an API
   */
  updateSchema(req, res) {
    const { apiId } = req.params;
    const { tables } = req.body;
    const userId = req.userId;
    
    console.log(`Updating schema for API ${apiId} for user ${userId}`);
    
    // Store pending changes
    if (!this.pendingChanges.has(apiId)) {
      this.pendingChanges.set(apiId, { userId, tables: [] });
    }
    
    // Update pending changes
    this.pendingChanges.get(apiId).tables = tables || [];
    
    res.json({
      message: 'Schema update pending',
      apiId,
      pendingChanges: this.pendingChanges.get(apiId)
    });
  }

  /**
   * Apply pending schema changes
   */
  applySchemaChanges(req, res) {
    const { apiId } = req.params;
    const userId = req.userId;
    
    console.log(`Applying schema changes for API ${apiId} for user ${userId}`);
    
    // Check if there are pending changes
    if (!this.pendingChanges.has(apiId)) {
      return res.status(400).json({
        error: 'No pending changes found'
      });
    }
    
    // Get pending changes
    const pendingChanges = this.pendingChanges.get(apiId);
    
    // Clear pending changes
    this.pendingChanges.delete(apiId);
    
    res.json({
      message: 'Schema changes applied successfully',
      apiId,
      appliedChanges: pendingChanges
    });
  }

  /**
   * Get pending schema changes
   */
  getPendingChanges(req, res) {
    const { apiId } = req.params;
    const userId = req.userId;
    
    console.log(`Getting pending changes for API ${apiId} for user ${userId}`);
    
    // Check if there are pending changes
    if (!this.pendingChanges.has(apiId)) {
      return res.json({
        message: 'No pending changes found',
        apiId,
        pendingChanges: null
      });
    }
    
    res.json({
      message: 'Pending changes retrieved',
      apiId,
      pendingChanges: this.pendingChanges.get(apiId)
    });
  }

  /**
   * Cancel pending schema changes
   */
  cancelPendingChanges(req, res) {
    const { apiId } = req.params;
    const userId = req.userId;
    
    console.log(`Canceling pending changes for API ${apiId} for user ${userId}`);
    
    // Check if there are pending changes
    if (!this.pendingChanges.has(apiId)) {
      return res.status(400).json({
        error: 'No pending changes found'
      });
    }
    
    // Clear pending changes
    this.pendingChanges.delete(apiId);
    
    res.json({
      message: 'Pending changes canceled successfully',
      apiId
    });
  }

  /**
   * Add a table to the schema
   */
  addTable(req, res) {
    const { apiId } = req.params;
    const { table } = req.body;
    const userId = req.userId;
    
    console.log(`Adding table to schema for API ${apiId} for user ${userId}`);
    
    // Validate table
    if (!table || !table.name) {
      return res.status(400).json({
        error: 'Table must have a name'
      });
    }
    
    // Initialize pending changes if needed
    if (!this.pendingChanges.has(apiId)) {
      this.pendingChanges.set(apiId, { userId, tables: [] });
    }
    
    // Add table to pending changes
    this.pendingChanges.get(apiId).tables.push(table);
    
    res.json({
      message: 'Table added to schema',
      apiId,
      table,
      pendingChanges: this.pendingChanges.get(apiId)
    });
  }

  /**
   * Update a table in the schema
   */
  updateTable(req, res) {
    const { apiId, tableName } = req.params;
    const { table } = req.body;
    const userId = req.userId;
    
    console.log(`Updating table ${tableName} in schema for API ${apiId} for user ${userId}`);
    
    // Check if there are pending changes
    if (!this.pendingChanges.has(apiId)) {
      return res.status(400).json({
        error: 'No pending changes found'
      });
    }
    
    // Get pending changes
    const pendingChanges = this.pendingChanges.get(apiId);
    
    // Find table index
    const tableIndex = pendingChanges.tables.findIndex(t => t.name === tableName);
    
    if (tableIndex === -1) {
      return res.status(404).json({
        error: `Table ${tableName} not found`
      });
    }
    
    // Update table
    pendingChanges.tables[tableIndex] = table;
    
    res.json({
      message: 'Table updated in schema',
      apiId,
      table,
      pendingChanges
    });
  }

  /**
   * Remove a table from the schema
   */
  removeTable(req, res) {
    const { apiId, tableName } = req.params;
    const userId = req.userId;
    
    console.log(`Removing table ${tableName} from schema for API ${apiId} for user ${userId}`);
    
    // Check if there are pending changes
    if (!this.pendingChanges.has(apiId)) {
      return res.status(400).json({
        error: 'No pending changes found'
      });
    }
    
    // Get pending changes
    const pendingChanges = this.pendingChanges.get(apiId);
    
    // Filter out the table
    pendingChanges.tables = pendingChanges.tables.filter(t => t.name !== tableName);
    
    res.json({
      message: 'Table removed from schema',
      apiId,
      tableName,
      pendingChanges
    });
  }
}

module.exports = new SchemaController(); 