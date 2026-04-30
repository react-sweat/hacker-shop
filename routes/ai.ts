import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// ---------------------------------------------------------------------------
// MCP client with auto-reconnect
// ---------------------------------------------------------------------------
let mcpClient: Client | null = null;

async function getMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  console.log("Initializing MCP Client...");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./node_modules/tsx/dist/cli.mjs", "lib/mcp.ts"],
  });

  const client = new Client(
    { name: "hacker-shop-chat", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  mcpClient = client;
  return client;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  let client: Client;
  try {
    client = await getMcpClient();
  } catch (err: any) {
    mcpClient = null;
    throw new Error(`MCP connect failed: ${err.message}`);
  }

  try {
    const result = await client.callTool({ name, arguments: args });
    return result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  } catch (err: any) {
    mcpClient = null;
    throw new Error(`MCP tool "${name}" failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible client (OpenRouter)
// ---------------------------------------------------------------------------
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.API_KEY,
});

const MODEL = "deepseek/deepseek-chat";

const SYSTEM_PROMPT =
  "You are a helpful AI assistant for the Hacker Shop e-commerce store. " +
  "Use the provided tools to query the database and answer user questions about products, categories, and inventory.";

// ---------------------------------------------------------------------------
// Shared helper: run one AI turn (with tool-call loop)
// ---------------------------------------------------------------------------
async function runAiTurn(messages: any[]): Promise<any> {
  let client: Client;
  try {
    client = await getMcpClient();
  } catch {
    mcpClient = null;
    throw new Error("MCP server unavailable");
  }

  const toolsResult = await client.listTools();
  const openaiTools = toolsResult.tools.map((tool: any) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    tools: openaiTools,
    tool_choice: "auto",
  });

  const message = completion.choices[0].message;

  if (!message.tool_calls || message.tool_calls.length === 0) {
    return message;
  }

  // Execute all tool calls
  const toolMessages: any[] = [message];
  for (const toolCall of message.tool_calls) {
    if (toolCall.type !== "function") continue;
    const args = JSON.parse(toolCall.function.arguments);
    let content: string;
    try {
      content = await callTool(toolCall.function.name, args);
    } catch (err: any) {
      content = `Error: ${err.message}`;
    }
    toolMessages.push({ role: "tool", tool_call_id: toolCall.id, content });
  }

  const finalCompletion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages, ...toolMessages],
  });

  return finalCompletion.choices[0].message;
}

// ---------------------------------------------------------------------------
// POST /  — used by frontend ChatAssistant ({ messages: Message[] })
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const response = await runAiTurn(messages);
    return res.json({ response });
  } catch (error: any) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({ error: "An error occurred processing your request." });
  }
});

// ---------------------------------------------------------------------------
// POST /chat — used by Telegram bot ({ message: string, sessionId?: string })
// ---------------------------------------------------------------------------
interface TelegramSession {
  history: any[];
  lastActivity: number;
}

const sessions = new Map<string, TelegramSession>();
const SESSION_TIMEOUT = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivity > SESSION_TIMEOUT) sessions.delete(id);
  }
}, 5 * 60 * 1000);

router.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    let currentSessionId = sessionId;
    if (!currentSessionId || !sessions.has(currentSessionId)) {
      currentSessionId = uuidv4();
      sessions.set(currentSessionId, { history: [], lastActivity: Date.now() });
    }

    const session = sessions.get(currentSessionId)!;
    session.lastActivity = Date.now();
    session.history.push({ role: "user", content: message.trim() });

    const response = await runAiTurn(session.history);

    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    session.history.push({ role: "assistant", content });

    return res.json({ response: content, sessionId: currentSessionId });
  } catch (error: any) {
    console.error("Error in /ai/chat endpoint:", error);
    res.status(500).json({ error: "An error occurred processing your request." });
  }
});

export default router;
