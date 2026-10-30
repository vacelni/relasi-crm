import { cx } from './ui';

/** The band a lead score falls in. The same thresholds as the stored temperature (lib/ai). */
export function heatOf(score: number): 'hot' | 'warm' | 'cold' {
  return score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
}

const fill = { hot: 'bg-heat-hot', warm: 'bg-heat-warm', cold: 'bg-heat-cold' } as const;

/**
 * Lead score as ten segments, one per ten points, filled in the colour of its band. Reads by length at a
 * glance in a list, and the number beside it stays the source of truth.
 */
export function HeatMeter({ score, size = 'sm', showValue = true }: { score: number; size?: 'sm' | 'lg'; showValue?: boolean }) {
  const filled = Math.round(score / 10);
  const heat = heatOf(score);
  return (
    <span className="inline-flex shrink-0 items-center gap-2" role="img" aria-label={`Lead score ${score} out of 100, ${heat}`}>
      <span aria-hidden="true" className={cx('flex', size === 'lg' ? 'gap-1' : 'gap-0.5')}>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cx(size === 'lg' ? 'h-3 w-4 rounded-[2px]' : 'h-2.5 w-1.5 rounded-[1px]', i < filled ? fill[heat] : 'bg-subtle')}
          />
        ))}
      </span>
      {showValue ? (
        <span aria-hidden="true" className={cx('text-right font-semibold tabular-nums', size === 'lg' ? 'text-2xl' : 'w-6 text-sm')}>
          {score}
        </span>
      ) : null}
    </span>
  );
}
