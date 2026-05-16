import * as React from "react";
import { Target, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ArrivalMetrics {
  // Total unique retry_fingerprints accumulated in order queue
  uniqueFingerprintCount: number;
  // Max occurrences of any single fingerprint
  maxFingerprintRepeat: number;
  // Adapter timeout ratio (0–1) in last 24h (from wake-poll.log / tokens log)
  timeoutRatio: number;
  // Average ticket pass time in minutes (estimated from token logs)
  avgPassMinutes: number;
  // Total retry orders in order queue
  retryOrderCount: number;
}

interface ArrivalGaugeProps {
  metrics: ArrivalMetrics | null;
  className?: string;
}

function estimateAttemptsRemaining(m: ArrivalMetrics): number {
  // Simple heuristic: base 3 attempts, add fingerprint repeats and timeout penalty
  const fingerprintPenalty = m.maxFingerprintRepeat > 1 ? m.maxFingerprintRepeat - 1 : 0;
  const timeoutPenalty = Math.round(m.timeoutRatio * 5);
  const base = Math.max(1, 3 - m.maxFingerprintRepeat + fingerprintPenalty + timeoutPenalty);
  return Math.min(base, 10);
}

function gaugeColor(m: ArrivalMetrics): "ok" | "warning" | "critical" {
  if (m.maxFingerprintRepeat >= 3 || m.timeoutRatio >= 0.1) return "critical";
  if (m.maxFingerprintRepeat >= 2 || m.timeoutRatio >= 0.05 || m.retryOrderCount >= 3) return "warning";
  return "ok";
}

function GaugeBar({ fill, color }: { fill: number; color: "ok" | "warning" | "critical" }) {
  const colorClass =
    color === "critical"
      ? "bg-red-500"
      : color === "warning"
      ? "bg-yellow-500"
      : "bg-emerald-500";
  return (
    <div
      className="relative h-2 w-full rounded-full bg-muted overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(fill * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-500", colorClass)}
        style={{ width: `${Math.min(100, Math.round(fill * 100))}%` }}
      />
    </div>
  );
}

function StatusIcon({ color }: { color: "ok" | "warning" | "critical" }) {
  if (color === "critical") return <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />;
  if (color === "warning") return <TrendingDown className="h-4 w-4 text-yellow-500" aria-hidden="true" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
}

export function ArrivalGauge({ metrics, className }: ArrivalGaugeProps) {
  const [showPopover, setShowPopover] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  if (!metrics) {
    return (
      <div className={cn("arrival-gauge arrival-gauge--loading flex items-center gap-2 text-muted-foreground text-xs", className)}>
        <Target className="h-4 w-4" aria-hidden="true" />
        <span>도착 게이지 로딩 중…</span>
      </div>
    );
  }

  const attemptsLeft = estimateAttemptsRemaining(metrics);
  const color = gaugeColor(metrics);
  const fillRatio = Math.max(0, 1 - attemptsLeft / 10);

  const colorLabel = color === "critical" ? "위험" : color === "warning" ? "주의" : "정상";

  return (
    <div
      ref={containerRef}
      className={cn("arrival-gauge relative flex flex-col gap-1.5 p-3 rounded-lg border bg-card select-none", className)}
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`도착 게이지: 예상 ${attemptsLeft}회 남음, 상태 ${colorLabel}. 클릭하여 상세 보기`}
        aria-expanded={showPopover}
        onClick={() => setShowPopover((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Escape") setShowPopover(false); }}
      >
        <StatusIcon color={color} />
        <span className="text-xs font-medium flex-1">도착까지</span>
        <span className={cn(
          "text-sm font-bold tabular-nums",
          color === "critical" ? "text-red-500" : color === "warning" ? "text-yellow-600" : "text-emerald-600"
        )}>
          {attemptsLeft}회
        </span>
      </button>

      <GaugeBar fill={fillRatio} color={color} />

      {showPopover && (
        <div
          role="dialog"
          aria-label="도착 게이지 상세 지표"
          className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-1.5"
          onKeyDown={(e) => { if (e.key === "Escape") setShowPopover(false); }}
        >
          <p className="font-semibold text-sm mb-1">도착 게이지 상세</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">예상 남은 시도</span>
            <span className="font-medium">{attemptsLeft}회</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">재시도 주문 수</span>
            <span className={metrics.retryOrderCount >= 3 ? "text-red-500 font-medium" : "font-medium"}>
              {metrics.retryOrderCount}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">최다 fingerprint 반복</span>
            <span className={metrics.maxFingerprintRepeat >= 3 ? "text-red-500 font-medium" : "font-medium"}>
              {metrics.maxFingerprintRepeat}회
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timeout 비율 (24h)</span>
            <span className={metrics.timeoutRatio >= 0.1 ? "text-red-500 font-medium" : "font-medium"}>
              {Math.round(metrics.timeoutRatio * 100)}%
            </span>
          </div>
          {metrics.avgPassMinutes > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">평균 pass 시간</span>
              <span className="font-medium">{metrics.avgPassMinutes}분</span>
            </div>
          )}
          <div className={cn(
            "mt-1 pt-1 border-t text-center font-semibold",
            color === "critical" ? "text-red-500" : color === "warning" ? "text-yellow-600" : "text-emerald-600"
          )}>
            상태: {colorLabel}
          </div>
        </div>
      )}
    </div>
  );
}
