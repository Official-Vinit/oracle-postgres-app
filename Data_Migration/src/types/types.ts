export type EnvConfig = {
    geminiApiKey: string;
    geminiModel: string;
    groqApiKey: string;
    groqModel: string;
};
export type SchemaDesignInput = {
    selected_schema: unknown;
    current_design?: unknown;
    user_query: string;
};