/**
 * ============================================================
 * Laundry ERP - Express Application
 * ============================================================
 *
 * File:
 *     backend/src/app.js
 *
 * Responsibilities:
 * -----------------
 * 1. Security middleware
 * 2. CORS configuration
 * 3. Request body parsing
 * 4. Health check
 * 5. API route registration
 * 6. Centralized 404 handling
 * 7. Centralized error handling
 *
 * IMPORTANT:
 * ----------
 * 404 handler aur global error handler ka order important hai.
 *
 * Unknown routes:
 *     notFoundHandler
 *
 * Application errors:
 *     errorHandler
 * ============================================================
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import regionRoutes from "./routes/regionRoutes.js";

import {
  requestIdMiddleware
} from "./middlewares/requestIdMiddleware.js";

import {
  notFoundHandler,
} from "./middlewares/notFoundHandler.js";

import {
  errorHandler,
} from "./middlewares/errorHandler.js";


const app = express();



// Har request ko unique ID dena.
app.use(requestIdMiddleware);

/**
 * ============================================================
 * SECURITY MIDDLEWARE
 * ============================================================
 *
 * Helmet common HTTP security headers set karta hai.
 */

app.use(helmet());


/**
 * ============================================================
 * CORS CONFIGURATION
 * ============================================================
 *
 * Frontend URL .env se configure kar sakte hain.
 *
 * Development fallback:
 *     http://localhost:5173
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
 * REQUEST BODY PARSING
 * ============================================================
 *
 * JSON aur URL-encoded request bodies parse karte hain.
 *
 * Agar JSON invalid ho ya configured size limit exceed ho,
 * Express error middleware ko error forward karega.
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
 *
 * API server running status check karne ke liye.
 *
 * NOTE:
 * -----
 * Ye endpoint sirf API availability check karta hai.
 * Iska response database health guarantee nahi karta.
 */

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,

    message: "Laundry ERP API is running",

    environment:
      process.env.NODE_ENV || "development",

    timestamp: new Date().toISOString(),
  });
});


/**
 * ============================================================
 * API ROUTES
 * ============================================================
 *
 * Application ke API modules yahan register hote hain.
 */

// Authentication APIs
app.use("/api/auth", authRoutes);

// Company Master APIs
app.use("/api/companies", companyRoutes);

// Region Master APIs
app.use("/api/regions", regionRoutes);


/**
 * ============================================================
 * 404 NOT FOUND HANDLER
 * ============================================================
 *
 * Is point tak request kisi registered route se match
 * nahi hui, toh notFoundHandler error generate karega.
 *
 * Ye global errorHandler se pehle register hona chahiye.
 */

app.use(notFoundHandler);


/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * ============================================================
 *
 * Route, middleware aur controller se forward kiye gaye
 * errors ko centralized way mein handle karta hai.
 *
 * IMPORTANT:
 * ----------
 * Express error handler mein 4 parameters hone chahiye.
 */

app.use(errorHandler);


/**
 * ============================================================
 * EXPORT EXPRESS APPLICATION
 * ============================================================
 *
 * server.js is application ko import karke database
 * initialization complete hone ke baad server start karta hai.
 */

export default app;