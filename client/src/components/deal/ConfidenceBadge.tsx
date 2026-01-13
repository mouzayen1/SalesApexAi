// client/src/components/deal/ConfidenceBadge.tsx
// Phase 3: Confidence Badge for Bank-First Triage Results

interface ConfidenceBadgeProps {
  mode: 'profit' | 'survival' | null;
  badge: string;
  reason: string;
}

export default function ConfidenceBadge({ mode, badge, reason }: ConfidenceBadgeProps) {
  if (!mode || !badge) {
    return null;
  }

  // Style based on mode
  const getModeStyles = () => {
    if (mode === 'profit') {
      return {
        container: 'bg-gradient-to-r from-green-900/30 to-emerald-800/20 border-green-500/50',
        badge: 'bg-green-600/80 text-green-100',
        text: 'text-green-200',
        modeLabel: 'text-green-300',
      };
    }
    // survival mode
    return {
      container: 'bg-gradient-to-r from-amber-900/30 to-orange-800/20 border-amber-500/50',
      badge: 'bg-amber-600/80 text-amber-100',
      text: 'text-amber-200',
      modeLabel: 'text-amber-300',
    };
  };

  const styles = getModeStyles();

  return (
    <div className={`mt-3 rounded-lg border ${styles.container} p-2.5`}>
      <div className="flex items-center gap-2">
        {/* Badge pill */}
        <span className={`inline-flex items-center rounded-full ${styles.badge} px-2.5 py-0.5 text-xs font-semibold`}>
          {badge}
        </span>

        {/* Mode indicator */}
        <span className={`text-xs font-medium ${styles.modeLabel} uppercase tracking-wide`}>
          {mode === 'profit' ? 'Profit Mode' : 'Survival Mode'}
        </span>
      </div>

      {/* Reason text */}
      <p className={`mt-1.5 text-xs ${styles.text}`}>
        {reason}
      </p>
    </div>
  );
}
