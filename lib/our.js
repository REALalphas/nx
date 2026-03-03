import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import path from "node:path";
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(spawn);

// ==========================================
// Advanced Error Handling
// ==========================================
class PipelineError extends Error {
    constructor(message, stepName, hint) {
        super(message);
        this.name = "PipelineError";
        this.stepName = stepName;
        this.hint = hint;
    }

    print() {
        console.error(`\n❌ \x1b[31mError in step [${this.stepName}]\x1b[0m`);
        console.error(`   \x1b[33m${this.message}\x1b[0m`);
        if (this.hint) {
            console.error(`\n   💡 \x1b[36mHint: ${this.hint}\x1b[0m\n`);
        }
    }
}

// ==========================================
// Core Pipeline State
// ==========================================
class Pipeline {
    constructor() {
        this.steps = [];
        this.isRunning = false;
    }

    get outDir() {
        return process.env.OUT_DIR
            ? path.resolve(process.cwd(), process.env.OUT_DIR)
            : path.join(process.cwd(), "out");
    }
    get cacheDir() {
        return process.env.CACHE_DIR
            ? path.resolve(process.cwd(), process.env.CACHE_DIR)
            : path.join(process.cwd(), ".cache");
    }
    get env() {
        return process.env;
    }

    step(name, callback) {
        this.steps.push({ type: "task", name, callback });
        return this;
    }

    async run() {
        if (this.isRunning) return;
        this.isRunning = true;

        await fs.mkdir(this.outDir, { recursive: true });

        for (let i = 0; i < this.steps.length; i++) {
            const current = this.steps[i];
            process.stdout.write(
                `\x1b[34m[${i + 1}/${this.steps.length}]\x1b[0m ${current.name}... `,
            );

            const builder = new PackageBuilder(this.outDir, current.name);
            const context = { package: builder, env: this.env };

            try {
                await current.callback(context);

                if (builder._queue.length > 0) {
                    await builder;
                }

                console.log("\x1b[32mdone.\x1b[0m");
            } catch (error) {
                console.log("\x1b[31mfailed!\x1b[0m");
                if (error instanceof PipelineError) {
                    error.print();
                } else {
                    new PipelineError(
                        error.message,
                        current.name,
                        "Check stack trace for unhandled exception details.",
                    ).print();
                    console.error(error);
                }
                process.exit(1);
            }
        }
        this.isRunning = false;
        console.log(
            `\n🎉 \x1b[32mPipeline completed successfully! Files saved to: ${this.outDir}\x1b[0m\n`,
        );
    }
}

export const pipeline = new Pipeline();

// ==========================================
// Providers & File Abstractions
// ==========================================
export class FileCollection {
    constructor(basePath, provider = null) {
        this.basePath = basePath;
        this.provider = provider;
        this.excludeRules = [];
        this.includeRules = [];
    }

    async ensureReady(stepName) {
        if (this.provider) await this.provider.ensureDownloaded(stepName);
    }

    remove(pattern) {
        this.excludeRules.push(pattern);
        return this;
    }

    only(pattern) {
        this.includeRules.push(pattern);
        return this;
    }

    shouldInclude(filePath) {
        const relativePath = path.relative(this.basePath, filePath);
        if (
            this.includeRules.length > 0 &&
            !this.includeRules.some((r) =>
                r instanceof RegExp
                    ? r.test(relativePath)
                    : relativePath.includes(r),
            )
        )
            return false;
        if (
            this.excludeRules.length > 0 &&
            this.excludeRules.some((r) =>
                r instanceof RegExp
                    ? r.test(relativePath)
                    : relativePath.includes(r),
            )
        )
            return false;
        return true;
    }
}

class Provider {
    constructor(sourceId, type, options = {}) {
        this.sourceId = sourceId;
        this.type = type;
        this.options = options;
        this._downloadPromise = null;
    }

