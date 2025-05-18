import express, { Express, Request, Response, Router } from "express";

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

router.post("/", createUser);

app.use("/api/users", router);

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
