const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
const CONNECTION_STRING = "postgresql://admin:admin@localhost:5432/postgres";

// Configuration - all counts defined at the top
const COUNTS = {
  CUSTOMERS: 200,
  PRODUCTS: 50,
  SALES: 10000,
  SALES_BATCH_SIZE: 1000
};

const PRODUCT_CATEGORIES = ["Electronics", "Clothing", "Home", "Books", "Sports"];
const PAYMENT_METHODS = ["Credit Card", "Debit Card", "Cash", "PayPal"];
const ORDER_STATUSES = ["Pending", "Completed", "Cancelled"];

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    // Create schema if not exists
    await client.query("CREATE SCHEMA IF NOT EXISTS smpl");

    // Drop tables if they exist
    await client.query("DROP TABLE IF EXISTS smpl.sales");
    await client.query("DROP TABLE IF EXISTS smpl.products");
    await client.query("DROP TABLE IF EXISTS smpl.customer");

    // Create tables
    await client.query(`
      CREATE TABLE smpl.customer (
        customer_id SERIAL PRIMARY KEY,
        name TEXT,
        phone TEXT,
        registration_date DATE
      )
    `);

    await client.query(`
      CREATE TABLE smpl.products (
        product_id SERIAL PRIMARY KEY,
        name TEXT,
        category TEXT
      )
    `);

    await client.query(`
      CREATE TABLE smpl.sales (
        sale_id SERIAL PRIMARY KEY,
        customer_id INT,
        product_id INT,
        sale_date TIMESTAMP,
        price DECIMAL,
        quantity INT,
        amount DECIMAL,
        payment_method TEXT,
        status TEXT,
        is_refunded BOOLEAN
      )
    `);

    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error setting up database:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function populateCustomers() {
  const client = await pool.connect();
  try {
    const customers = Array.from({ length: COUNTS.CUSTOMERS }, () => [
      faker.person.fullName(),
      faker.phone.number(),
      faker.date.past(2),
    ]);

    // Insert customers one by one (simple but slower)
    for (const customer of customers) {
      await client.query(
        "INSERT INTO smpl.customer (name, phone, registration_date) VALUES ($1, $2, $3)",
        customer
      );
    }

    console.log(`Inserted ${COUNTS.CUSTOMERS} customers`);
  } catch (error) {
    console.error("Error populating customers:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function populateProducts() {
  const client = await pool.connect();
  try {
    const products = Array.from({ length: COUNTS.PRODUCTS }, () => [
      faker.commerce.productName(),
      faker.helpers.arrayElement(PRODUCT_CATEGORIES),
    ]);

    // Insert products one by one
    for (const product of products) {
      await client.query(
        "INSERT INTO smpl.products (name, category) VALUES ($1, $2)",
        product
      );
    }

    console.log(`Inserted ${COUNTS.PRODUCTS} products`);
  } catch (error) {
    console.error("Error populating products:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function populateSales() {
  const client = await pool.connect();
  try {
    const customerIds = (await client.query("SELECT customer_id FROM smpl.customer")).rows.map(r => r.customer_id);
    const productIds = (await client.query("SELECT product_id FROM smpl.products")).rows.map(r => r.product_id);

    const totalBatches = Math.ceil(COUNTS.SALES / COUNTS.SALES_BATCH_SIZE);

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchSize = Math.min(COUNTS.SALES_BATCH_SIZE, COUNTS.SALES - (batch * COUNTS.SALES_BATCH_SIZE));
      const salesBatch = [];

      for (let i = 0; i < batchSize; i++) {
        const price = faker.number.float({ min: 5, max: 1000, precision: 0.01 });
        const quantity = faker.number.int({ min: 1, max: 10 });
        const isRefunded = faker.datatype.boolean({ probability: 0.1 });

        salesBatch.push([
          faker.helpers.arrayElement(customerIds),
          faker.helpers.arrayElement(productIds),
          faker.date.between({ from: '2022-01-01', to: new Date() }),
          price,
          quantity,
          price * quantity,
          faker.helpers.arrayElement(PAYMENT_METHODS),
          isRefunded ? 'Cancelled' : faker.helpers.arrayElement(ORDER_STATUSES),
          isRefunded
        ]);
      }

      // Generate placeholders for the batch
      const valuePlaceholders = salesBatch.map(
        (_, i) => `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})`
      ).join(', ');

      await client.query(
        `INSERT INTO smpl.sales (
          customer_id, product_id, sale_date, price, quantity, amount,
          payment_method, status, is_refunded
        ) VALUES ${valuePlaceholders}`,
        salesBatch.flat()
      );

      const insertedSoFar = (batch + 1) * COUNTS.SALES_BATCH_SIZE;
      console.log(`Inserted ${Math.min(insertedSoFar, COUNTS.SALES)}/${COUNTS.SALES} sales`);
    }

    console.log(`Inserted ${COUNTS.SALES} sales total`);
  } catch (error) {
    console.error("Error populating sales:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await setupDatabase();
    await populateCustomers();
    await populateProducts();
    await populateSales();
    console.log("Database population completed successfully");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();