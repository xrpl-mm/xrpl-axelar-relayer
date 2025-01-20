import express, { NextFunction, Request, Response } from "express";
import { inMemoryCache } from "./in_memory_cache";

export const runServer = () => {
  const app = express();
  const port = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  function isPOSTPayloadRequest(body: any): boolean {
    return body && typeof body.payload !== "undefined"; // Adjust validation as needed
  }

  // POST route to handle payloads from XRPL
  app.post("/payload-from-xrpl", (req: Request, res: Response): void => {
    const body = req.body;

    if (isPOSTPayloadRequest(body)) {
      inMemoryCache.addPayloadFromXRPL(body.payload);
      res.json({ message: "Payload received" });
      return;
    }

    res.status(400).json({ message: "Bad request" });
  });

  // Catch-all for unsupported routes or methods
  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== "POST") {
      res.status(405).json({ message: "Method not allowed" });
    } else {
      res.status(404).json({ message: "Not found" });
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
};
