import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { ItemsResponseSchema } from "../plugins/schema-registry.js";
import { buildLinkHeader, type Cursor, decodeCursor, encodeCursor } from "../utils/pagination.js";

const CategoryEnum = Type.Union([
  Type.Literal("electronics"),
  Type.Literal("tools"),
  Type.Literal("accessories"),
  Type.Literal("robotics"),
  Type.Literal("power"),
  Type.Literal("components"),
]);

type Category = "electronics" | "tools" | "accessories" | "robotics" | "power" | "components";

interface Item {
  id: string;
  name: string;
  category: Category;
  price: number;
  inStock: boolean;
  createdAt: string;
  description: string;
}

const ItemsQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  category: Type.Optional(CategoryEnum),
});

const MOCK_ITEMS: Item[] = [
  {
    id: "item-001",
    name: "Alpha Widget",
    category: "electronics",
    price: 29.99,
    inStock: true,
    createdAt: "2024-01-15T10:30:00.000Z",
    description: "A versatile electronic widget for everyday use",
  },
  {
    id: "item-002",
    name: "Beta Gadget",
    category: "electronics",
    price: 49.99,
    inStock: true,
    createdAt: "2024-01-16T11:00:00.000Z",
    description: "Advanced gadget with smart features",
  },
  {
    id: "item-003",
    name: "Gamma Tool",
    category: "tools",
    price: 15.5,
    inStock: false,
    createdAt: "2024-01-17T09:15:00.000Z",
    description: "Precision tool for professional work",
  },
  {
    id: "item-004",
    name: "Delta Component",
    category: "electronics",
    price: 8.99,
    inStock: true,
    createdAt: "2024-01-18T14:45:00.000Z",
    description: "Essential component for electronics projects",
  },
  {
    id: "item-005",
    name: "Epsilon Sensor",
    category: "electronics",
    price: 34.99,
    inStock: true,
    createdAt: "2024-01-19T08:00:00.000Z",
    description: "High-precision environmental sensor",
  },
  {
    id: "item-006",
    name: "Zeta Cable",
    category: "accessories",
    price: 12.99,
    inStock: true,
    createdAt: "2024-01-20T16:30:00.000Z",
    description: "Premium quality data cable",
  },
  {
    id: "item-007",
    name: "Eta Adapter",
    category: "accessories",
    price: 9.99,
    inStock: false,
    createdAt: "2024-01-21T10:00:00.000Z",
    description: "Universal power adapter",
  },
  {
    id: "item-008",
    name: "Theta Board",
    category: "electronics",
    price: 89.99,
    inStock: true,
    createdAt: "2024-01-22T11:30:00.000Z",
    description: "Development board for prototyping",
  },
  {
    id: "item-009",
    name: "Iota Switch",
    category: "electronics",
    price: 5.99,
    inStock: true,
    createdAt: "2024-01-23T09:45:00.000Z",
    description: "Tactile push button switch",
  },
  {
    id: "item-010",
    name: "Kappa Display",
    category: "electronics",
    price: 45.99,
    inStock: true,
    createdAt: "2024-01-24T13:00:00.000Z",
    description: "OLED display module",
  },
  {
    id: "item-011",
    name: "Lambda Motor",
    category: "robotics",
    price: 24.99,
    inStock: true,
    createdAt: "2024-01-25T08:30:00.000Z",
    description: "DC motor for robotics projects",
  },
  {
    id: "item-012",
    name: "Mu Servo",
    category: "robotics",
    price: 18.99,
    inStock: false,
    createdAt: "2024-01-26T15:00:00.000Z",
    description: "High-torque servo motor",
  },
  {
    id: "item-013",
    name: "Nu Battery",
    category: "power",
    price: 14.99,
    inStock: true,
    createdAt: "2024-01-27T10:15:00.000Z",
    description: "Rechargeable lithium battery pack",
  },
  {
    id: "item-014",
    name: "Xi Charger",
    category: "power",
    price: 22.99,
    inStock: true,
    createdAt: "2024-01-28T11:45:00.000Z",
    description: "Smart battery charger",
  },
  {
    id: "item-015",
    name: "Omicron Relay",
    category: "electronics",
    price: 7.99,
    inStock: true,
    createdAt: "2024-01-29T09:00:00.000Z",
    description: "5V relay module",
  },
  {
    id: "item-016",
    name: "Pi Controller",
    category: "electronics",
    price: 55.99,
    inStock: true,
    createdAt: "2024-01-30T14:30:00.000Z",
    description: "Microcontroller board",
  },
  {
    id: "item-017",
    name: "Rho Resistor Kit",
    category: "components",
    price: 11.99,
    inStock: true,
    createdAt: "2024-02-01T08:00:00.000Z",
    description: "Assorted resistor pack",
  },
  {
    id: "item-018",
    name: "Sigma Capacitor Set",
    category: "components",
    price: 13.99,
    inStock: true,
    createdAt: "2024-02-02T10:30:00.000Z",
    description: "Electrolytic capacitor assortment",
  },
  {
    id: "item-019",
    name: "Tau LED Pack",
    category: "components",
    price: 6.99,
    inStock: true,
    createdAt: "2024-02-03T11:00:00.000Z",
    description: "Multi-color LED assortment",
  },
  {
    id: "item-020",
    name: "Upsilon Wire Set",
    category: "accessories",
    price: 8.99,
    inStock: false,
    createdAt: "2024-02-04T09:15:00.000Z",
    description: "Jumper wire kit",
  },
  {
    id: "item-021",
    name: "Phi Breadboard",
    category: "tools",
    price: 4.99,
    inStock: true,
    createdAt: "2024-02-05T13:45:00.000Z",
    description: "Solderless breadboard",
  },
  {
    id: "item-022",
    name: "Chi Soldering Iron",
    category: "tools",
    price: 35.99,
    inStock: true,
    createdAt: "2024-02-06T10:00:00.000Z",
    description: "Temperature-controlled soldering station",
  },
  {
    id: "item-023",
    name: "Psi Multimeter",
    category: "tools",
    price: 42.99,
    inStock: true,
    createdAt: "2024-02-07T11:30:00.000Z",
    description: "Digital multimeter with auto-ranging",
  },
  {
    id: "item-024",
    name: "Omega Oscilloscope",
    category: "tools",
    price: 299.99,
    inStock: true,
    createdAt: "2024-02-08T14:00:00.000Z",
    description: "Portable digital oscilloscope",
  },
  {
    id: "item-025",
    name: "Alpha Pro Widget",
    category: "electronics",
    price: 59.99,
    inStock: true,
    createdAt: "2024-02-09T08:30:00.000Z",
    description: "Professional-grade widget with extended features",
  },
  {
    id: "item-026",
    name: "Beta Max Gadget",
    category: "electronics",
    price: 79.99,
    inStock: false,
    createdAt: "2024-02-10T09:00:00.000Z",
    description: "Maximum performance gadget",
  },
  {
    id: "item-027",
    name: "Gamma Plus Tool",
    category: "tools",
    price: 25.99,
    inStock: true,
    createdAt: "2024-02-11T10:15:00.000Z",
    description: "Enhanced precision tool",
  },
  {
    id: "item-028",
    name: "Delta Ultra Component",
    category: "electronics",
    price: 16.99,
    inStock: true,
    createdAt: "2024-02-12T11:45:00.000Z",
    description: "Ultra-reliable component",
  },
  {
    id: "item-029",
    name: "Epsilon HD Sensor",
    category: "electronics",
    price: 54.99,
    inStock: true,
    createdAt: "2024-02-13T13:00:00.000Z",
    description: "High-definition sensor array",
  },
  {
    id: "item-030",
    name: "Zeta Premium Cable",
    category: "accessories",
    price: 19.99,
    inStock: true,
    createdAt: "2024-02-14T15:30:00.000Z",
    description: "Gold-plated premium cable",
  },
];

