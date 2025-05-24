import * as mongoDB from "mongodb";

require("babel-polyfill");
const query = require("devextreme-query-mongodb");
const dbName = "reports_tmp";

export function replaceDateStrings(obj: any) {
  // Check if the input is an object
  if (typeof obj === "object" && obj !== null) {
    // Iterate over each key-value pair in the object
    for (let key in obj) {
      // Check if the value is a string
      if (typeof obj[key] === "string") {
        // Check if the string matches the date format (with or without milliseconds)
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(obj[key])) {
          // Replace the string with a Date object
          obj[key] = new Date(obj[key]);
        }
      }
      // Check if the value is an object or an array
      else if (typeof obj[key] === "object" && obj[key] !== null) {
        // Recursively call the function for nested objects or arrays
        replaceDateStrings(obj[key]);
      }
    }
  }
  return obj;
}

export async function execQuery(req: any): Promise<any> {
  let results = undefined;
  await useMongo(async (client: mongoDB.MongoClient) => {
    const db = client.db(dbName);
    const collection = db.collection(req.collection);
    let loadOptions = replaceDateStrings(req.loadOptions);
    results = await query(collection, loadOptions);
  });
  return results;
}

async function useMongo(
  operations: (client: mongoDB.MongoClient) => Promise<void>
) {
  const client = new mongoDB.MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    await operations(client);
  } finally {
    try {
      client.close();
    } catch {}
  }
}

