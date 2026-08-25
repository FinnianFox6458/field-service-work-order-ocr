import { createServer } from "node:http";
import { z } from "zod";
import { decideDispatch } from "./dispatch_decision.js";
import { InfraiError, ocrWorkOrder } from "./infrai_ocr.js";

const requestSchema = z.object({
  workOrderId: z.string().min(1).max(80),
  photoPdf: z.string().base64(),
  lang: z.string().min(2).max(24).optional()
}).strict();

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-orders/scan") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = requestSchema.parse(await readJson(request));
    const searchableText = await ocrWorkOrder(
      { pdf: input.photoPdf, lang: input.lang, quality: "accurate" },
      `work-order-${input.workOrderId}`
    );
    send(response, 200, decideDispatch(input.workOrderId, searchableText));
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid request body", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Work-order OCR service listening on http://localhost:${port}`));
}
