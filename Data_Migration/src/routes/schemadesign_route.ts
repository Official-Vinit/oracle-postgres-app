import { Router, Request, Response } from "express";
import { generateSchemaDesign } from "../ai/ai_serivce";
import { SchemaDesignRequest } from "../ai/schemas/schemadesign_request_zod";
import { SchemaDesignResponse } from "../ai/schemas/schemadesign_zod";

export const schemaDesignRouter = Router();

schemaDesignRouter.post("/schema-design", async (req: Request, res: Response) => {
    const parsedRequest = SchemaDesignRequest.safeParse(req.body);

    if (!parsedRequest.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: parsedRequest.error.format()
        });
    }

    try {
        const { provider, result } = await generateSchemaDesign(parsedRequest.data);
        const parsedResponse = SchemaDesignResponse.safeParse(result);
        console.log(parsedResponse);

        if (!parsedResponse.success) {
            console.error(`${provider} returned a response that failed schema validation:`, parsedResponse.error.format());

            return res.status(502).json({
                error: "AI provider returned a response that doesn't match the expected schema",
                provider
            });
        }
        return res.status(200).json({
            provider,
            result: parsedResponse.data
        });

    } catch (error) {
        console.error("Schema design request failed:", error);

        return res.status(500).json({
            error: "Failed to generate schema design",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});