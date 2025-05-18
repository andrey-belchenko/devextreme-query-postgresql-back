import express, { Express, Request, Response, Router } from "express";
const { Pool } = require("pg");
const CONNECTION_STRING = "postgresql://admin:admin@localhost:5432/postgres";

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

const app: Express = express();

app.use(express.json());

const createUser = (req: Request, res: Response) => {
  const { name } = req.body;
  res.status(201).json({ id: Math.random(), name });
};

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json([
    { id: 1, name: "John Doe" },
    { id: 2, name: "Jane Doe" },
  ]);
});

app.post("/sales", async (req, res) => {
  try {
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

    // Optional: Add query parameters from request body
    const { startDate, endDate, category } = req.body;
    let params = [];
    let whereClauses = [];

    if (startDate) {
      params.push(startDate);
      whereClauses.push(`s.sale_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      whereClauses.push(`s.sale_date <= $${params.length}`);
    }

    if (category) {
      params.push(category);
      whereClauses.push(`p.category = $${params.length}`);
    }

    // Add WHERE clause if there are any conditions
    let finalQuery = queryText;
    if (whereClauses.length > 0) {
      finalQuery += " WHERE " + whereClauses.join(" AND ");
    }

    // Execute the query
    const { rows } = await pool.query(finalQuery, params);

    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

router.post("/", createUser);

app.use("/api/users", router);

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
