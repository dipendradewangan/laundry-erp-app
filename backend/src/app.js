/**
 * ============================================================
 * Laundry ERP - Express Application
 * ============================================================
 *
 * Responsibilities:
 * - Security middleware
 * - CORS
 * - Request body parsing
 * - API routes
 * - Global error handling
 * ============================================================
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.js";


const app = express();


/**
 * ============================================================
 * SECURITY
 * ============================================================
 */

app.use(helmet());


/**
 * ============================================================
 * CORS
 * ============================================================
 */

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",

    credentials: true,
  })
);


/**
 * ============================================================
 * BODY PARSING
 * ============================================================
 */

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);


/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get("/health", (req, res) => {

  res.status(200).json({
    success: true,

    message:
      "Laundry ERP API is running",

    environment:
      process.env.NODE_ENV ||
      "development",

    timestamp:
      new Date().toISOString(),
  });
});


/**
 * ============================================================
 * AUTH ROUTES
 * ============================================================
 *
 * Base URL:
 *
 *   /api/auth
 *
 * Google login:
 *
 *   POST /api/auth/google
 *
 * authRoutes.js:
 *
 *   POST /google
 *
 * Therefore final endpoint:
 *
 *   POST /api/auth/google
 * ============================================================
 */

app.use("/api/auth", authRoutes);


/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 */

app.use((req, res) => {

  res.status(404).json({
    success: false,

    message:
      "API endpoint not found",

    path:
      req.originalUrl,
  });
});


/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * ============================================================
 */

app.use((err, req, res, next) => {

  console.error(
    "Unhandled application error:",
    err
  );

  res.status(
    err.statusCode || 500
  ).json({
    success: false,

    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});


export default app;