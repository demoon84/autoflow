export interface Check {
    id: string;
    status: string;
}

export const checks: Check[] = [];
export const errors: string[] = [];
export const warnings: string[] = [];

export function recordCheck(id: string, status: string): void {
    checks.push({id, status});
}

export function recordError(msg: string): void {
    errors.push(msg);
}

export function recordWarning(msg: string): void {
    warnings.push(msg);
}
