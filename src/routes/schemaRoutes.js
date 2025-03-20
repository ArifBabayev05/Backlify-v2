const express = require('express');
const router = express.Router();
const schemaController = require('../controllers/schemaController');

// Get schema for an API
router.get('/api/:apiId/schema', schemaController.getSchema.bind(schemaController));

// Update entire schema (all tables) for an API
router.put('/api/:apiId/schema', schemaController.updateSchema.bind(schemaController));

// Apply pending schema changes to database
router.post('/api/:apiId/schema/apply', schemaController.applySchemaChanges.bind(schemaController));

// Get pending schema changes
router.get('/api/:apiId/schema/pending', schemaController.getPendingChanges.bind(schemaController));

// Cancel pending schema changes
router.delete('/api/:apiId/schema/pending', schemaController.cancelPendingChanges.bind(schemaController));

// Add a new table to schema
router.post('/api/:apiId/schema/tables', schemaController.addTable.bind(schemaController));

// Update a specific table in schema
router.put('/api/:apiId/schema/tables/:tableName', schemaController.updateTable.bind(schemaController));

// Remove a table from schema
router.delete('/api/:apiId/schema/tables/:tableName', schemaController.removeTable.bind(schemaController));

module.exports = router; 