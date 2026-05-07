// DistributionChart — NEW: Bundesland stacked bar chart
// Shows how dialect variants distribute across Austria's 9 states

const DistributionChart = ({ phenomenon }) => {
  const { useState, useEffect, useRef } = React;
  const { VARIANTS, BUNDESLAND_DATA, PHENOMENA } = window.LEXVAD;

  const [progress, setProgress]   = useState(0);
  const [hoveredBL, setHoveredBL] = useState(null);
  const [sortBy, setSortBy]       = useState('total'); // total | bundesland | dominant
  const [highlightV, setHighlightV] = useState(null);
  const rafRef = useRef(null);

  const phenId   = BUNDESLAND_DATA[phenomenon.id] ? phenomenon.id : 'wringen';
  const rawData  = BUNDESLAND_DATA[phenId] || BUNDESLAND_DATA['wringen'];
  const variants = VARIANTS[phenId] || VARIANTS['wringen'];

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur   = 750;
    const tick  = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      setProgress(ease);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phenId]);

  const sorted = [...rawData].sort((a, b) => {
    if (sortBy === 'total')     return b.total - a.total;
    if (sortBy === 'bundesland') return a.bundesland.localeCompare(b.bundesland);
    if (sortBy === 'dominant') {
      const domA = variants.reduce((mx, v) => (b[v.id]||0) > (b[mx.id]||0) ? v : mx, variants[0]);
      return (b[domA.id]||0) - (a[domA.id]||0);
    }
    return 0;
  });

  const maxTotal = Math.max(...rawData.map(d => d.total));
  const grandTotal = rawData.reduce((s, d) => s + d.total, 0);

  const barH   = 28;
  const gap    = 10;
  const labelW = 130;
  const countW = 44;
  const chartW = 560;

  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'24px',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:3 }}>
            Verteilung nach Bundesland
          </div>
          <div style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#64748b' }}>
            Anteil der Belegvarianten je österreichischem Bundesland ·{' '}
            <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:11 }}>{phenomenon.label}</span>
          </div>
        </div>
        {/* Sort controls */}
        <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:8, padding:4 }}>
          {[
            { id:'total',      label:'Häufigkeit' },
            { id:'bundesland', label:'A–Z' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setSortBy(opt.id)} style={{
              padding:'5px 10px', borderRadius:5,
              background: sortBy===opt.id ? '#fff' : 'transparent',
              border: 'none', cursor:'pointer',
              fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:11,
              color: sortBy===opt.id ? '#0f172a' : '#64748b',
              boxShadow: sortBy===opt.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition:'all 0.15s',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:24 }}>
        {/* Chart */}
        <div style={{ flex:1 }}>
          {/* Variant legend */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', marginBottom:16 }}>
            {variants.map(v => (
              <button key={v.id}
                onMouseEnter={() => setHighlightV(v.id)}
                onMouseLeave={() => setHighlightV(null)}
                style={{
                  display:'flex', alignItems:'center', gap:5,
                  background: highlightV===v.id ? '#f1f5f9' : 'transparent',
                  border:'none', cursor:'pointer', borderRadius:4, padding:'2px 6px',
                  opacity: highlightV && highlightV !== v.id ? 0.4 : 1,
                  transition:'opacity 0.15s',
                }}>
                <div style={{ width:10, height:10, borderRadius:3, background:v.color }}/>
                <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:10, color:'#334155' }}>{v.label}</span>
              </button>
            ))}
          </div>

          {/* Bars */}
          {sorted.map((bl, ri) => {
            const isHov = hoveredBL === bl.bundesland;
            const rowY  = ri * (barH + gap);
            let cumulX  = 0;

            return (
              <div key={bl.bundesland}
                onMouseEnter={() => setHoveredBL(bl.bundesland)}
                onMouseLeave={() => setHoveredBL(null)}
                style={{
                  display:'flex', alignItems:'center', gap:8, marginBottom:gap,
                  opacity: isHov ? 1 : 0.9,
                }}
              >
                {/* Label */}
                <div style={{ width:labelW, flexShrink:0, textAlign:'right' }}>
                  <span style={{ fontFamily:'Inter,sans-serif', fontSize:12,
                    fontWeight: isHov ? 700 : 500, color: isHov ? '#0f172a' : '#334155',
                    transition:'font-weight 0.1s' }}
                  >{bl.bundesland}</span>
                </div>

                {/* Stacked bar */}
                <div style={{
                  flex:1, height:barH, display:'flex', borderRadius:4, overflow:'hidden',
                  boxShadow: isHov ? '0 0 0 2px #0f172a20' : 'none',
                  transition:'box-shadow 0.15s',
                }}>
                  {variants.map(v => {
                    const count = bl[v.id] || 0;
                    const pct   = bl.total > 0 ? count / bl.total * 100 * progress : 0;
                    const opacity = highlightV ? (highlightV===v.id ? 1 : 0.2) : 0.85;
                    return (
                      <div key={v.id}
                        title={`${v.label}: ${count} (${Math.round(pct/progress||0)}%)`}
                        style={{
                          width:`${pct}%`, background:v.color,
                          opacity, transition:'width 0.05s, opacity 0.15s',
                          position:'relative',
                        }}
                      />
                    );
                  })}
                  {/* Grey remainder (max normalisation) */}
                  <div style={{
                    flex:1, background:'#f1f5f9',
                  }}/>
                </div>

                {/* Count */}
                <div style={{ width:countW, flexShrink:0 }}>
                  <span style={{ fontFamily:'Inter,sans-serif', fontSize:11,
                    fontWeight:700, color:'#64748b' }}>{bl.total.toLocaleString('de-AT')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: summary panel */}
        <div style={{ width:180, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{
            background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0',
            padding:'12px', textAlign:'center',
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.5px', marginBottom:4 }}>GESAMT</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#0f172a' }}>{grandTotal.toLocaleString('de-AT')}</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>Belege</div>
          </div>

          {/* Per-variant summary */}
          {variants.map(v => {
            const total = rawData.reduce((s, bl) => s + (bl[v.id] || 0), 0);
            const pct   = Math.round(total / grandTotal * 100);
            return (
              <div key={v.id} style={{
                padding:'8px 10px', borderRadius:8, border:'1px solid #e2e8f0',
                background: highlightV===v.id ? '#f8fafc' : '#fff',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:v.color }}/>
                  <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:9, color:'#334155' }}>{v.label}</span>
                </div>
                <div style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>{pct}%</div>
                <div style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#94a3b8' }}>{total.toLocaleString('de-AT')} Belege</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DistributionChart });
