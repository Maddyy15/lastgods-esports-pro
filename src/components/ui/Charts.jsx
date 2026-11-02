/**
 * ===========================================================================
 * CHARTS
 * ===========================================================================
 * Thin wrappers around Recharts so every chart in the app shares one look:
 * recessive grid lines, tabular numbers, the same tooltip, and a colour set
 * that was checked for colour-blind readability against our dark background.
 *
 * Two rules worth keeping if you edit these:
 *
 *  1. NEVER put two different measures on two y-axes in one chart. Kills and
 *     damage are on completely different scales — showing them on one plot
 *     makes the smaller line look flat and lies about the shape. Use two
 *     charts side by side instead (that is what the player profile does).
 *
 *  2. Series colours are assigned in a fixed order and are never recycled.
 *     Colour always means the same thing on every chart.
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts'
import { cx, num } from '@/lib/format'

/* ---------------------------------------------------------------------------
 * COLOURS
 * ---------------------------------------------------------------------------
 * Categorical — used when each line/bar is a different THING (points vs kills,
 * player A vs player B). Assigned in this order, never cycled. The first three
 * are safe together for every kind of colour blindness; charts in this app
 * never show more than three series at once.
 */
export const SERIES = ['#d97706', '#0284c7', '#16a34a', '#9333ea', '#dc2626']

/**
 * Sequential — used when the categories are ORDERED (placement brackets go
 * from best to worst). One hue, bright to dark, so the ranking is visible
 * even in greyscale.
 */
export const RAMP = ['#fcd34d', '#f3a712', '#d97706', '#b0600c', '#8f5213']

const GRID = '#232834'
const AXIS = '#8d95a6'

const AXIS_PROPS = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11, fontFamily: 'Inter, sans-serif' },
  tickLine: false,
  axisLine: { stroke: GRID },
}

/* ---------------------------------------------------------------------------
 * SHARED TOOLTIP
 * ------------------------------------------------------------------------- */
function ChartTooltip({ active, payload, label, unitFor }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="label mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.color }}
          />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto font-head font-semibold tabular-nums text-fg">
            {num(entry.value, Number.isInteger(entry.value) ? 0 : 1)}
            {unitFor?.(entry.dataKey) || ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * FRAME — title, height and the empty state, shared by every chart
 * ------------------------------------------------------------------------- */
export function ChartFrame({ title, subtitle, height = 260, children, action, empty, className }) {
  return (
    <div className={cx('card-base p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-head text-sm font-semibold text-fg">{title}</h3>}
            {subtitle && <p className="text-xs text-faint">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {empty ? (
        <div
          className="flex items-center justify-center text-sm text-faint"
          style={{ height }}
        >
          {typeof empty === 'string' ? empty : 'Not enough data yet'}
        </div>
      ) : (
        <div style={{ height, width: '100%' }}>{children}</div>
      )}
    </div>
  )
}

const legendStyle = {
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
  color: AXIS,
  paddingTop: 6,
}

/* ---------------------------------------------------------------------------
 * TREND LINE — one or more measures over the last N matches
 * ---------------------------------------------------------------------------
 * `series` = [{ key: 'points', label: 'Points' }, ...]
 * Keep the measures comparable (points and kills are both small counts).
 * ------------------------------------------------------------------------- */
export function TrendLine({
  data,
  series,
  xKey = 'label',
  height = 260,
  title,
  subtitle,
  action,
  className,
}) {
  const empty = !data || data.length < 2

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      action={action}
      empty={empty}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...AXIS_PROPS} width={46} allowDecimals={false} />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
          />
          {series.length > 1 && <Legend wrapperStyle={legendStyle} iconType="plainline" />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color || SERIES[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#13161c' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------------------------
 * BAR CHART — one measure across categories (maps, drop spots, players)
 * ------------------------------------------------------------------------- */
export function BarCompare({
  data,
  dataKey,
  xKey = 'name',
  label,
  height = 260,
  title,
  subtitle,
  color = SERIES[0],
  showValues = true,
  decimals = 0,
  horizontal = false,
  action,
  className,
}) {
  const empty = !data || !data.length

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      action={action}
      empty={empty}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 14, right: 16, left: horizontal ? 8 : -16, bottom: 0 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" {...AXIS_PROPS} />
              <YAxis type="category" dataKey={xKey} {...AXIS_PROPS} width={92} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...AXIS_PROPS} interval={0} />
              <YAxis {...AXIS_PROPS} width={46} />
            </>
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar
            dataKey={dataKey}
            name={label || dataKey}
            fill={color}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          >
            {showValues && (
              <LabelList
                dataKey={dataKey}
                position={horizontal ? 'right' : 'top'}
                formatter={(v) => num(v, decimals)}
                style={{ fill: AXIS, fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------------------------
 * ORDERED BAR — categories that have a natural best-to-worst order, coloured
 * with the sequential ramp. Used for the placement distribution.
 * ------------------------------------------------------------------------- */
export function OrdinalBar({
  data,
  height = 230,
  title,
  subtitle,
  dataKey = 'value',
  xKey = 'name',
  className,
}) {
  const empty = !data || !data.some((d) => d[dataKey] > 0)

  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} interval={0} />
          <YAxis {...AXIS_PROPS} width={42} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey={dataKey} name="Matches" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry[xKey]} fill={RAMP[i] || RAMP[RAMP.length - 1]} />
            ))}
            <LabelList
              dataKey={dataKey}
              position="top"
              formatter={(v) => (v > 0 ? v : '')}
              style={{ fill: AXIS, fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------------------------
 * PLACEMENT TREND — lower is better, so the axis is flipped. A reference line
 * marks the top-5 cut, which is the line that matters in BGMI points formats.
 * ------------------------------------------------------------------------- */
export function PlacementTrend({
  data,
  height = 230,
  title,
  subtitle,
  maxTeams = 16,
  className,
}) {
  const empty = !data || data.length < 2

  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis
            {...AXIS_PROPS}
            width={38}
            reversed
            domain={[1, maxTeams]}
            allowDecimals={false}
          />
          <ReferenceLine y={5} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
          <Line
            type="monotone"
            dataKey="placement"
            name="Placement"
            stroke={SERIES[0]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: SERIES[0] }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#13161c' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------------------------
 * RADAR — a player's skill profile, or two players overlaid for comparison
 * ---------------------------------------------------------------------------
 * `series` = [{ key: 'a', label: 'LG-REAPER' }, { key: 'b', label: 'LG-HAWK' }]
 * `data`   = [{ axis: 'Fragging', a: 82, b: 61 }, ...]
 * ------------------------------------------------------------------------- */
export function SkillRadar({ data, series, height = 300, title, subtitle, className }) {
  const empty = !data || !data.length

  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: AXIS, fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: '#5c6476', fontSize: 9 }}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip content={<ChartTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={legendStyle} />}
          {series.map((s, i) => (
            <Radar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color || SERIES[i]}
              fill={s.color || SERIES[i]}
              fillOpacity={0.22}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------------------------
 * SPARKLINE — a tiny inline trend with no axes, for cards and table rows
 * ------------------------------------------------------------------------- */
export function Sparkline({ data, dataKey = 'value', color = SERIES[0], height = 36 }) {
  if (!data || data.length < 2) return <div style={{ height }} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
