import { pipeline, step, gitGet, httpGet, localGet } from "../lib/our";

import fs from "node:fs/promises";
import path from "node:path";

// --- 1. Define Providers ---
const rawConfig = httpGet("https://jsonplaceholder.typicode.com/todos/1");

// --- 2. Define Pipeline Steps ---
step("Clean & Prepare", async (ctx) => {
    // Let's ensure a clean slate by emptying the out directory first
    await fs.rm(ctx.package.rootDir, { recursive: true, force: true });

    // Write a dummy JSON file to test the mutator
    await fs.mkdir(ctx.package.rootDir, { recursive: true });
    await fs.writeFile(
        path.join(ctx.package.rootDir, "settings.json"),
        JSON.stringify({ version: "1.0" }),
    );

    // Download our remote JSON file
    await ctx.package.copy(rawConfig.all());
});

step("Mutate Configurations", async (ctx) => {
    await ctx.package.editJson("settings.json", (data) => {
        data.version = "99.9.9";
        data.status = "Mutated!";
    });
});

step("Finalize Build", async (ctx) => {
    await ctx.package
        .cd("artifacts")

        // This will now print beautifully to your terminal!
        .exec('echo "Hello from the build pipeline!"')
        .exec("ls -la")

        // This will quietly create the file as before
        .exec('echo "Build finished at $(date)" > build.log')

        .cd("..")
        .remove("1");
});

// Run pipeline if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    await pipeline.run();
}
