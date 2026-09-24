import { generateWithGemini } from "./providers/gemini_provider";
import { generateWithGroq } from "./providers/groq_provider";
import type { SchemaDesignInput } from "../types/types";

export async function generateSchemaDesign(input: SchemaDesignInput) {

    try {
        console.log("→ Trying Groq");

        const result = await generateWithGroq(input);

        return {
            provider: "groq",
            result
        };

    } catch (groqError) {
        console.error("Groq failed:");
        console.error(groqError);
        console.log("→ Falling back to Gemini");

        const result = await generateWithGemini(input);

        return {
            provider: "gemini",
            result
        };
    }
}