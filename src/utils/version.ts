import { createRequire } from "node:module";

// Both src/utils/ and dist/utils/ sit two levels below package.json, so the relative
// lookup resolves correctly before and after bundling.
export const VERSION = createRequire(import.meta.url)("../../package.json").version as string;
