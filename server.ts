/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Lazy-initialize GoogleGenAI client with standard build headers
  const getGeminiClient = () => {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API endpoint for Gemini Scholarly Research Assistant
  app.post("/api/gemini/query", async (req, res) => {
    try {
      const { prompt, history } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.json({ 
          response: "No Gemini API secret has been configured yet. Please supply a valid `GEMINI_API_KEY` under **Settings > Secrets** in the top right to enable live analysis.",
          error: "missing_key"
        });
      }

      const contextualInstruction = `You are a distinguished Constitutional Law Scholar, specializing in Northeast India's Sixth Schedule, tribal governance, and asymmetric federalism.
Your purpose is to assist legal researchers and historians analyzing the archive of Autonomous District Councils (ADCs), the Constituent Assembly Debates (September 1949), and judicial reviews thereabout.

Answer the researcher's query in an objective, scholarly, and professional tone. Provide critical context on:
- Legislative vs. Executive coordinate powers of councils.
- Dr. Ambedkar's comparative cantonal analysis or US tribal sovereignty views.
- Key precedents (e.g., Sangma v. State; TTAADC land disputes).
Present answers in elegant, structured Markdown formats. No preamble of "Certainly", begin writing the analytical brief directly.`;

      // Construct history array with proper developer structural roles
      const contents = history ? history.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })) : [];

      contents.push({
        role: "user",
        parts: [{ text: prompt }]
      });

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: contextualInstruction,
          temperature: 0.65,
        }
      });

      return res.json({ response: response.text });
    } catch (err: any) {
      console.error("Gemini server proxy error:", err);
      return res.status(500).json({ error: err.message || "An error occurred during generation." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start custom server:", err);
});
