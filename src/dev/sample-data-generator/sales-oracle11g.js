const oracledb = require("oracledb");
const { faker } = require("@faker-js/faker");

// Initialize Oracle Client
oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_11_2" });

// Connection configuration
const CONNECTION_CONFIG = {
  connectString: "(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = kaz-realkaz.infoenergo.loc)(PORT = 1521)) (CONNECT_DATA = (SID = realkazn) (server = dedicated)))",
  user: "asuse",
  password: "kl0pik"
};

// Table prefix
const TABLE_PREFIX = "test_bav_smpl";

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

// Helper function to execute DDL with error handling
async function executeDDL(connection, sql) {
  try {
    await connection.execute(sql, {}, { autoCommit: true });
  } catch (error) {
    // Ignore errors for "object does not exist" cases
    if (error.errorNum !== 942 && error.errorNum !== 2289 && error.errorNum !== 4043) {
      throw error;
    }
  }
}

async function setupDatabase() {
  let connection;
  try {
    connection = await oracledb.getConnection(CONNECTION_CONFIG);

    // Drop tables if they exist (using PL/SQL block)
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ${TABLE_PREFIX}_sales';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ${TABLE_PREFIX}_product';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ${TABLE_PREFIX}_customer';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);

    // Drop sequences if they exist
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP SEQUENCE ${TABLE_PREFIX}_customer_seq';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP SEQUENCE ${TABLE_PREFIX}_product_seq';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP SEQUENCE ${TABLE_PREFIX}_sales_seq';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);

    // Drop triggers if they exist
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TRIGGER ${TABLE_PREFIX}_customer_trg';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TRIGGER ${TABLE_PREFIX}_product_trg';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);
    
    await executeDDL(connection, `
      BEGIN
        EXECUTE IMMEDIATE 'DROP TRIGGER ${TABLE_PREFIX}_sales_trg';
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    `);

    // Create sequences
    await connection.execute(`CREATE SEQUENCE ${TABLE_PREFIX}_customer_seq START WITH 1 INCREMENT BY 1`, {}, { autoCommit: true });
    await connection.execute(`CREATE SEQUENCE ${TABLE_PREFIX}_product_seq START WITH 1 INCREMENT BY 1`, {}, { autoCommit: true });
    await connection.execute(`CREATE SEQUENCE ${TABLE_PREFIX}_sales_seq START WITH 1 INCREMENT BY 1`, {}, { autoCommit: true });

    // Create tables
    await connection.execute(`
      CREATE TABLE ${TABLE_PREFIX}_customer (
        customer_id NUMBER PRIMARY KEY,
        name VARCHAR2(4000),
        phone VARCHAR2(4000),
        registration_date DATE
      )
    `, {}, { autoCommit: true });

    await connection.execute(`
      CREATE TABLE ${TABLE_PREFIX}_product (
        product_id NUMBER PRIMARY KEY,
        name VARCHAR2(4000),
        category VARCHAR2(4000)
      )
    `, {}, { autoCommit: true });

    await connection.execute(`
      CREATE TABLE ${TABLE_PREFIX}_sales (
        sale_id NUMBER PRIMARY KEY,
        customer_id NUMBER,
        product_id NUMBER,
        sale_date TIMESTAMP,
        price NUMBER(18,2),
        quantity NUMBER,
        amount NUMBER(18,2),
        payment_method VARCHAR2(4000),
        status VARCHAR2(4000),
        is_refunded NUMBER(1)
      )
    `, {}, { autoCommit: true });

    // Create triggers for auto-increment
    await connection.execute(`
      CREATE OR REPLACE TRIGGER ${TABLE_PREFIX}_customer_trg
      BEFORE INSERT ON ${TABLE_PREFIX}_customer
      FOR EACH ROW
      BEGIN
        IF :NEW.customer_id IS NULL THEN
          SELECT ${TABLE_PREFIX}_customer_seq.NEXTVAL INTO :NEW.customer_id FROM DUAL;
        END IF;
      END;
    `, {}, { autoCommit: true });

    await connection.execute(`
      CREATE OR REPLACE TRIGGER ${TABLE_PREFIX}_product_trg
      BEFORE INSERT ON ${TABLE_PREFIX}_product
      FOR EACH ROW
      BEGIN
        IF :NEW.product_id IS NULL THEN
          SELECT ${TABLE_PREFIX}_product_seq.NEXTVAL INTO :NEW.product_id FROM DUAL;
        END IF;
      END;
    `, {}, { autoCommit: true });

    await connection.execute(`
      CREATE OR REPLACE TRIGGER ${TABLE_PREFIX}_sales_trg
      BEFORE INSERT ON ${TABLE_PREFIX}_sales
      FOR EACH ROW
      BEGIN
        IF :NEW.sale_id IS NULL THEN
          SELECT ${TABLE_PREFIX}_sales_seq.NEXTVAL INTO :NEW.sale_id FROM DUAL;
        END IF;
      END;
    `, {}, { autoCommit: true });

    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error setting up database:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function populateCustomers() {
  let connection;
  try {
    connection = await oracledb.getConnection(CONNECTION_CONFIG);

    const customers = Array.from({ length: COUNTS.CUSTOMERS }, () => ({
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      registration_date: faker.date.past(2)
    }));

    // Use executeMany for batch insert
    await connection.executeMany(
      `INSERT INTO ${TABLE_PREFIX}_customer (name, phone, registration_date) VALUES (:1, :2, :3)`,
      customers.map(c => [c.name, c.phone, c.registration_date]),
      { autoCommit: true }
    );

    console.log(`Inserted ${COUNTS.CUSTOMERS} customers`);
  } catch (error) {
    console.error("Error populating customers:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function populateProducts() {
  let connection;
  try {
    connection = await oracledb.getConnection(CONNECTION_CONFIG);

    const products = Array.from({ length: COUNTS.PRODUCTS }, () => ({
      name: faker.commerce.productName(),
      category: faker.helpers.arrayElement(PRODUCT_CATEGORIES)
    }));

    // Use executeMany for batch insert
    await connection.executeMany(
      `INSERT INTO ${TABLE_PREFIX}_product (name, category) VALUES (:1, :2)`,
      products.map(p => [p.name, p.category]),
      { autoCommit: true }
    );

    console.log(`Inserted ${COUNTS.PRODUCTS} products`);
  } catch (error) {
    console.error("Error populating products:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function populateSales() {
  let connection;
  try {
    connection = await oracledb.getConnection(CONNECTION_CONFIG);

    // Get customer and product IDs
    const customerResult = await connection.execute(`SELECT customer_id FROM ${TABLE_PREFIX}_customer`);
    const customerIds = customerResult.rows.map(r => r[0]);
    
    const productResult = await connection.execute(`SELECT product_id FROM ${TABLE_PREFIX}_product`);
    const productIds = productResult.rows.map(r => r[0]);

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
          isRefunded ? 1 : 0
        ]);
      }

      // Use executeMany for batch insert
      await connection.executeMany(
        `INSERT INTO ${TABLE_PREFIX}_sales (
          customer_id, product_id, sale_date, price, quantity, amount,
          payment_method, status, is_refunded
        ) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)`,
        salesBatch,
        { autoCommit: true }
      );

      const insertedSoFar = (batch + 1) * COUNTS.SALES_BATCH_SIZE;
      console.log(`Inserted ${Math.min(insertedSoFar, COUNTS.SALES)}/${COUNTS.SALES} sales`);
    }

    console.log(`Inserted ${COUNTS.SALES} sales total`);
  } catch (error) {
    console.error("Error populating sales:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
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
  }
}

main();
