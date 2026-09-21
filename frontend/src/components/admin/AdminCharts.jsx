import React, { useState } from 'react';

/**
 * Lightweight SVG-based Time Series Area Chart
 */
export const AdminAreaChart = ({
  data = [],
  color = '#6366f1',
  gradientFrom = '#6366f1',
  gradientTo = '#818cf8',
  height = 220,
  valuePrefix = '',
  valueSuffix = '',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
        No trend data available for selected period
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = 0;

  const width = 600;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingLeft = 35;
  const paddingRight = 15;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;

  const points = data.map((d, index) => {
    const x = paddingLeft + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, date: d.date, value: d.value };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x},${paddingTop + chartHeight} L ${points[0].x},${paddingTop + chartHeight} Z`;

  // Format short date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return dateStr;
  };

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.35" />
            <stop offset="100%" stopColor={gradientTo} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const gridVal = Math.round(minVal + (maxVal - minVal) * ratio);
          return (
            <g key={ratio}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono"
              >
                {gridVal > 999 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal}
              </text>
            </g>
          );
        })}

        {/* Filled Area */}
        <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />

        {/* Stroke Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

        {/* Data Interactive Points */}
        {points.map((pt, i) => (
          <g
            key={i}
            className="cursor-pointer group"
            onMouseEnter={() => setHoveredPoint(pt)}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.date === pt.date ? 5.5 : 2.5}
              fill={color}
              className="transition-all duration-150"
            />
            {/* Invisible larger target for touch/hover */}
            <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
          </g>
        ))}

        {/* X-axis labels (sampled) */}
        {points.map((pt, i) => {
          // Show up to 6 evenly spaced labels
          const step = Math.max(1, Math.floor(points.length / 5));
          if (i % step === 0 || i === points.length - 1) {
            return (
              <text
                key={i}
                x={pt.x}
                y={height - 8}
                textAnchor="middle"
                className="text-[9px] fill-slate-400 dark:fill-slate-500"
              >
                {formatDate(pt.date)}
              </text>
            );
          }
          return null;
        })}
      </svg>

      {/* Floating tooltip */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/90 text-white dark:bg-slate-800/95 dark:text-slate-100 text-xs px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700/50 whitespace-nowrap z-10"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            marginTop: '-8px',
          }}
        >
          <div className="font-semibold">
            {valuePrefix}{hoveredPoint.value.toLocaleString()}{valueSuffix}
          </div>
          <div className="text-[10px] text-slate-300 dark:text-slate-400">
            {hoveredPoint.date}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Lightweight SVG-based Bar Chart
 */
export const AdminBarChart = ({
  data = [],
  color = '#3b82f6',
  height = 180,
  valuePrefix = '',
  valueSuffix = '',
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
        No bar chart data available
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const width = 500;
  const paddingBottom = 25;
  const paddingTop = 15;
  const paddingLeft = 30;
  const paddingRight = 10;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;

  const barWidth = Math.max(4, Math.min(22, (chartWidth / data.length) * 0.65));
  const slotWidth = chartWidth / data.length;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = Math.max(2, (d.value / maxVal) * chartHeight);
          const x = paddingLeft + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = paddingTop + chartHeight - barHeight;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredBar({ ...d, x: x + barWidth / 2, y })}
              onMouseLeave={() => setHoveredBar(null)}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill={color}
                className="transition-all duration-150 hover:opacity-80"
              />
            </g>
          );
        })}

        {/* Base line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="1"
        />
      </svg>

      {hoveredBar && (
        <div
          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/90 text-white text-xs px-2 py-1 rounded shadow z-10 whitespace-nowrap"
          style={{
            left: `${(hoveredBar.x / width) * 100}%`,
            top: `${(hoveredBar.y / height) * 100}%`,
            marginTop: '-6px',
          }}
        >
          <span className="font-bold">{valuePrefix}{hoveredBar.value}{valueSuffix}</span>
          <span className="ml-1 text-[10px] text-slate-300">({hoveredBar.date || hoveredBar.label})</span>
        </div>
      )}
    </div>
  );
};