    async ensureDownloaded(stepName) {
        if (this.type === "local") return;
        if (this._downloadPromise) return this._downloadPromise;

        const uid = path.basename(this.sourceId).replace(/\W+/g, "_");
        const targetDir = path.join(pipeline.cacheDir, uid);

        this._downloadPromise = (async () => {
            try {
                await fs.access(targetDir);
                return; // Cache hit
            } catch (e) {}

            process.stdout.write(
                `\n    ⬇️  Downloading ${this.type} resource... `,
            );
            await fs.mkdir(pipeline.cacheDir, { recursive: true });
            const archivePath = path.join(pipeline.cacheDir, `${uid}.download`);

            try {
                if (this.type === "git") {
                    await this._fetchGit(archivePath, stepName);
                } else if (this.type === "http") {
                    await this._downloadFile(this.sourceId, archivePath);
                }

                // --- THIS IS THE UPDATED PART ---
                await fs.mkdir(targetDir, { recursive: true });

                // Check if the URL implies it's an archive file
                const isArchive =
                    /\.(zip|tar|tar\.gz|tgz)$/i.test(this.sourceId) ||
                    this.type === "git";

                if (isArchive) {
                    // Extract archives
                    await execAsync(
                        `tar -xf "${archivePath}" -C "${targetDir}"`,
                    );
                    await fs.unlink(archivePath);
                } else {
                    // It's a raw file (like .json, .txt, .ini), just move it to the cache folder
                    // We grab the real filename from the URL, or default to 'file.txt'
                    let fileName = "file.txt";
                    try {
                        fileName =
                            path.basename(new URL(this.sourceId).pathname) ||
                            "file.txt";
                    } catch (e) {}

                    await fs.rename(
                        archivePath,
                        path.join(targetDir, fileName),
                    );
                }
                // --------------------------------
            } catch (err) {
                throw new PipelineError(
                    `Failed to download or extract: ${err.message}`,
                    stepName,
                    `Ensure the URL is valid. If extracting failed, ensure 'tar' is available in your system path.`,
                );
            }
        })();

        return this._downloadPromise;
    }

    async _fetchGit(dest, stepName) {
        const repoPath = this.sourceId
            .replace("https://github.com/", "")
            .replace(".git", "");
        const tag = this.options.tag ? `tags/${this.options.tag}` : "latest";

        const response = await fetch(
            `https://api.github.com/repos/${repoPath}/releases/${tag}`,
            {
                headers: { "User-Agent": "universal-builder" },
            },
        );

        if (!response.ok)
            throw new Error(`GitHub API error: ${response.statusText}`);
        const release = await response.json();

        let downloadUrl = release.tarball_url; // Fallback to source code

        if (this.options.assetMatch) {
            const asset = release.assets.find((a) =>
                this.options.assetMatch.test(a.name),
            );
            if (!asset)
                throw new PipelineError(
                    `No asset matched ${this.options.assetMatch}`,
                    stepName,
                    `Available assets: ${release.assets.map((a) => a.name).join(", ")}`,
                );
            downloadUrl = asset.browser_download_url;
        }

        await this._downloadFile(downloadUrl, dest);
    }

    async _downloadFile(url, dest) {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        const fileStream = createWriteStream(dest);
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
    }

    all() {
        const uid = path.basename(this.sourceId).replace(/\W+/g, "_");
        const resolvedPath =
            this.type === "local"
                ? path.resolve(process.cwd(), this.sourceId)
                : path.join(pipeline.cacheDir, uid);
        return new FileCollection(resolvedPath, this);
    }
}

// ==========================================
// Virtual File System (Package Builder)
// ==========================================
export class PackageBuilder {
    constructor(outDir, stepName) {
        this.rootDir = outDir;
        this.currentDir = outDir;
        this.stepName = stepName;
        this._queue = []; // Array to hold all chained tasks
    }

    // --- MAGIC THENABLE QUEUE ---
    // JavaScript natively triggers this method when you `await ctx.package...`
    then(resolve, reject) {
        this._executeQueue()
            .then(() => resolve())
            .catch(reject);
    }

    async _executeQueue() {
        const tasks = [...this._queue];
        this._queue = []; // Clear queue so subsequent awaits work
        for (const task of tasks) {
            await task(); // Run tasks sequentially
        }
        // Do NOT return `this` here.
    }

    // --- ACTIONS (Now completely chainable) ---

    cd(relativePath) {
        this._queue.push(async () => {
            const newPath = path.resolve(this.currentDir, relativePath);
            if (!newPath.startsWith(this.rootDir)) {
                throw new PipelineError(
                    `Cannot cd outside of package root`,
                    this.stepName,
                    `Attempted path: ${relativePath}`,
                );
            }

            await fs.mkdir(newPath, { recursive: true });

            this.currentDir = newPath;
        });
        return this;
    }

    copy(collection) {
        this._queue.push(async () => {
            await collection.ensureReady(this.stepName);
            await this._copyRecursive(
                collection.basePath,
                this.currentDir,
                collection,
            );
        });
        return this;
    }

