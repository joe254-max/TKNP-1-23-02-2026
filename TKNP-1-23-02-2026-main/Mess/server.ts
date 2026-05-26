import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import axios from "axios";
import jwt from "jsonwebtoken";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // JWT Middleware (Mocking for now, but ready for integration)
  const authenticateJWT = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      // In a real scenario, we'd verify with JWT_SECRET
      // For this module, we'll assume the parent system handles this or we provide a mock user if no token
      try {
        if (process.env.JWT_SECRET) {
          const user = jwt.verify(token, process.env.JWT_SECRET);
          req.user = user;
        } else {
          // Mock user for development if no secret is set
          req.user = {
            user_id: "mock_user_123",
            full_name: "John Doe",
            phone_number: "254700000000"
          };
        }
        next();
      } catch (err) {
        return res.sendStatus(403);
      }
    } else {
      // For demo purposes, if no token, use mock
      req.user = {
        user_id: "mock_user_123",
        full_name: "John Doe",
        phone_number: "254700000000"
      };
      next();
    }
  };

  // --- M-Pesa Integration ---

  app.get("/api/payments/mpesa-status", (req, res) => {
    res.json({
      hasKey: !!process.env.MPESA_CONSUMER_KEY,
      hasSecret: !!process.env.MPESA_CONSUMER_SECRET,
      hasShortcode: !!process.env.MPESA_SHORTCODE,
      hasPasskey: !!process.env.MPESA_PASSKEY,
      keyLength: (process.env.MPESA_CONSUMER_KEY || "").trim().length,
      secretLength: (process.env.MPESA_CONSUMER_SECRET || "").trim().length,
      shortcodeLength: (process.env.MPESA_SHORTCODE || "").trim().length,
      passkeyLength: (process.env.MPESA_PASSKEY || "").trim().length,
      env: process.env.MPESA_ENVIRONMENT || "sandbox"
    });
  });

  const getMpesaToken = async () => {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    console.log("M-Pesa Credentials Check:", {
      hasKey: !!consumerKey,
      hasSecret: !!consumerSecret,
      hasShortcode: !!process.env.MPESA_SHORTCODE,
      hasPasskey: !!process.env.MPESA_PASSKEY,
      env: process.env.MPESA_ENVIRONMENT || "sandbox"
    });

    if (!consumerKey) throw new Error("Missing MPESA_CONSUMER_KEY in AI Studio Secrets");
    if (!consumerSecret) throw new Error("Missing MPESA_CONSUMER_SECRET in AI Studio Secrets");

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const url = process.env.MPESA_ENVIRONMENT === "live" 
      ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    console.log("Fetching M-Pesa OAuth Token from:", url);
    const response = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log("M-Pesa Token fetched successfully");
    return response.data.access_token;
  };

  app.post("/api/payments/stk-push", authenticateJWT, async (req, res) => {
    try {
      const { amount, phoneNumber, orderId } = req.body;
      
      if (!amount || !phoneNumber || !orderId) {
        return res.status(400).json({ error: "Missing required parameters: amount, phoneNumber, or orderId" });
      }

      // Format phone number to 2547XXXXXXXX or 2541XXXXXXXX
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
        formattedPhone = '254' + formattedPhone;
      } else if (formattedPhone.startsWith('254')) {
        // Already in correct format
      }

      console.log("Formatted Phone:", formattedPhone);

      if (formattedPhone.length !== 12) {
        return res.status(400).json({ 
          error: "Invalid phone number format", 
          details: "Phone number must be 12 digits (e.g., 254712345678 or 0712345678)" 
        });
      }

      const token = await getMpesaToken();
      
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const shortCode = (process.env.MPESA_SHORTCODE || "").trim();
      const passkey = (process.env.MPESA_PASSKEY || "").trim();

      console.log("M-Pesa Config Check:", {
        shortCode: `${shortCode.slice(0, 2)}...${shortCode.slice(-2)}`,
        shortCodeLength: shortCode.length,
        passkey: `${passkey.slice(0, 4)}...${passkey.slice(-4)}`,
        passkeyLength: passkey.length,
        timestamp: timestamp,
        environment: process.env.MPESA_ENVIRONMENT || "sandbox"
      });

      if (shortCode === "174379" && passkey.length !== 64) {
        console.warn("WARNING: You are using the standard sandbox shortcode (174379) but your passkey length is not 64. This will likely cause 'Wrong credentials' error.");
      }

      if (!shortCode || !passkey) {
        throw new Error("Missing M-Pesa Shortcode or Passkey");
      }

      const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");

      const url = process.env.MPESA_ENVIRONMENT === "live"
        ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
        : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

      // Ensure CallBackURL is a valid HTTPS URL
      let callbackUrl = process.env.MPESA_CALLBACK_URL;
      if (!callbackUrl) {
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        callbackUrl = `${protocol}://${host}/api/payments/callback`;
      }

      const payload = {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: `FoodHub-${orderId.slice(-6)}`,
        TransactionDesc: "Food Payment",
      };

      console.log("Initiating M-Pesa STK Push to:", url);
      console.log("Payload:", JSON.stringify({ ...payload, Password: "[REDACTED]" }, null, 2));

      const response = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("M-Pesa STK Push Response:", JSON.stringify(response.data, null, 2));
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("STK Push Error Details:", JSON.stringify(errorData, null, 2));
      
      // Return a more descriptive error if it's from Safaricom
      if (error.response) {
        return res.status(error.response.status).json({ 
          error: "M-Pesa API Error", 
          details: errorData,
          message: errorData.errorMessage || errorData.ResultDesc || error.message
        });
      }
      
      res.status(500).json({ error: "Failed to initiate payment", details: error.message });
    }
  });

  app.post("/api/payments/callback", async (req, res) => {
    const callbackData = req.body;
    console.log("M-Pesa Callback Received:", JSON.stringify(callbackData, null, 2));
    
    // Logic to update Firestore order status based on callbackData
    // We would use Firebase Admin SDK here for secure server-side updates
    // For this applet, we'll log it and the frontend can poll or we can use a service account if provided
    
    res.json({ ResultCode: 0, ResultDesc: "Success" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
