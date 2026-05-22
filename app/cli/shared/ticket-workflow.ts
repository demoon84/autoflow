import {type ProjectContext} from "./context";
import {countTicketDirs} from "./counts";

export function ticketWorkflowMetrics(ctx: ProjectContext): Record<string, number> {
    const counts = countTicketDirs(ctx);
    const ticketTotal = Object.values(counts).reduce((total, value) => total + value, 0);
    const activeTicketCount = (counts.todo || 0) + (counts.inprogress || 0) + (counts.verifier || 0);
    return {
        spec_total: counts.prd || 0,
        ticket_total: ticketTotal,
        ticket_done_count: counts.done || 0,
        active_ticket_count: activeTicketCount,
        handoff_count: counts.verifier || 0,
        completion_rate_percent: ticketTotal > 0 ? Number((((counts.done || 0) / ticketTotal) * 100).toFixed(1)) : 0,
    };
}
