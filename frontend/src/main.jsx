import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App.jsx";
import "./index.css";

// Google OAuth Client ID.
// Ye wahi Client ID hai jo Google Cloud Console se create kiya hai.
const GOOGLE_CLIENT_ID = "427818183554-dl5nk74mnrqgooh8c2sfog9umomi5498.apps.googleusercontent.com";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);