const CURSOR_TYPE = "item";

function validateCursor(fastify: FastifyInstance, encodedCursor: string | undefined): Cursor {
  const cursor = decodeCursor(encodedCursor);
  if (cursor === null) {
    throw fastify.httpErrors.badRequest("invalid cursor format");
  }
  if (cursor.type && cursor.type !== CURSOR_TYPE) {
    throw fastify.httpErrors.badRequest("cursor type mismatch");
  }
  return cursor;
}

function findStartIndex(fastify: FastifyInstance, items: Item[], cursor: Cursor): number {
  if (!cursor.value) {
    return 0;
  }
  const cursorIndex = items.findIndex((item) => item.id === cursor.value);
  if (cursorIndex === -1) {
    throw fastify.httpErrors.badRequest("cursor references unknown item");
  }
  return cursorIndex + 1;
}

function buildPaginationCursors(
  items: Item[],
  pageItems: Item[],
  startIndex: number,
  limit: number,
): { nextCursor: string | undefined; prevCursor: string | undefined } {
  const hasNext = startIndex + limit < items.length;
  const hasPrev = startIndex > 0;

  const nextCursor = hasNext
    ? encodeCursor({ type: CURSOR_TYPE, value: pageItems[pageItems.length - 1].id })
    : undefined;
  const prevCursor = hasPrev ? encodeCursor({ type: CURSOR_TYPE, value: items[startIndex - 1].id }) : undefined;

  return { nextCursor, prevCursor };
}

const itemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/items",
    {
      schema: {
        description: "Returns a paginated list of items",
        summary: "List items",
        tags: ["Items"],
        querystring: ItemsQuerySchema,
        response: {
          200: ItemsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { cursor: encodedCursor, limit = 20, category } = request.query;

      const cursor = validateCursor(fastify, encodedCursor);
      const filtered = category ? MOCK_ITEMS.filter((item) => item.category === category) : MOCK_ITEMS;
      const startIndex = findStartIndex(fastify, filtered, cursor);
      const pageItems = filtered.slice(startIndex, startIndex + limit);
      const { nextCursor, prevCursor } = buildPaginationCursors(filtered, pageItems, startIndex, limit);

      const query = new URLSearchParams();
      if (category) query.set("category", category);
      query.set("limit", String(limit));

      const linkHeader = buildLinkHeader("/items", query, nextCursor, prevCursor);
      if (linkHeader) {
        reply.header("Link", linkHeader);
      }

      return { items: pageItems, total: filtered.length };
    },
  );
};

export default itemsRoutes;
