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
  return (
    <div
      className="arrival-gauge-track"
      role="progressbar"
      aria-valuenow={Math.round(fill * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("arrival-gauge-fill", `arrival-gauge-fill-${color}`)}
        style={{ width: `${Math.min(100, Math.round(fill * 100))}%` }}
      />
    </div>
  );
}

function StatusIcon({ color }: { color: "ok" | "warning" | "critical" }) {
  const className = cn("arrival-gauge-status-icon", `arrival-gauge-status-icon-${color}`);
  if (color === "critical") return <AlertTriangle className={className} aria-hidden="true" />;
  if (color === "warning") return <TrendingDown className={className} aria-hidden="true" />;
  return <CheckCircle2 className={className} aria-hidden="true" />;
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
      <div className={cn("arrival-gauge arrival-gauge-loading", className)}>
        <Target className="arrival-gauge-status-icon" aria-hidden="true" />
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
      className={cn("arrival-gauge", `arrival-gauge-${color}`, className)}
    >
      <button
        type="button"
        className="arrival-gauge-trigger"
        aria-label={`도착 게이지: 예상 ${attemptsLeft}회 남음, 상태 ${colorLabel}. 클릭하여 상세 보기`}
        aria-expanded={showPopover}
        onClick={() => setShowPopover((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Escape") setShowPopover(false); }}
      >
        <StatusIcon color={color} />
        <span className="arrival-gauge-label">도착까지</span>
        <span className={cn("arrival-gauge-value", `arrival-gauge-value-${color}`)}>
          {attemptsLeft}회
        </span>
      </button>

      <GaugeBar fill={fillRatio} color={color} />

      {showPopover && (
        <div
          role="dialog"
          aria-label="도착 게이지 상세 지표"
          className="arrival-gauge-popover"
          onKeyDown={(e) => { if (e.key === "Escape") setShowPopover(false); }}
        >
          <p className="arrival-gauge-popover-title">도착 게이지 상세</p>
          <div className="arrival-gauge-popover-row">
            <span>예상 남은 시도</span>
            <strong>{attemptsLeft}회</strong>
          </div>
          <div className="arrival-gauge-popover-row">
            <span>재시도 주문 수</span>
            <strong className={metrics.retryOrderCount >= 3 ? "arrival-gauge-danger" : ""}>
              {metrics.retryOrderCount}개
            </strong>
          </div>
          <div className="arrival-gauge-popover-row">
            <span>최다 fingerprint 반복</span>
            <strong className={metrics.maxFingerprintRepeat >= 3 ? "arrival-gauge-danger" : ""}>
              {metrics.maxFingerprintRepeat}회
            </strong>
          </div>
          <div className="arrival-gauge-popover-row">
            <span>Timeout 비율 (24h)</span>
            <strong className={metrics.timeoutRatio >= 0.1 ? "arrival-gauge-danger" : ""}>
              {Math.round(metrics.timeoutRatio * 100)}%
            </strong>
          </div>
          {metrics.avgPassMinutes > 0 && (
            <div className="arrival-gauge-popover-row">
              <span>평균 pass 시간</span>
              <strong>{metrics.avgPassMinutes}분</strong>
            </div>
          )}
          <div className={cn("arrival-gauge-state", `arrival-gauge-state-${color}`)}>
            상태: {colorLabel}
          </div>
        </div>
      )}
    </div>
  );
}
