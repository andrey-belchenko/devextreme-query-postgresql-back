import express, { Express, Request, Response, Router } from "express";
import { StatementsExecutor } from "../lib/statement-executor";
import { LoadOptions } from "../lib/load-options";
import { execQuery } from "./mongo";
import { ExprProviderPg } from "../lib/expr-provider-pg";
import { ExprProviderOracle11g } from "../lib/expr-provider-oracle11g";
import { LoadOptionsParser } from "../lib/load-options-parser";
import { query } from "../lib";
import { ExecResult } from "../lib/statement-executor";
const { Pool } = require("pg");
const oracledb = require("oracledb");
const cors = require("cors");
const CONNECTION_STRING = "postgresql://postgres:password@localhost:5432/postgres";

// Initialize Oracle Client
oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_11_2" });

// Oracle connection configuration (matching sales-oracle11g.js)
const ORACLE_CONFIG = {
  connectString: "(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = kaz-realkaz.infoenergo.loc)(PORT = 1521)) (CONNECT_DATA = (SID = realkazn) (server = dedicated)))",
  user: "asuse",
  password: "kl0pik"
};

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

const app: Express = express();

app.use(cors());
app.use(express.json());

app.post("/sales", async (req, res) => {
  console.log("PG");
  const pgClient = await pool.connect();
  try {
    // console.log(JSON.stringify(req.body));
    const loadOptions = req.body.loadOptions as LoadOptions;
    console.log("PG LOAD OPTIONS:");
    console.log(JSON.stringify(loadOptions, null, 2));
    const queryText = `
      SELECT
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
        p.product_id = s.product_id
    `;

    const result = await query(pgClient, loadOptions, queryText);
    // const result = await processor.execute();
    console.log(`COUNT: ${result.data.length} TOTAL: ${result.totalCount}`);
    console.log("PG RESULT:");
    // console.log(JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    pgClient.release();
  }
});

app.post("/oracle/sales", async (req, res) => {
  console.log("ORACLE");
  let connection;
  try {
    connection = await oracledb.getConnection(ORACLE_CONFIG);
    
    // Inline queryOracle function
    async function queryOracle(
      oracleConnection: any,
      loadOptions: any,
      sourceQueryText: string,
      sourceQueryParamValues?: any[]
    ): Promise<ExecResult> {
      const exprProvider = new ExprProviderOracle11g();
      const parser = new LoadOptionsParser({
        exprProvider: exprProvider,
      });
      const statements = parser.parse(loadOptions);
      const executor = new StatementsExecutor({
        handler: async (statement) => {
          const query = statement.buildQuery({
            sourceQuery: {
              queryText: sourceQueryText,
              paramValues: sourceQueryParamValues,
            },
            exprProvider: exprProvider,
          });
          const result = await oracleConnection.execute(
            query.queryText,
            query.paramValues || [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return result.rows;
        },
      });
      const result = await executor.execute(statements);
      return result;
    }

    const loadOptions = req.body.loadOptions as LoadOptions;
    console.log("ORACLE LOAD OPTIONS:");
    console.log(JSON.stringify(loadOptions, null, 2));
    const queryText = `
      SELECT
        s.sale_id,
        p.category as product_category,
        p.name as product_name,
        c.name as customer_name,
        s.sale_date,
        s.price,
        s.quantity,
        s.amount,
        s.payment_method,
        s.status,
        s.is_refunded
      FROM
        test_bav_smpl_sales s
      JOIN test_bav_smpl_customer c ON
        c.customer_id = s.customer_id
      JOIN test_bav_smpl_product p ON
        p.product_id = s.product_id
    `;

    const result = await queryOracle(connection, loadOptions, queryText);
    console.log(`COUNT: ${result.data.length} TOTAL: ${result.totalCount}`);
    console.log("ORACLE RESULT:");
    // console.log(JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.post("/mongo/sales", async (req, res) => {
  // console.log("MONGO");
  // console.log(JSON.stringify(req.body));
  const loadOptions = req.body.loadOptions as LoadOptions;
  console.log("MONGO LOAD OPTIONS:");
  console.log(JSON.stringify(loadOptions, null, 2));
  const result = await execQuery({
    loadOptions,
    collection: "sales",
  });
  // console.log(`COUNT: ${result?.data?.length} TOTAL: ${result.totalCount}`);
  console.log("MONGO RESULT:");
  // console.log(JSON.stringify(result, null, 2));
  res.json(result);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
