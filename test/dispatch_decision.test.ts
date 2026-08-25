import assert from "node:assert/strict";
import test from "node:test";
import { decideDispatch } from "../src/dispatch_decision.js";

test("routes an incomplete scanned work order to technician follow-up", () => {
  const result = decideDispatch(
    "WO-1842",
    "Pump inspected. Seal is leaking. Parts required: replacement gasket. Return visit required."
  );

  assert.equal(result.dispatchStatus, "needs_technician_follow_up");
  assert.equal(result.workOrderId, "WO-1842");
  assert.match(result.followUpReason ?? "", /unresolved field-service marker/);
});

test("marks a completed work order ready for dispatch", () => {
  const result = decideDispatch(
    "WO-1843",
    "Filter replaced and pressure checked. Customer signature: Dana Lee. Job complete."
  );

  assert.equal(result.dispatchStatus, "ready_for_dispatch");
  assert.equal(result.followUpReason, null);
});
