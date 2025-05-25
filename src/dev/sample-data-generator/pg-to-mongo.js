const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const Cursor = require('pg-cursor');

// Main function to transfer data from PostgreSQL to MongoDB
async function transferDataFromPgToMongo({
  sqlText,
  targetCollectionName,
  pgConnectionString = 'postgresql://admin:admin@localhost:5432/postgres',
  mongoConnectionString = 'mongodb://localhost:27017',
  mongoDbName = 'reports_tmp', // Default database name
  batchSize = 1000 // Number of documents to insert at once
}) {
  let pgClient;
  let mongoClient;
  let mongoCollection;

  try {
    // Connect to PostgreSQL
    console.log('Connecting to PostgreSQL...');
    pgClient = new Client({
      connectionString: pgConnectionString
    });
    await pgClient.connect();

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    mongoClient = new MongoClient(mongoConnectionString);
    await mongoClient.connect();
    const db = mongoClient.db(mongoDbName);
    mongoCollection = db.collection(targetCollectionName);

    // Clear the target collection if it exists
    console.log(`Preparing MongoDB collection ${targetCollectionName}...`);
    const collections = await db.listCollections({ name: targetCollectionName }).toArray();
    if (collections.length > 0) {
      console.log(`Clearing existing collection ${targetCollectionName}...`);
      await mongoCollection.deleteMany({});
    }

    // Create a cursor for PostgreSQL query
    console.log(`Executing SQL query: ${sqlText}`);
    const cursor = pgClient.query(new Cursor(sqlText));

    // Counter for batch processing
    let docCount = 0;
    let batch = [];

    // Process rows in batches
    console.log('Starting data transfer...');
    const processRows = async () => {
      while (true) {
        const rows = await cursor.read(batchSize);
        if (rows.length === 0) break; // No more rows to process

        batch = rows;
        docCount += rows.length;

        try {
          await mongoCollection.insertMany(batch);
          console.log(`Inserted ${batch.length} documents (total: ${docCount})`);
          batch = [];
        } catch (err) {
          console.error('Error inserting batch:', err);
        }
      }
    };

    // Execute the processing and handle completion
    await processRows();

    // Handle any remaining documents
    if (batch.length > 0) {
      try {
        await mongoCollection.insertMany(batch);
        console.log(`Inserted final batch of ${batch.length} documents (total: ${docCount})`);
      } catch (err) {
        console.error('Error inserting final batch:', err);
      }
    }

    console.log('Data transfer completed successfully!');
    console.log(`Total documents transferred: ${docCount}`);

    // Close connections
    await cursor.close();
    await pgClient.end();
    await mongoClient.close();

  } catch (err) {
    console.error('Initialization error:', err);
    if (pgClient) {
      await pgClient.end();
    }
    if (mongoClient) {
      await mongoClient.close();
    }
    throw err;
  }
}

// Example usage
(async () => {
  try {
    await transferDataFromPgToMongo({
      sqlText: `SELECT
        s.sale_id,
        p.category as product_category,
        p.name as product_name,
        c.name as customer_name,
        s.sale_date,
        s.price::float,
        s.quantity,
        s.amount::float,
        s.payment_method,
        s.status,
        s.is_refunded
      FROM
        smpl.sales s
      JOIN smpl.customer c ON
        c.customer_id = s.customer_id
      JOIN smpl.product p ON
        p.product_id = s.product_id`,
      targetCollectionName: 'sales',
    });
  } catch (err) {
    console.error('Transfer failed:', err);
    process.exit(1);
  }
})();