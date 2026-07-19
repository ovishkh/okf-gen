import { z } from "zod";
export declare const conceptSchema: z.ZodObject<{
    path: z.ZodString;
    type: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    resource: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    body: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
}, z.core.$strip>;
export declare const bundlePlanSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    concepts: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        type: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        resource: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        body: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Concept = z.infer<typeof conceptSchema>;
export type BundlePlan = z.infer<typeof bundlePlanSchema>;
//# sourceMappingURL=schema.d.ts.map