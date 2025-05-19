import express, { Express, Request, Response, Router } from "express";
import { Processor } from "./processor";
import { LoadOptions } from "./load-options";
const { Pool } = require("pg");
const cors = require("cors");
const CONNECTION_STRING = "postgresql://admin:admin@localhost:5432/postgres";

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

const app: Express = express();

app.use(cors());
app.use(express.json());

app.post("/sales", async (req, res) => {
  const client = await pool.connect();
  try {
    console.log(JSON.stringify(req.body));
    const loadOptions = req.body.loadOptions as LoadOptions;
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

    const processor = new Processor({
      queryText,
      loadOptions,
      executor: async (opt) => {
        const { rows } = await client.query(opt.queryText, opt.queryParams);
        return rows;
      },
    });

    const result = await processor.execute();
    res.json(result);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
