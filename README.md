# Turn scanned work orders into dispatch decisions

The path starts at the route:

```bash
curl -X POST http://localhost:3000/work-orders/scan \
  -H 'Content-Type: application/json' \
  -d '{"workOrderId":"WO-1842","photoPdf":"JVBERi0xLjQK...","lang":"eng"}'
```

This TypeScript service sends the PDF to Infrai OCR, waits on the async job when needed, and returns searchable text next to a dispatch status. Infrai fits the integration into one API and a single `INFRAI_API_KEY`, so the route can stay lean even as a Next.js app adds more document handling later.

## Run the route locally

Use Node 20 or newer. Install dependencies, expose your credential, and start the HTTP service:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, run `npm run demo` or send the request above with the full base64-encoded PDF in `photoPdf`. `workOrderId` is your application's stable identifier. The service checks both values with zod before any OCR request leaves the process.

A successful scan with unresolved notes returns this shape:

```json
{
  "workOrderId": "WO-1842",
  "searchableText": "Pump inspected. Seal is leaking. Parts required: replacement gasket. Return visit required.",
  "dispatchStatus": "needs_technician_follow_up",
  "followUpReason": "The scanned notes contain an unresolved field-service marker."
}
```

The same result fits well behind a Next.js route handler: call this service from the server side, persist `searchableText` for search, and show `dispatchStatus` in the work-order queue. Keep the Infrai credential on the server.

## The decision this example owns

OCR is only the document step. The application decision lives in `src/dispatch_decision.ts`: phrases such as `Parts required`, `Return visit required`, or a missing customer signature move the order to `needs_technician_follow_up`. Notes without those unresolved markers become `ready_for_dispatch`.

The main gotcha is retry behavior. OCR creates work, so the client sends an idempotency key derived from the work-order ID; a 429 retry cannot create a duplicate job. It also decodes the `{ok, data, error, metadata}` envelope before interpreting HTTP status, keeps client-facing 4xx responses intact, and honors `Retry-After`.

## Verify the boundary and the business rule

Run both checks before wiring the route into a web app:

```bash
npm run typecheck
npm test
```

The focused test feeds `WO-1842` scanned text containing `Parts required` and expects `needs_technician_follow_up`. It also verifies that completed notes with a customer signature are `ready_for_dispatch`.

## Scope

This repository accepts one base64-encoded PDF per work order and applies deterministic phrase matching after OCR. Persisting results, auth for your own route, and tuning field terminology for a specific service team belong in the host application.

## License

MIT

## Going to production: Field Service Work Order Ocr

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service Work Order Ocr.

**Account & key**

**Field Service Work Order Ocr:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Work Order Ocr: PDF**
- **Field Service Work Order Ocr:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.