    exec(command) {
        this._queue.push(
            () =>
                new Promise((resolve, reject) => {
                    // Drop down a line so terminal output doesn't break our "[1/3] Step..." formatting
                    process.stdout.write(
                        `\n\x1b[90mRunning: ${command}\x1b[0m\n`,
                    );

                    const child = spawn(command, {
                        cwd: this.currentDir,
                        shell: true, // Allows Bash features like &&, |, and >
                        stdio: "inherit", // Streams colors, logs, and progress bars directly to your terminal!
                    });

                    child.on("close", (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(
                                new PipelineError(
                                    `Command failed: ${command}`,
                                    this.stepName,
                                    `Process exited with code ${code}`,
                                ),
                            );
                        }
                    });

                    child.on("error", (err) => {
                        reject(
                            new PipelineError(
                                `Failed to start command: ${command}`,
                                this.stepName,
                                err.message,
                            ),
                        );
                    });
                }),
        );
        return this;
    }

    editJson(filename, mutator) {
        this._queue.push(async () => {
            const target = path.resolve(this.currentDir, filename);
            try {
                const data = JSON.parse(await fs.readFile(target, "utf-8"));
                const result = await mutator(data);
                await fs.writeFile(
                    target,
                    JSON.stringify(result || data, null, 2),
                );
            } catch (err) {
                throw new PipelineError(
                    `Failed to edit JSON file: ${filename}`,
                    this.stepName,
                    err.message,
                );
            }
        });
        return this;
    }

    editYaml(filename, mutator) {
        this._queue.push(async () => {
            const target = path.resolve(this.currentDir, filename);
            let yaml;
            try {
                yaml = (await import("js-yaml")).default;
            } catch (e) {
                throw new PipelineError(
                    "js-yaml not installed",
                    this.stepName,
                    "Run: npm install js-yaml",
                );
            }

            try {
                const data = yaml.load(await fs.readFile(target, "utf-8"));
                const result = await mutator(data);
                await fs.writeFile(target, yaml.dump(result || data));
            } catch (err) {
                throw new PipelineError(
                    `Failed to edit YAML file: ${filename}`,
                    this.stepName,
                    err.message,
                );
            }
        });
        return this;
    }

    editIni(filename, mutator) {
        this._queue.push(async () => {
            const target = path.resolve(this.currentDir, filename);
            let ini;
            try {
                ini = await import("ini");
            } catch (e) {
                throw new PipelineError(
                    "ini not installed",
                    this.stepName,
                    "Run: npm install ini",
                );
            }

            try {
                const data = ini.parse(await fs.readFile(target, "utf-8"));
                const result = await mutator(data);
                await fs.writeFile(target, ini.stringify(result || data));
            } catch (err) {
                throw new PipelineError(
                    `Failed to edit INI file: ${filename}`,
                    this.stepName,
                    err.message,
                );
            }
        });
        return this;
    }

    remove(relativePath) {
        this._queue.push(async () => {
            const target = path.resolve(this.currentDir, relativePath);
            if (!target.startsWith(this.rootDir))
                throw new PipelineError(
                    `Cannot remove outside of root`,
                    this.stepName,
                    `Target: ${target}`,
                );
            await fs.rm(target, { recursive: true, force: true });
        });
        return this;
    }

    // --- INTERNAL UTILS ---
    async _copyRecursive(src, dest, collection) {
        try {
            const stat = await fs.stat(src);
            if (stat.isDirectory()) {
                await fs.mkdir(dest, { recursive: true });
                const entries = await fs.readdir(src);
                for (const entry of entries) {
                    const srcPath = path.join(src, entry);
                    if (collection.shouldInclude(srcPath))
                        await this._copyRecursive(
                            srcPath,
                            path.join(dest, entry),
                            collection,
                        );
                }
            } else if (stat.isFile() && collection.shouldInclude(src)) {
                const finalDest =
                    src === collection.basePath
                        ? path.join(dest, path.basename(src))
                        : dest;
                await fs.mkdir(path.dirname(finalDest), { recursive: true });
                await fs.copyFile(src, finalDest);
            }
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }
}

// ==========================================
// Public API
// ==========================================
export const gitGet = (url, options) => new Provider(url, "git", options);
export const httpGet = (url) => new Provider(url, "http");
export const localGet = (localPath) => new Provider(localPath, "local");
export const step = (name, callback) => pipeline.step(name, callback);
