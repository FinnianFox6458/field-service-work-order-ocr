export type DispatchStatus = "ready_for_dispatch" | "needs_technician_follow_up";

export type WorkOrderResult = {
  workOrderId: string;
  searchableText: string;
  dispatchStatus: DispatchStatus;
  followUpReason: string | null;
};

const followUpSignals = [
  /customer\s+signature\s*:\s*(?:missing|blank)/i,
  /parts?\s+(?:required|on order|unavailable)/i,
  /return\s+visit\s+(?:required|needed)/i,
  /unable\s+to\s+complete/i
];

export function decideDispatch(workOrderId: string, searchableText: string): WorkOrderResult {
  const signal = followUpSignals.find((pattern) => pattern.test(searchableText));
  return {
    workOrderId,
    searchableText,
    dispatchStatus: signal ? "needs_technician_follow_up" : "ready_for_dispatch",
    followUpReason: signal ? "The scanned notes contain an unresolved field-service marker." : null
  };
}
