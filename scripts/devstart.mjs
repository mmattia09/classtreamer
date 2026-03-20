#!/usr/bin/env bun

import { copyFileSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

const steps = [
  {
    label: "Starting local services",
    command: "docker",
    args: ["compose", "up", "-d", "postgres", "redis"],
  },
  {
    label: "Generating Prisma client",
    command: "bun",
    args: ["run", "prisma:generate"],
  },
  {
    label: "Pushing Prisma schema",
    command: "bun",
    args: ["run", "prisma:push"],
  },
  {
    label: "Seeding database",
    command: "bun",
    args: ["run", "prisma:seed"],
  },
  {
    label: "Starting app",
    command: "bun",
    args: ["run", "dev"],
  },
];

function runStep({ label, command, args }) {
  console.log(`\n==> ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  if (existsSync(envPath)) {
    rmSync(envPath);
  }

  copyFileSync(envExamplePath, envPath);
  console.log("==> Reset .env from .env.example");

  for (const step of steps) {
    await runStep(step);
  }
}

main().catch((error) => {
  console.error(`\nFailed to start development environment: ${error.message}`);
  process.exit(1);
});
