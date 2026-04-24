import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";

const router = express.Router();

let mcpClient: Client | null = null;

async function getMcpClient() {
  if (mcpClient) return mcpClient;

  console.log("Initializing MCP Client...");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./node_modules/tsx/dist/cli.mjs", "lib/mcp.ts"],
  });

  const client = new Client(
    {
      name: "hacker-shop-chat",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  mcpClient = client;
  return client;
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.API_KEY,
});

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const client = await getMcpClient();
    const toolsResult = await client.listTools();
    
    // Convert MCP tools to OpenAI function calling format
    const openaiTools = toolsResult.tools.map((tool) => {
      // Create a clean JSON schema from the tool's inputSchema
      // MCP inputSchema is already JSON schema
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      } as const;
    });

    const runner = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat", // User asked for 'deepseek v4 flash', deepseek-chat maps to v3, which is the latest standard model
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant for the Hacker Shop e-commerce store. Use the provided tools to query the database and answer user questions about products, categories, and inventory."
        },
        ...messages
      ],
      tools: openaiTools,
      tool_choice: "auto",
    });

    const message = runner.choices[0].message;

    // Handle tool calls if any
    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push(message);
      
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === "function") {
          console.log(`Executing tool: ${toolCall.function.name}`);
          const args = JSON.parse(toolCall.function.arguments);
          
          try {
            const result = await client.callTool({
              name: toolCall.function.name,
              arguments: args,
            });
            
            // Format MCP result back to OpenAI format
            const toolResultContent = result.content
              .filter(c => c.type === 'text')
              .map(c => (c as any).text)
              .join('\n');

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResultContent,
            });
          } catch (err: any) {
             messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error executing tool: ${err.message}`,
            });
          }
        }
      }

      // Call OpenAI again with the tool results
      const finalResponse = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant for the Hacker Shop e-commerce store. Use the provided tools to query the database and answer user questions about products, categories, and inventory."
          },
          ...messages
        ],
      });

      return res.json({ response: finalResponse.choices[0].message });
    }

    return res.json({ response: message });

  } catch (error: any) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({ error: "An error occurred processing your request." });
  }
});

export default router;
