// Optional cloud dual-brain API (Render). When dead / out of credits, the page uses a
// FREE closed mind in the browser (Chrome Prompt API or WebLLM) then scripted duel.
// Local server.py: set to "" for same-origin /api/*
window.TELEPHANTIM_API = "https://telephantim-ai.onrender.com";

// Optional WebLLM model id (open-source, downloads once, caches in browser)
// window.TELEPHANTIM_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// Google Analytics 4 — Measurement ID (Admin → Data streams → Web → Measurement ID)
// Same property as Luna Camp by default. Set to "" to disable tracking.
window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
