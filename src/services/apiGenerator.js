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
    const schemaName = `user_${userId}`;
    const router = express.Router();

    // Initialize in-memory databases for each table
    tableSchemas.forEach(schema => {
      this.inMemoryDb.set(schema.name, []);
    });

    // Add documentation endpoint
    router.get('/', (req, res) => {
      const endpoints = tableSchemas.map(schema => {
        return {
          table: schema.name,
          endpoints: [
            { method: 'GET', path: `/${schema.name}`, description: 'Get all records with pagination and filtering' },
            { method: 'GET', path: `/${schema.name}/:id`, description: 'Get record by ID' },
            { method: 'POST', path: `/${schema.name}`, description: 'Create new record' },
            { method: 'PUT', path: `/${schema.name}/:id`, description: 'Update record' },
            { method: 'DELETE', path: `/${schema.name}/:id`, description: 'Delete record' }
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
        tables: tableSchemas.map(t => t.name),
        schema: schemaName,
        endpoints
      });
    });

    // Generate endpoints for each table, using schema-qualified table names
    tableSchemas.forEach(schema => {
      const tableName = schema.name;
      const qualifiedTableName = `${schemaName}.${tableName}`;

      // GET all items with pagination and filtering
      router.get(`/${tableName}`, async (req, res) => {
        try {
          const { page = 1, limit = 10, sort, order = 'asc', ...filters } = req.query;
          const offset = (parseInt(page) - 1) * parseInt(limit);
          
          // Try Supabase first
          const { data, error, count } = await this.supabase
            .from(qualifiedTableName)
            .select('*', { count: 'exact' })
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
          const inMemoryData = this.inMemoryDb.get(tableName) || [];
          
          // Apply filters
          let filteredData = [...inMemoryData];
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

      // GET item by id
      router.get(`/${tableName}/:id`, async (req, res) => {
        try {
          // Try Supabase first
          const { data, error } = await this.supabase
            .from(qualifiedTableName)
            .select('*')
            .eq('id', req.params.id)
            .single();
          
          // If Supabase table exists and record found, return it
          if (!error && data) {
            return res.json({
              ...data,
              source: 'supabase'
            });
          }
          
          // If Supabase failed, check in-memory
          const inMemoryData = this.inMemoryDb.get(tableName) || [];
          const item = inMemoryData.find(item => item.id === req.params.id);
          
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

      // POST new item
      router.post(`/${tableName}`, async (req, res) => {
        try {
          // Try Supabase first
          const { data, error } = await this.supabase
            .from(qualifiedTableName)
            .insert(req.body)
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
            ...req.body,
            id: `${tableName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const inMemoryData = this.inMemoryDb.get(tableName) || [];
          inMemoryData.push(newItem);
          this.inMemoryDb.set(tableName, inMemoryData);
          
          res.status(201).json({
            ...newItem,
            source: 'memory'
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // PUT/UPDATE item
      router.put(`/${tableName}/:id`, async (req, res) => {
        try {
          // Try Supabase first
          const { data, error } = await this.supabase
            .from(qualifiedTableName)
            .update(req.body)
            .eq('id', req.params.id)
            .select();
          
          // If Supabase table exists and record updated, return it
          if (!error && data && data.length > 0) {
            return res.json({
              ...data[0],
              source: 'supabase'
            });
          }
          
          // If Supabase failed, use in-memory
          const inMemoryData = this.inMemoryDb.get(tableName) || [];
          const index = inMemoryData.findIndex(item => item.id === req.params.id);
          
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
          this.inMemoryDb.set(tableName, inMemoryData);
          
          res.json({
            ...updatedItem,
            source: 'memory'
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // DELETE item
      router.delete(`/${tableName}/:id`, async (req, res) => {
        try {
          // Try Supabase first
          const { error } = await this.supabase
            .from(qualifiedTableName)
            .delete()
            .eq('id', req.params.id);
          
          // If Supabase table exists and no error, success
          if (!error) {
            return res.status(204).send();
          }
          
          // If Supabase failed, use in-memory
          const inMemoryData = this.inMemoryDb.get(tableName) || [];
          const index = inMemoryData.findIndex(item => item.id === req.params.id);
          
          if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
          }
          
          inMemoryData.splice(index, 1);
          this.inMemoryDb.set(tableName, inMemoryData);
          
          res.status(204).send();
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    });

    return router;
  }
}

module.exports = new APIGenerator(); 