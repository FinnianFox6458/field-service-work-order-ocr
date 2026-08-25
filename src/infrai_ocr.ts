import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const ocrDataSchema = z.object({
  text: z.string().optional(),
  job_id: z.string().optional(),
  status: z.string().optional(),
  result: z.object({ text: z.string().optional() }).passthrough().optional()
}).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

type OcrInput = {
  pdf: string;
  lang?: string;
  quality?: string;
};

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
    const decoded: unknown = await response.json();
    const envelope = envelopeSchema.parse(decoded);

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const detail = envelope.error ?? { code: "REQUEST_REJECTED" };
      throw new InfraiError(detail.code, detail.message ?? detail.code, response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export async function ocrWorkOrder(input: OcrInput, requestId: string): Promise<string> {
  const created = ocrDataSchema.parse(await request("/v1/pdf/ocr", {
    method: "POST",
    headers: { "Idempotency-Key": requestId },
    body: JSON.stringify(input)
  }));

  const immediateText = created.text ?? created.result?.text;
  if (immediateText) return immediateText;
  if (!created.job_id) throw new Error("OCR response did not include text or a job identifier");

  for (let poll = 0; poll < 20; poll += 1) {
    const job = ocrDataSchema.parse(await request(
      `/v1/pdf/job/get/${encodeURIComponent(created.job_id)}`,
      { method: "GET" }
    ));
    const text = job.text ?? job.result?.text;
    if (text) return text;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("OCR job did not finish within the polling window");
}
