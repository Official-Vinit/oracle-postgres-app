import "./config/env.js";

import express from "express";

import {schemaDesignRouter}
    from "./routes/schemadesign_route.js";

const app =
    express();

/*
 * Parse JSON request bodies.
 */
app.use(
    express.json({
        limit: "10mb"
    })
);

/*
 * Schema Design API
 *
 * POST /api/schema-design
 */
app.use(
    "/api",
    schemaDesignRouter
);

/*
 * Health check
 */
app.get(
    "/health",
    (
        _req,
        res
    ): void => {

        res.status(200).json({
            success: true,
            message: "Server is running"
        });
    }
);

/*
 * PORT
 */
const PORT: number =
    Number(
        process.env.PORT ?? "3000"
    );

if (
    !Number.isInteger(PORT) ||
    PORT <= 0
) {
    throw new Error(
        "Invalid PORT configuration"
    );
}

/*
 * Start server
 */
app.listen(
    PORT,
    (): void => {

        console.log("");
        console.log("==============================");
        console.log("DATABASE SCHEMA AI SERVER");
        console.log("==============================");

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            `Schema Design API: POST http://localhost:${PORT}/api/schema-design`
        );

        console.log(
            `Health Check: GET http://localhost:${PORT}/health`
        );
    }
);