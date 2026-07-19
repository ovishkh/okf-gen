import type { BundlePlan, Concept } from "./schema.js";
export interface RenderOptions {
    force?: boolean;
    includeLog?: boolean;
    now?: Date;
}
export interface RenderResult {
    mode: "created" | "updated";
    files: string[];
}
export declare function renderBundle(plan: BundlePlan, outputDirectory: string, options?: RenderOptions): Promise<RenderResult>;
export declare function renderConcept(concept: Concept, now?: Date): string;
//# sourceMappingURL=render.d.ts.map