import { gitGet, step } from "../lib/our.js";

const saltysd = gitGet("https://github.com/masagrator/SaltyNX");

step("Unpacking SaltyNX", (provider) => {
    const saltyFiles = saltysd.all();
    saltyFiles.remove("SaltyNX.elf");
    
    provider.package.cd("SaltySD").copy(saltyFiles);
});
