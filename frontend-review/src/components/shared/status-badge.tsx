import type { BookingStatus, ChatStatus, RequestStatus } from "../../data/mock-data";
import { Badge } from "../ui/badge";

type Status = BookingStatus | ChatStatus | RequestStatus;

export function StatusBadge({ status }: { status: Status }) {
  const variant =
    status === "Confirmed" || status === "Resolved" || status === "Approved"
      ? "success"
      : status === "Needs review" ||
          status === "Unresolved" ||
          status === "In review"
        ? "warning"
        : status === "Escalated"
          ? "danger"
          : "muted";

  return <Badge variant={variant}>{status}</Badge>;
}
