import { GoogleLogin } from "@react-oauth/google";

function App() {
  // Google login successful hone par ye function chalega.
  // response.credential mein Google ka ID token milega.
  const handleGoogleSuccess = (response) => {
    console.log("Google Login Success");
    console.log("Google Credential:", response.credential);
  };

  // Google login fail hone par ye function chalega.
  const handleGoogleError = () => {
    console.error("Google Login Failed");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Laundry ERP</h1>

      <p>Google Authentication Test</p>

      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
      />
    </div>
  );
}

export default App;