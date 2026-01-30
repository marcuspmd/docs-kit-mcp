import { ConfigSchema } from "./config.js";
const config = ConfigSchema.parse({
    projectRoot: process.cwd(),
});
console.log(`doc-kit server starting with projectRoot: ${config.projectRoot}`);
