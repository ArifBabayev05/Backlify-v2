const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');
const schemaGenerator = require('./schemaGenerator');

class APIGenerator {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    // In-memory database for tables that don't exist in Supabase
    this.inMemoryDb = new Map();
  }

  generateEndpoints(tableSchemas, userId = 'default') {
    const router = express.Router();

    // Initialize in-memory databases for each table with prefixed names
    tableSchemas.forEach(schema => {
      this.inMemoryDb.set(schema.prefixedName || schema.name, []);
    });

    // Add documentation endpoint
    router.get('/', (req, res) => {
      const endpoints = tableSchemas.map(schema => {
        const tableName = schema.originalName || schema.name;
        return {
          table: tableName,
          endpoints: [
            { method: 'GET', path: `/${tableName}`, description: 'Get all records with pagination and filtering' },
            { method: 'GET', path: `/${tableName}/:id`, description: 'Get record by ID' },
            { method: 'POST', path: `/${tableName}`, description: 'Create new record' },
            { method: 'PUT', path: `/${tableName}/:id`, description: 'Update record' },
            { method: 'DELETE', path: `/${tableName}/:id`, description: 'Delete record' }
          ],
          schema: {
            columns: schema.columns.map(col => ({
              name: col.name,
              type: col.type,
              constraints: col.constraints
            }))
          }
        };
      });

      res.json({
        api: 'Dynamically Generated API',
        tables: tableSchemas.map(t => t.originalName || t.name),
        userId: userId,
        endpoints
      });
    });

    // Generate endpoints for each table
    tableSchemas.forEach(schema => {
      const tableName = schema.originalName || schema.name;
      const prefixedTableName = schema.prefixedName || `${userId}_${tableName}`;

      // GET all items with pagination and filtering - filter by userId
      router.get(`/${tableName}`, async (req, res) => {
        try {
          const { page = 1, limit = 10, sort, order = 'asc', ...filters } = req.query;
          const offset = (parseInt(page) - 1) * parseInt(limit);
          
          // Try Supabase first
          const { data, error, count } = await this.supabase
            .from(prefixedTableName)
            .select('*', { count: 'exact' })
            .eq('user_id', userId) // Filter by userId
            .range(offset, offset + parseInt(limit) - 1);
          
          // If Supabase table exists, use it
          if (!error) {
            return res.json({
              data,
              source: 'supabase',
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0
              }
            });
          }
          
          // If Supabase table doesn't exist, use in-memory data
          const inMemoryData = this.inMemoryDb.get(prefixedTableName) || [];
          
          // Filter by userId first
          let filteredData = inMemoryData.filter(item => item.user_id === userId);
          
          // Apply additional filters
          Object.entries(filters).forEach(([key, value]) => {
            filteredData = filteredData.filter(item => 
              item[key] && item[key].toString() === value);
          });
          
          // Apply sorting
          if (sort) {
            filteredData.sort((a, b) => {
              if (a[sort] < b[sort]) return order === 'asc' ? -1 : 1;
              if (a[sort] > b[sort]) return order === 'asc' ? 1 : -1;
              return 0;
            });
          }
          
          // Apply pagination
          const paginatedData = filteredData.slice(offset, offset + parseInt(limit));
          
          res.json({
            data: paginatedData,
            source: 'memory',
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: filteredData.length
            }
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // GET item by id - ensure it belongs to current userId
      router.get(`/${tableName}/:id`, async (req, res) => {
        try {
          // Try Supabase first
          const { data, error } = await this.supabase
            .from(prefixedTableName)
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', userId) // Ensure record belongs to current user
            .single();
          
          // If Supabase table exists and record found, return it
          if (!error && data) {
            return res.json({
              ...data,
              source: 'supabase'
            });
          }
          
          // If Supabase failed, check in-memory
          const inMemoryData = this.inMemoryDb.get(prefixedTableName) || [];
          const item = inMemoryData.find(item => item.id === req.params.id && item.user_id === userId);
          
          if (!item) {
            return res.status(404).json({ error: 'Not found' });
          }
          
          res.json({
            ...item,
            source: 'memory'
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // POST new item - automatically include userId
      router.post(`/${tableName}`, async (req, res) => {
        try {
          // Add userId to the request body
          const requestWithUserId = {
            ...req.body,
            user_id: userId
          };
          
          // Try Supabase first
          const { data, error } = await this.supabase
            .from(prefixedTableName)
            .insert(requestWithUserId)
            .select();
          
          // If Supabase table exists, use it
          if (!error) {
            return res.status(201).json({
              ...data[0],
              source: 'supabase'
            });
          }
          
          // If Supabase failed, use in-memory
          const newItem = {
            ...requestWithUserId,
            id: `${tableName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const inMemoryData = this.inMemoryDb.get(prefixedTableName) || [];
          inMemoryData.push(newItem);
          this.inMemoryDb.set(prefixedTableName, inMemoryData);
          
          res.status(201).json({
            ...newItem,
            source: 'memory'
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // PUT/UPDATE item - ensure it belongs to current userId
      router.put(`/${tableName}/:id`, async (req, res) => {
        try {
          // First check if record belongs to this user
          const { data: checkData, error: checkError } = await this.supabase
            .from(prefixedTableName)
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', userId)
            .single();
          
          if (checkError || !checkData) {
            return res.status(404).json({ error: 'Record not found or not authorized' });
          }
          
          // Record belongs to user, proceed with update
          const { data, error } = await this.supabase
            .from(prefixedTableName)
            .update(req.body)
            .eq('id', req.params.id)
            .eq('user_id', userId) // Ensure we only update user's own record
            .select();
          
          // If Supabase table exists and record updated, return it
          if (!error && data && data.length > 0) {
            return res.json({
              ...data[0],
              source: 'supabase'
            });
          }
          
          // If Supabase failed, use in-memory
          const inMemoryData = this.inMemoryDb.get(prefixedTableName) || [];
          const index = inMemoryData.findIndex(item => item.id === req.params.id && item.user_id === userId);
          
          if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
          }
          
          const updatedItem = {
            ...inMemoryData[index],
            ...req.body,
            id: req.params.id, // Ensure ID doesn't change
            updated_at: new Date().toISOString()
          };
          
          inMemoryData[index] = updatedItem;
          this.inMemoryDb.set(prefixedTableName, inMemoryData);
          
          res.json({
            ...updatedItem,
            source: 'memory'
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // DELETE item - ensure it belongs to current userId
      router.delete(`/${tableName}/:id`, async (req, res) => {
        try {
          // Try Supabase first
          const { error } = await this.supabase
            .from(prefixedTableName)
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', userId); // Ensure we only delete user's own record
          
          // If Supabase table exists and no error, success
          if (!error) {
            return res.status(204).send();
          }
          
          // If Supabase failed, use in-memory
          const inMemoryData = this.inMemoryDb.get(prefixedTableName) || [];
          const index = inMemoryData.findIndex(item => item.id === req.params.id && item.user_id === userId);
          
          if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
          }
          
          inMemoryData.splice(index, 1);
          this.inMemoryDb.set(prefixedTableName, inMemoryData);
          
          res.status(204).send();
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    });

    // Add Swagger UI endpoint
    router.get('/swagger', (req, res) => {
      const swaggerSpec = this._generateSwaggerSpec(tableSchemas, userId);
      res.json(swaggerSpec);
    });

    return router;
  }

  // Add method to generate Swagger spec
  _generateSwaggerSpec(tableSchemas, userId) {
    const paths = {};
    
    // For each table, create swagger paths
    tableSchemas.forEach(schema => {
      const tableName = schema.originalName || schema.name;
      
      // GET collection path
      paths[`/${tableName}`] = {
        get: {
          tags: [tableName],
          summary: `Get all ${tableName} records`,
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: { type: 'integer', default: 1 }
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: { type: 'integer', default: 10 }
            },
            {
              name: 'sort',
              in: 'query',
              description: 'Field to sort by',
              schema: { type: 'string' }
            },
            {
              name: 'order',
              in: 'query',
              description: 'Sort order (asc or desc)',
              schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
            }
          ],
          responses: {
            '200': { description: 'Successful operation' }
          }
        },
        post: {
          tags: [tableName],
          summary: `Create a new ${tableName} record`,
          requestBody: {
            content: {
              'application/json': {
                schema: { 
                  $ref: `#/components/schemas/${tableName}` 
                }
              }
            }
          },
          responses: {
            '201': { description: 'Record created successfully' }
          }
        }
      };
      
      // GET/PUT/DELETE item path
      paths[`/${tableName}/{id}`] = {
        get: {
          tags: [tableName],
          summary: `Get a ${tableName} record by ID`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { description: 'Successful operation' },
            '404': { description: 'Record not found' }
          }
        },
        put: {
          tags: [tableName],
          summary: `Update a ${tableName} record`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: { 
                  $ref: `#/components/schemas/${tableName}` 
                }
              }
            }
          },
          responses: {
            '200': { description: 'Record updated successfully' },
            '404': { description: 'Record not found' }
          }
        },
        delete: {
          tags: [tableName],
          summary: `Delete a ${tableName} record`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '204': { description: 'Record deleted successfully' },
            '404': { description: 'Record not found' }
          }
        }
      };
    });
    
    // Generate schema components from table schemas
    const schemas = {};
    tableSchemas.forEach(schema => {
      const tableName = schema.originalName || schema.name;
      
      const properties = {};
      schema.columns.forEach(col => {
        let type = 'string';
        if (col.type.includes('int')) type = 'integer';
        else if (col.type.includes('float') || col.type.includes('decimal')) type = 'number';
        else if (col.type.includes('bool')) type = 'boolean';
        
        properties[col.name] = { type };
      });
      
      schemas[tableName] = {
        type: 'object',
        properties
      };
    });
    
    return {
      openapi: '3.0.0',
      info: {
        title: `API for User ${userId}`,
        version: '1.0.0',
        description: 'API generated by Backlify'
      },
      servers: [
        {
          url: '/api'
        }
      ],
      paths,
      components: {
        schemas
      }
    };
  }
}

module.exports = new APIGenerator(); 