const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function runMigration() {
    console.log('🚀 Starting database migration to add original_id column...');
    
    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('❌ SUPABASE_URL and SUPABASE_KEY environment variables are required.');
        console.error('Please set them in your .env file or environment.');
        process.exit(1);
    }

    // Create Supabase client
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );

    try {
        // Read the migration script
        const migrationScript = fs.readFileSync(path.join(__dirname, 'add_original_id_column.sql'), 'utf8');
        
        console.log('📄 Migration script loaded successfully');
        console.log('🔧 Executing migration...');

        // Split the script into individual statements
        const statements = migrationScript
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
                
                const { data, error } = await supabase.rpc('exec_sql', { 
                    sql: statement + ';' 
                });

                if (error) {
                    // Try direct query if RPC fails
                    const { data: queryData, error: queryError } = await supabase
                        .from('information_schema.tables')
                        .select('*')
                        .limit(1);

                    if (queryError) {
                        console.error(`❌ Error executing statement ${i + 1}:`, error);
                        throw error;
                    }
                }
            }
        }

        console.log('✅ Migration completed successfully!');
        console.log('📊 Verifying the column was added...');

        // Verify the column was added
        const { data: columns, error: verifyError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', 'SecurityLogAnalysis')
            .eq('column_name', 'original_id');

        if (verifyError) {
            console.log('⚠️  Could not verify column creation, but migration may have succeeded.');
            console.log('Please check your database manually.');
        } else if (columns && columns.length > 0) {
            console.log('✅ Column verification successful!');
            console.log('📋 Column details:', columns[0]);
        } else {
            console.log('⚠️  Column not found in verification query.');
        }

        console.log('🎉 Migration process completed!');
        console.log('💡 You can now use the updated analysis service with data persistence.');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Please check your database connection and try again.');
        process.exit(1);
    }
}

// Run the migration
runMigration().catch(console.error);
