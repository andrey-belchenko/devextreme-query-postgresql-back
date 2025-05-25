const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");

// Category generation parameters
const TOTAL_CATEGORIES = 10000;
const TOP_LEVEL_CATEGORIES = 100;
const MAX_DEPTH = 3; // Maximum hierarchy depth
const BATCH_SIZE = 1000; // Number of rows per batch insert
const CONNECTION_STRING = "postgresql://admin:admin@localhost:5432/postgres";

// Database configuration using connection string
const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

// Set to track used category names
const usedCategoryNames = new Set();

// Helper function to generate a unique category name
function generateCategoryName() {
  return faker.lorem.slug();
}

// Helper function to generate a random description
function generateDescription() {
  return faker.lorem.sentence({ min: 10, max: 20 });
}

// Helper function to generate a random date within the last 5 years
function generateRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 5);
  return faker.date.between({ from: start, to: new Date() }).toISOString();
}

// Function to set up the category table
async function setupTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop table if exists
    await client.query('DROP TABLE IF EXISTS category CASCADE');
    
    // Create table with hierarchy_code
    await client.query(`
      CREATE TABLE category (
        category_id SERIAL PRIMARY KEY,
        category_name TEXT,
        description TEXT,
        parent_category_id INTEGER,
        is_active BOOLEAN,
        display_order INTEGER,
        created_at TIMESTAMP,
        hierarchy_code TEXT
      )
    `);
    
    await client.query('COMMIT');
    console.log('Category table dropped and recreated successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error setting up table:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

// Function to generate category data
async function generateCategories() {
  let categories = [];
  let currentId = 1;
  const topLevelCounters = {}; // Track top-level category indices
  const childCounters = {}; // Track child indices per parent

  // Step 1: Generate top-level categories
  for (let i = 0; i < TOP_LEVEL_CATEGORIES; i++) {
    const hierarchyCode = `${i + 1}`;
    topLevelCounters[hierarchyCode] = 0; // Initialize child counter
    categories.push({
      category_id: currentId++,
      category_name: generateCategoryName(),
      description: generateDescription(),
      parent_category_id: null,
      is_active: faker.datatype.boolean(),
      display_order: faker.number.int({ min: 1, max: 100 }),
      created_at: generateRandomDate(),
      hierarchy_code: hierarchyCode
    });
  }

  // Step 2: Generate subcategories
  while (categories.length < TOTAL_CATEGORIES) {
    const newCategories = [];
    // Use all categories as potential parents
    const parentCandidates = categories;

    for (const parent of parentCandidates) {
      // Randomly decide how many subcategories (0–20 per parent)
      const numSubcategories = faker.number.int({ min: 0, max: 20 });
      for (let i = 0; i < numSubcategories && categories.length + newCategories.length < TOTAL_CATEGORIES; i++) {
        // Compute hierarchy code
        childCounters[parent.category_id] = (childCounters[parent.category_id] || 0) + 1;
        const hierarchyCode = parent.hierarchy_code 
          ? `${parent.hierarchy_code}.${childCounters[parent.category_id]}`
          : `${childCounters[parent.category_id]}`; // Fallback for top-level

        newCategories.push({
          category_id: currentId++,
          category_name: generateCategoryName(),
          description: generateDescription(),
          parent_category_id: parent.category_id,
          is_active: faker.datatype.boolean(),
          display_order: faker.number.int({ min: 1, max: 100 }),
          created_at: generateRandomDate(),
          hierarchy_code: hierarchyCode
        });
      }
    }
    categories = categories.concat(newCategories);
    
    // Break if no new categories were added to avoid infinite loop
    if (newCategories.length === 0) {
      // Fallback: Add remaining categories with random parents
      while (categories.length < TOTAL_CATEGORIES) {
        const randomParent = faker.helpers.arrayElement(categories);
        childCounters[randomParent.category_id] = (childCounters[randomParent.category_id] || 0) + 1;
        const hierarchyCode = randomParent.hierarchy_code 
          ? `${randomParent.hierarchy_code}.${childCounters[randomParent.category_id]}`
          : `${childCounters[randomParent.category_id]}`;

        categories.push({
          category_id: currentId++,
          category_name: generateCategoryName(),
          description: generateDescription(),
          parent_category_id: randomParent.category_id,
          is_active: faker.datatype.boolean(),
          display_order: faker.number.int({ min: 1, max: 100 }),
          created_at: generateRandomDate(),
          hierarchy_code: hierarchyCode
        });
      }
      break;
    }
  }

  return categories;
}

// Function to insert categories in batches
async function insertCategories(categories) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      const batch = categories.slice(i, i + BATCH_SIZE);
      const values = batch.map((cat, index) => {
        const offset = index * 8; // Updated for hierarchy_code
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
      }).join(',');

      const flatValues = batch.flatMap(cat => [
        cat.category_id,
        cat.category_name,
        cat.description,
        cat.parent_category_id,
        cat.is_active,
        cat.display_order,
        cat.created_at,
        cat.hierarchy_code
      ]);

      await client.query(`
        INSERT INTO category (category_id, category_name, description, parent_category_id, is_active, display_order, created_at, hierarchy_code)
        VALUES ${values}
      `, flatValues);

      console.log(`Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(categories.length / BATCH_SIZE)}`);
    }

    await client.query('COMMIT');
    console.log(`Successfully inserted ${categories.length} categories.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inserting categories:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

// Main function to run the script
async function main() {
  try {
    await setupTable();
    const categories = await generateCategories();
    await insertCategories(categories);
  } catch (err) {
    console.error('Error in main:', err.stack);
  } finally {
    await pool.end();
  }
}

// Run the script
main();