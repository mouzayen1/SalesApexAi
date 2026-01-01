import express from "express";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/static";

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(express.urlencoded({ extended: false }));

registerRoutes(app);
serveStatic(app);

export default app;
