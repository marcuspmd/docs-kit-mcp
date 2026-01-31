import { z } from "zod";
declare const PromptRuleSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    pattern: z.ZodOptional<z.ZodString>;
    symbolPrompt: z.ZodOptional<z.ZodString>;
    docPrompt: z.ZodOptional<z.ZodString>;
    changePrompt: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodString>;
    contextFile: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    language?: string | undefined;
    pattern?: string | undefined;
    symbolPrompt?: string | undefined;
    docPrompt?: string | undefined;
    changePrompt?: string | undefined;
    context?: string | undefined;
    contextFile?: string | undefined;
}, {
    name: string;
    language?: string | undefined;
    pattern?: string | undefined;
    symbolPrompt?: string | undefined;
    docPrompt?: string | undefined;
    changePrompt?: string | undefined;
    context?: string | undefined;
    contextFile?: string | undefined;
}>, {
    name: string;
    language?: string | undefined;
    pattern?: string | undefined;
    symbolPrompt?: string | undefined;
    docPrompt?: string | undefined;
    changePrompt?: string | undefined;
    context?: string | undefined;
    contextFile?: string | undefined;
}, {
    name: string;
    language?: string | undefined;
    pattern?: string | undefined;
    symbolPrompt?: string | undefined;
    docPrompt?: string | undefined;
    changePrompt?: string | undefined;
    context?: string | undefined;
    contextFile?: string | undefined;
}>;
export declare const ConfigSchema: z.ZodObject<{
    projectRoot: z.ZodString;
    include: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    respectGitignore: z.ZodDefault<z.ZodBoolean>;
    maxFileSize: z.ZodDefault<z.ZodNumber>;
    dbPath: z.ZodDefault<z.ZodString>;
    promptRules: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        language: z.ZodOptional<z.ZodString>;
        pattern: z.ZodOptional<z.ZodString>;
        symbolPrompt: z.ZodOptional<z.ZodString>;
        docPrompt: z.ZodOptional<z.ZodString>;
        changePrompt: z.ZodOptional<z.ZodString>;
        context: z.ZodOptional<z.ZodString>;
        contextFile: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }, {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }>, {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }, {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }>, "many">>;
    defaultPrompts: z.ZodDefault<z.ZodObject<{
        symbolPrompt: z.ZodDefault<z.ZodString>;
        docPrompt: z.ZodDefault<z.ZodString>;
        changePrompt: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbolPrompt: string;
        docPrompt: string;
        changePrompt: string;
    }, {
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    include: string[];
    exclude: string[];
    projectRoot: string;
    respectGitignore: boolean;
    maxFileSize: number;
    dbPath: string;
    promptRules: {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }[];
    defaultPrompts: {
        symbolPrompt: string;
        docPrompt: string;
        changePrompt: string;
    };
}, {
    projectRoot: string;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    respectGitignore?: boolean | undefined;
    maxFileSize?: number | undefined;
    dbPath?: string | undefined;
    promptRules?: {
        name: string;
        language?: string | undefined;
        pattern?: string | undefined;
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
        context?: string | undefined;
        contextFile?: string | undefined;
    }[] | undefined;
    defaultPrompts?: {
        symbolPrompt?: string | undefined;
        docPrompt?: string | undefined;
        changePrompt?: string | undefined;
    } | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export type PromptRule = z.infer<typeof PromptRuleSchema>;
export declare function resolvePrompts(config: Config, file: {
    language?: string;
    path: string;
}): {
    symbolPrompt: string;
    docPrompt: string;
    changePrompt: string;
};
export {};
