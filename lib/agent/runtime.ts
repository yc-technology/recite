import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import { openaiClient } from "./client";

// Route the Agents SDK through our configured client so OPENAI_API_KEY and
// OPENAI_BASE_URL are honored. With a custom base URL (proxy / OpenAI-compatible
// gateway) use Chat Completions (most gateways lack the Responses API), and
// disable tracing (it phones home to OpenAI and is unreachable via gateways).
let configured = false;
export function configureSdk() {
  if (configured) return;
  setDefaultOpenAIClient(openaiClient());
  setTracingDisabled(true);
  if (process.env.OPENAI_BASE_URL) setOpenAIAPI("chat_completions");
  configured = true;
}

// SDK default model names are OpenAI's — gateways (DashScope, etc.) need an
// explicit model. Empty → SDK default.
export function modelOption() {
  return process.env.OPENAI_MODEL ? { model: process.env.OPENAI_MODEL } : {};
}
