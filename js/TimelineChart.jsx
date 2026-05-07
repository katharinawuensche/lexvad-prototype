// TimelineChart — NEW: Variantenentwicklung im 20. Jahrhundert
// Animated multi-line area chart showing how variant % shifted over survey decades

const TimelineChart = ({ phenomenon }) => {
  const { useState, useEffect, useRef, useMemo } = React;
  const { VARIANTS, TEMPORAL_DATA, PHENOMENA } = window.LEXVAD;
  const [hoverX, setHoverX]     = useState(null);
  const [animate, setAnimate]   = useState(false);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef(null);

  // Use first phenomenon that has temporal data, fall back gracefully
  const phenId   = TEMPORAL_DATA[phenomenon.id] ? phenomenon.id : Object.keys(TEMPORAL_DATA)[0];
  const rawData  = TEMPORAL_DATA[phenId] || TEMPORAL_DATA['wringen'];
  const variants = VARIANTS[phenId] || VARIANTS['wringen'];

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur   = 900;
    const tick  = (now) => {
      const t = Math.min((now - start) / dur, 1);
      setProgress(t < 1 ? t * t * (3 - 2 * t) : 1); // smoothstep
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phenId]);

  // Chart dimensions
  const margin = { top:24, right:24, bottom:48, left:44 };
  const W = 860, H = 380;
  const cW = W - margin.left - margin.right;
  const cH = H - margin.top  - margin.bottom;

  const years    = rawData.map(d => d.year);
  const minY = 0, maxY = 100;
  const xScale = i => (i / (years.length - 1)) * cW;
  const yScale = v => cH - (v / maxY) * cH;

  // For each variant, build a smooth path using bezier curves
  const buildPath = (varId) => {
    const pts = rawData.map((d, i) => ({
      x: xScale(i),
      y: yScale((d[varId] || 0) * progress),
    }));
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i-1].x + (pts[i].x - pts[i-1].x) * 0.5;
      const cp2x = pts[i].x   - (pts[i].x - pts[i-1].x) * 0.5;
      d += ` C ${cp1x} ${pts[i-1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const buildAreaPath = (varId) => {
    const pts = rawData.map((d, i) => ({
      x: xScale(i),
      y: yScale((d[varId] || 0) * progress),
    }));
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${cH}`;
    d += ` L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i-1].x + (pts[i].x - pts[i-1].x) * 0.5;
      const cp2x = pts[i].x   - (pts[i].x - pts[i-1].x) * 0.5;
      d += ` C ${cp1x} ${pts[i-1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    d += ` L ${pts[pts.length-1].x} ${cH} Z`;
    return d;
  };

  // Find nearest data point for hover
  const hoverIdx = hoverX !== null
    ? Math.round(hoverX / cW * (years.length - 1))
    : null;
  const hoverData = hoverIdx !== null ? rawData[Math.max(0, Math.min(hoverIdx, rawData.length-1))] : null;

  const varIds = variants.map(v => v.id);

  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'24px',
    }}>
      {/* Title row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:3 }}>
            Variantenentwicklung im 20. Jahrhundert
          </div>
          <div style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#64748b' }}>
            Prozentualer Anteil der Varianten nach Erhebungszeitraum · <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:11 }}>{phenomenon.label}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {variants.map(v => (
            <div key={v.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px',
              background:'#f8fafc', borderRadius:6, border:'1px solid #e2e8f0' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:v.color }}/>
              <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:10, color:'#334155' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX  = (e.clientX - rect.left) / rect.width * W;
          const chartX = svgX - margin.left;
          setHoverX(Math.max(0, Math.min(chartX, cW)));
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {[0,25,50,75,100].map(pct => (
            <g key={pct}>
              <line x1={0} y1={yScale(pct)} x2={cW} y2={yScale(pct)}
                stroke="#f1f5f9" strokeWidth={1} />
              <text x={-8} y={yScale(pct)+4} textAnchor="end"
                fontFamily="Inter,sans-serif" fontSize={10} fill="#94a3b8">{pct}%</text>
            </g>
          ))}

          {/* Area fills */}
          {variants.map(v => (
            <path key={`area-${v.id}`}
              d={buildAreaPath(v.id)}
              fill={v.color} fillOpacity={0.06}
            />
          ))}

          {/* Lines */}
          {variants.map(v => (
            <path key={`line-${v.id}`}
              d={buildPath(v.id)}
              fill="none" stroke={v.color} strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            />
          ))}

          {/* Data points */}
          {variants.map(v =>
            rawData.map((d, i) => {
              const val = (d[v.id] || 0) * progress;
              return (
                <circle key={`${v.id}-${i}`}
                  cx={xScale(i)} cy={yScale(val)} r={3}
                  fill="#fff" stroke={v.color} strokeWidth={2}
                />
              );
            })
          )}

          {/* Hover line + tooltip */}
          {hoverX !== null && hoverData && (() => {
            const snappedI = Math.round(hoverX / cW * (years.length - 1));
            const snapX    = xScale(snappedI);
            return (
              <>
                <line x1={snapX} y1={0} x2={snapX} y2={cH}
                  stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3"/>
                {/* Tooltip box */}
                <g transform={`translate(${snapX + (snapX > cW*0.6 ? -160 : 16)}, ${20})`}>
                  <rect x={0} y={0} width={150} height={variants.length * 18 + 24}
                    rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1}
                    filter="url(#shadow)" />
                  <text x={10} y={16} fontFamily="Inter,sans-serif" fontWeight={700}
                    fontSize={11} fill="#0f172a">{hoverData.year}</text>
                  {variants.map((v, vi) => {
                    const val = hoverData[v.id] || 0;
                    return (
                      <g key={v.id} transform={`translate(10, ${24 + vi*18})`}>
                        <circle cx={4} cy={4} r={4} fill={v.color}/>
                        <text x={14} y={8} fontFamily="Liberation Mono,monospace"
                          fontSize={9.5} fill="#334155">{v.label}</text>
                        <text x={140} y={8} textAnchor="end"
                          fontFamily="Inter,sans-serif" fontWeight={700}
                          fontSize={10} fill="#0f172a">{val}%</text>
                      </g>
                    );
                  })}
                </g>
                {/* Snap dots */}
                {variants.map(v => {
                  const val = (hoverData[v.id] || 0) * progress;
                  return (
                    <circle key={`snap-${v.id}`}
                      cx={snapX} cy={yScale(val)} r={5}
                      fill={v.color} stroke="#fff" strokeWidth={2}
                    />
                  );
                })}
              </>
            );
          })()}

          {/* X axis */}
          {years.map((y, i) => (
            <text key={y} x={xScale(i)} y={cH + 20} textAnchor="middle"
              fontFamily="Inter,sans-serif" fontSize={11} fill="#64748b">{y}</text>
          ))}

          {/* X axis label */}
          <text x={cW/2} y={cH + 40} textAnchor="middle"
            fontFamily="Inter,sans-serif" fontSize={11} fill="#94a3b8">
            Erhebungsjahr
          </text>

          {/* SVG filter for tooltip shadow */}
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08"/>
            </filter>
          </defs>
        </g>
      </svg>

      {/* Insight callout */}
      <div style={{
        marginTop:16, padding:'10px 14px',
        background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0',
        display:'flex', gap:10, alignItems:'flex-start',
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2} style={{flexShrink:0, marginTop:1}}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#64748b', lineHeight:1.5 }}>
          Die Dominanzvariante <span style={{ fontFamily:'Liberation Mono,monospace', color:'#334155' }}>{variants[0]?.label}</span> zeigt
          einen graduellen Rückgang über den Erhebungszeitraum, während
          Konkurrenzvarianten leicht zunehmen — ein typisches Merkmal des Dialektwandels im 20. Jahrhundert.
        </span>
      </div>
    </div>
  );
};

Object.assign(window, { TimelineChart });
