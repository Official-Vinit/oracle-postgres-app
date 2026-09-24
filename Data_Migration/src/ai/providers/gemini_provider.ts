import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";
import { SCHEMA_DESIGN_PROMPT } from "../prompts/schemadesign_prompt";
import { schemaDesignSchema } from "../schemas/schemadesign_schema";
import { SchemaDesignResponse } from "../schemas/schemadesign_zod";
export type SchemaDesignInput = {
    selected_schema: unknown;
    current_design?: unknown;
    user_query: string;
};

const client = new GoogleGenAI({
    apiKey: env.geminiApiKey
});

export async function generateWithGemini(
    input: SchemaDesignInput
): Promise<unknown> {

    // Note: Gemini has no documented equivalent to Groq's automatic prompt
    // caching for this SDK path, so there's no benefit to splitting
    // static/dynamic content into separate messages here — a single
    // structured payload is fine.
    const requestPayload = JSON.stringify({
        selected_schema: input.selected_schema,
        current_design: input.current_design ?? null,
        user_query: input.user_query
    });

    const response = await client.models.generateContent({
        model: env.geminiModel,
        contents: requestPayload,
        config: {
            systemInstruction: SCHEMA_DESIGN_PROMPT,
            responseMimeType: "application/json",
            responseSchema: schemaDesignSchema
        }
    });

    if (!response.text) {
        throw new Error("Gemini returned an empty response");
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(response.text);
    } catch {
        throw new Error("Gemini returned invalid JSON");
    }

    const validated = SchemaDesignResponse.safeParse(parsed);

    if (!validated.success) {
        console.error("Gemini output failed schema validation:", validated.error.format());
        throw new Error("Gemini returned a response that doesn't match the expected schema");
    }

    return validated.data;
}