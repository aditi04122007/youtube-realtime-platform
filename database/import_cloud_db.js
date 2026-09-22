const fs = require('fs');
const path = require('path');

// Resilient mysql2 loader resolving from backend/node_modules if needed
let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  try {
    mysql = require(path.resolve(__dirname, '../backend/node_modules/mysql2/promise'));
  } catch (err2) {
    console.error('[Error] mysql2 is required. Run: cd backend && npm install');
    process.exit(1);
  }
}

/**
 * Cloud Database Migration Script
 * Imports database/schema.sql and database/seed.sql to create all 41 tables with SSL.
 *
 * Usage:
 *   node database/import_cloud_db.js --host=<host> --port=4000 --user=<user> --password=<pass> --database=video_platform
 *
 * Or set environment variables:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
async function runMigration() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const prefix = `--${name}=`;
    const arg = args.find((a) => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
  };

  const host = getArg('host') || process.env.DB_HOST;
  const port = Number(getArg('port') || process.env.DB_PORT || 4000);
  const user = getArg('user') || process.env.DB_USER || 'root';
  const password = getArg('password') || process.env.DB_PASSWORD || '';
  const database = getArg('database') || process.env.DB_NAME || 'video_platform';
  const dbUrl = getArg('url') || process.env.DATABASE_URL;

  if (!host && !dbUrl) {
    console.error(`
[Error] Missing database connection parameters!

Please provide your cloud database details:
  node database/import_cloud_db.js --host=<host> --port=<port> --user=<user> --password=<password> --database=<dbname>

Example for TiDB Cloud:
  node database/import_cloud_db.js --host=gateway01.ap-southeast-1.prod.aws.tidbcloud.com --port=4000 --user=2xxxxx.root --password=YOUR_PASSWORD --database=video_platform
`);
    process.exit(1);
  }

  console.log('================================================================');
  console.log('  Cloud MySQL 8+ Database Initialization');
  console.log('================================================================');
  console.log(`Connecting to: ${host || 'DATABASE_URL'}:${port} (User: ${user})`);
  console.log(`Target database: ${database}`);

  let connection;
  try {
    const connectionConfig = dbUrl
      ? { uri: dbUrl, multipleStatements: true, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }
      : {
          host,
          port,
          user,
          password,
          multipleStatements: true,
          ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        };

    connection = await mysql.createConnection(connectionConfig);
    console.log('[1/4] Connected to database server successfully with SSL (TLSv1.2).');

    // 1. Create database if it does not exist
    console.log(`[2/4] Ensuring database '${database}' exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.query(`USE \`${database}\`;`);

    // 2. Read and execute schema.sql
    console.log('[3/4] Executing database/schema.sql (Creating all 41 tables)...');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('      schema.sql executed successfully.');

    // 3. Read and execute seed.sql
    console.log('[4/4] Executing database/seed.sql (Populating default categories & subscription plans)...');
    const seedPath = path.resolve(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seedSql);
      console.log('      seed.sql executed successfully.');
    }

    // 4. Verify created tables
    const [tables] = await connection.query('SHOW TABLES;');
    const tableKey = Object.keys(tables[0] || {})[0];
    const tableNames = tables.map((t) => t[tableKey]);

    console.log('================================================================');
    console.log(`SUCCESS! Created ${tableNames.length} tables in database '${database}':`);
    console.log('================================================================');
    tableNames.forEach((name, idx) => {
      console.log(`  ${String(idx + 1).padStart(2, ' ')}. ${name}`);
    });

    console.log('\nYour cloud database is 100% ready for production deployment!');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n[Database Error] Initialization failed:');
    console.error(error.message);
    if (connection) await connection.end().catch(() => {});
    process.exit(1);
  }
}

runMigration();
