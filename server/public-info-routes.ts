import express from "express";
import { spawn } from "child_process";
import { z } from "zod";

const verifySchema = z.object({
  subject: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  username: z.string().optional(),
});

const crawlSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(0).max(2).default(1).optional(),
  maxPages: z.number().int().min(1).max(25).default(10).optional(),
});

function runPythonCli(args: string[], input?: unknown): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", "server.public_info_verifier.cli", ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    if (input !== undefined) {
      child.stdin.write(JSON.stringify(input));
    }
    child.stdin.end();
  });
}

export function registerPublicInfoRoutes(app: express.Express) {
  const router = express.Router();

  router.post("/verify", async (req, res) => {
    const parsed = verifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }

    const payload = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined && value !== ""),
    );

    const result = await runPythonCli(["verify"], payload);
    if (result.exitCode !== 0) {
      return res.status(400).json({ error: result.stderr || "Verification failed" });
    }

    return res.json(JSON.parse(result.stdout));
  });

  router.post("/username", async (req, res) => {
    const username = z.string().min(2).safeParse(req.body?.username);
    if (!username.success) {
      return res.status(400).json({ error: "username is required" });
    }

    const result = await runPythonCli(["username", username.data]);
    if (result.exitCode !== 0) {
      return res.status(400).json({ error: result.stderr || "Username search failed" });
    }

    return res.json(JSON.parse(result.stdout));
  });

  router.post("/crawl", async (req, res) => {
    const parsed = crawlSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }

    const result = await runPythonCli([
      "deep-crawl",
      parsed.data.url,
      "--depth",
      String(parsed.data.depth ?? 1),
      "--max-pages",
      String(parsed.data.maxPages ?? 10),
    ]);

    if (result.exitCode !== 0) {
      return res.status(400).json({ error: result.stderr || "Crawl failed" });
    }

    return res.json(JSON.parse(result.stdout));
  });

  router.post("/report", async (req, res) => {
    const parsed = verifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }

    const payload = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined && value !== ""),
    );

    const result = await runPythonCli(["report"], payload);
    if (result.exitCode !== 0) {
      return res.status(400).json({ error: result.stderr || "Report generation failed" });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(result.stdout);
  });

  app.use("/api/public-info", router);
}
