// Brains order (same free/native/secure pattern as Luna Camp 2D):
//   1) telephanti.com free_minds — camp banter + agent chat (no visitor keys, CORS open)
//   2) Optional telephantim-ai / local server.py (Ollama · Groq · Grok)
//   3) Browser-native mind (Chrome Prompt API / WebLLM)
//   4) Scripted dual duel
// Local server.py: set TELEPHANTIM_API to "" for same-origin /api/*
window.TELEPHANTIM_API = "https://telephantim-ai.onrender.com";

// Optional WebLLM model id (open-source, downloads once, caches in browser)
// window.TELEPHANTIM_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// Google Analytics 4 — Measurement ID (Admin → Data streams → Web → Measurement ID)
// Same property as Luna Camp by default. Set to "" to disable tracking.
window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
