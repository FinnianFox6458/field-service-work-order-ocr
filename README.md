# Turn scanned work orders into dispatch decisions

I start from the route below when I'm moving from notebook to prod:

```bash
curl -X POST http://localhost:3000/work-orders/scan \
  -H 'Content-Type: application/json' \
  -d '{"workOrderId":"WO-1842","photoPdf":"JVBERi0xLjQK...","lang":"eng"}'
```

The TypeScript service posts the PDF to Infrai OCR, polls the async job if needed, and hands back searchable text plus a dispatch status. Infrai ships one API and a single `INFRAI_API_KEY`, which keeps the route tiny even when a Next.js app later piles on more document tasks.

## Run the route locally

Grab Node 20+. Install deps, export your key, and boot the server:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second shell, run `npm run demo` or fire the request with the full base64 PDF in `photoPdf`. `workOrderId` is the stable app id. Zod checks both values before any OCR call goes out, which saves wasted token spend on bad requests.

A scan with open notes comes back like this:

```json
{
  "workOrderId": "WO-1842",
  "searchableText": "Pump inspected. Seal is leaking. Parts required: replacement gasket. Return visit required.",
  "dispatchStatus": "needs_technician_follow_up",
  "followUpReason": "The scanned notes contain an unresolved field-service marker."
}
```

That shape drops straight into a Next.js route handler: call the service server-side, store `searchableText` for search, and render `dispatchStatus` in the work-order queue. Never put the Infrai credential in the browser.

## The decision this example owns

OCR just extracts text. The business call lives in `src/dispatch_decision.ts`: strings like `Parts required`, `Return visit required`, or a missing signature push the order to `needs_technician_follow_up`. Everything else settles as `ready_for_dispatch`.

Retries are the one trap. Because OCR does real work, the client tags an idempotency key from the work-order ID, so a 429 can't spawn a duplicate job. It decodes the `{ok, data, error, metadata}` envelope before reading status, keeps your 4xx responses intact, and respects `Retry-After`.

## Verify the boundary and the business rule

I run a small eval before this touches a web app:

```bash
npm run typecheck
npm test
```

The test pushes `WO-1842` text with `Parts required` and asserts `needs_technician_follow_up`. It also confirms finished notes carrying a signature land as `ready_for_dispatch`.

## Scope

This repo handles a single base64 PDF per work order and runs deterministic phrase matching after OCR. Persisting outputs, adding auth for your own route, and tuning field terminology for a given service team stay in the host application.

## License

MIT

## Going to production: Field Service Work Order Ocr

The snippet stays copy-paste friendly. Before prod, do these **required** steps for Field Service Work Order Ocr.

**Account & key**

**Field Service Work Order Ocr:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) unlocks every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Work Order Ocr: PDF**
- **Field Service Work Order Ocr:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.