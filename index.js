import { gitGet, localGet, step, next } from "./lib/our.js";

// process.env.CACHE_DIR = "mocks/cache";

const atmosphere = gitGet("https://github.com/Atmosphere-NX/Atmosphere");

step("Unpacking Atmosphere", (provider) => {
    const atmosphereFiles = atmosphere.all();
    atmosphereFiles.remove("README.md");
    provider.package.copy(atmosphereFiles);
});

const exosphereConfig = localGet("mocks/atmosphere/config/exosphere.ini");

step("Adding our exosphere config", (provider) => {
    provider.package.cd("atmosphere/config").place(exosphereConfig.all());
});

next(import("./recipes/saltysd.js"));
