import { Loader2 } from "lucide-react";

export function FullPageLoading({
  open,
  label = "로딩 중"
}: {
  open: boolean;
  label?: string;
}) {
  if (!open) return null;

  return (
    <div className="full-page-loading" role="status" aria-live="polite" aria-label={label}>
      <Loader2 className="full-page-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
