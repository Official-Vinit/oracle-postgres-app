import Groq from "groq-sdk";
import { env } from "../../config/env";
import { SCHEMA_DESIGN_PROMPT } from "../prompts/schemadesign_prompt";
import { schemaDesignSchema } from "../schemas/schemadesign_schema";

const client = new Groq({
    apiKey: env.groqApiKey
});

type SchemaDesignInput = {
    selected_schema: unknown;
    current_design?: unknown;
    user_query: string;
};

// Deterministic JSON.stringify: sorts object keys recursively so the same
// logical schema always serializes to the exact same string, regardless of
// property insertion order upstream. Required for Groq's prefix cache to
// reliably match the static portion of the prompt across requests.
function stableStringify(value: unknown): string {
    const sortKeys = (input: unknown): unknown => {
        if (Array.isArray(input)) {
            return input.map(sortKeys);
        }
        if (input !== null && typeof input === "object") {
            return Object.keys(input as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, key) => {
                    acc[key] = sortKeys((input as Record<string, unknown>)[key]);
                    return acc;
                }, {});
        }
        return input;
    };

    return JSON.stringify(sortKeys(value));
}

export async function generateWithGroq(
    input: SchemaDesignInput
): Promise<unknown> {

    // Static portion: selected_schema + current_design. Identical across
    // requests for the same schema/design, so it forms the reusable
    // cacheable prefix. Keep this message ahead of the dynamic query.
    const schemaContext = JSON.stringify(
        {
            selected_schema: JSON.parse(stableStringify(input.selected_schema)),
            current_design: input.current_design
                ? JSON.parse(stableStringify(input.current_design))
                : null
        },
        null,
        2
    );

    // Dynamic portion: changes per request, must come after the static content.
    const userQuery = `## User Query\n\n${input.user_query}`;

    const response = await client.chat.completions.create({

        model: env.groqModel,

        messages: [
            {
                role: "system",
                content: SCHEMA_DESIGN_PROMPT
            },
            {
                role: "user",
                content: schemaContext
            },
            {
                role: "user",
                content: userQuery
            }
        ],

        response_format: {
            type: "json_schema",

            json_schema: {
                name: "schema_design",
                strict: true,
                schema: schemaDesignSchema
            }
        }
    });

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const cacheHitRate = promptTokens > 0 ? (cachedTokens / promptTokens) * 100 : 0;

    console.log("Groq usage:", {
        model: env.groqModel,
        promptTokens,
        cachedTokens,
        cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
        throw new Error("Groq returned an empty response");
    }

    try {
        return JSON.parse(content);
    } catch {
        throw new Error("Groq returned invalid JSON");
    }
}