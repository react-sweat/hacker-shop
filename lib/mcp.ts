import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { z } from "zod";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const server = new McpServer({
  name: "hacker-shop-db",
  version: "1.0.0",
});

server.tool(
  "get_products",
  "Get a list of all products in the shop",
  {},
  async () => {
    const products = await prisma.product.findMany({
      include: { category: true },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
    };
  }
);

server.tool(
  "get_product_by_name",
  "Search for a product by name",
  {
    name: z.string().describe("The name or part of the name of the product to search for"),
  },
  async ({ name }) => {
    const products = await prisma.product.findMany({
      where: {
        name: {
          contains: name,
          mode: "insensitive",
        },
      },
      include: { category: true },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
    };
  }
);

server.tool(
  "get_categories",
  "Get all product categories",
  {},
  async () => {
    const categories = await prisma.category.findMany();
    return {
      content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hacker Shop MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP Server:", error);
  process.exit(1);
});
