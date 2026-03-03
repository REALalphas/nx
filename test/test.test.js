import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";
import { pipeline, step, localGet } from "../lib/our";

test("Universal Pipeline E2E Test", async (t) => {
    const srcDir = path.resolve("./src");
    const outDir = path.resolve("./out");

    // 1. SETUP: Create fake source environment
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(path.join(srcDir, "subfolder", "temp-dir"), {
        recursive: true,
    });

    await fs.writeFile(
        path.join(srcDir, "config.json"),
        JSON.stringify({ environment: "dev" }),
    );
    await fs.writeFile(
        path.join(srcDir, "settings.yaml"),
        "services:\n  cache: memcached\n",
    );
    await fs.writeFile(
        path.join(srcDir, "setup.ini"),
        "[Database]\nPort=3306\n",
    );
    await fs.writeFile(
        path.join(srcDir, "subfolder", "temp-dir", "junk.txt"),
        "delete me",
    );

    // 2. DEFINE PIPELINE
    const localSrc = localGet("./src");

    step("Copy Files", async (ctx) => {
        await ctx.package.copy(localSrc.all());
    });

    step("Mutate Files", async (ctx) => {
        await ctx.package
            .editJson("config.json", (data) => {
                data.environment = "production";
            })
            .editYaml("settings.yaml", (data) => {
                data.services.cache = "redis";
            })
            .editIni("setup.ini", (data) => {
                data.Database.Port = 5432;
            });
    });

    step("Exec and Cleanup", async (ctx) => {
        await ctx.package
            .cd("subfolder")
            .exec('echo "success" > artifact.txt')
            .remove("temp-dir");
    });

    // 3. EXECUTE
    await pipeline.run();

    // 4. ASSERTIONS
    // Check JSON mutation
    const jsonStr = await fs.readFile(
        path.join(outDir, "config.json"),
        "utf-8",
    );
    assert.strictEqual(JSON.parse(jsonStr).environment, "production");

    // Check YAML mutation
    const yamlStr = await fs.readFile(
        path.join(outDir, "settings.yaml"),
        "utf-8",
    );
    assert.match(yamlStr, /cache: redis/);

    // Check INI mutation
    const iniStr = await fs.readFile(path.join(outDir, "setup.ini"), "utf-8");
    assert.match(iniStr, /Port=5432/);

    // Check Exec
    const artifactStr = await fs.readFile(
        path.join(outDir, "subfolder", "artifact.txt"),
        "utf-8",
    );
    assert.match(artifactStr, /success/);

    // Check Remove
    await assert.rejects(
        fs.access(path.join(outDir, "subfolder", "temp-dir")),
        { code: "ENOENT" },
        "temp-dir should have been removed",
    );

    // 5. TEARDOWN (Clean up generated files)
    await fs.rm(srcDir, { recursive: true, force: true });
    await fs.rm(outDir, { recursive: true, force: true });
    console.log("✅ All tests passed successfully!");
});
