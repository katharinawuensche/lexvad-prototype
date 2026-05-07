// NetworkGraph — NEW: Phänomen-Netzwerk
// Force-directed bubble graph of phenomena and their relationships

const NetworkGraph = ({ phenomenon, onSelectPhenomenon }) => {
  const { useState, useEffect, useRef, useMemo } = React;
  const { NETWORK_DATA, DIALECT_ZONES, VARIANTS, PHENOMENA } = window.LEXVAD;

  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(phenomenon.id);
  const [filter,   setFilter]   = useState('all'); // all | by zone
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const dur = 600;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      setProgress(t < 0.5 ? 2*t*t : -1+(4-2*t)*t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const { nodes, edges } = NETWORK_DATA;

  const W = 900, H = 480;

  // Zone color lookup
  const zoneColor = Object.fromEntries(DIALECT_ZONES.map(z => [z.id, z.color]));

  // Node lookup
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const handleNodeClick = (node) => {
    setSelected(node.id);
    const phen = PHENOMENA.find(p => p.id === node.id);
    if (phen && onSelectPhenomenon) onSelectPhenomenon(phen);
  };

  // Highlight connected nodes when hovered
  const connectedIds = useMemo(() => {
    const activeId = hovered || selected;
    if (!activeId) return new Set();
    const ids = new Set([activeId]);
    edges.forEach(e => {
      if (e.source === activeId) ids.add(e.target);
      if (e.target === activeId) ids.add(e.source);
    });
    return ids;
  }, [hovered, selected]);

  const maxCount = Math.max(...nodes.map(n => n.count));

  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'24px',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:3 }}>
            Phänomen-Netzwerk
          </div>
          <div style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#64748b' }}>
            Semantische und geografische Beziehungen zwischen Dialektphänomenen · Knotengröße = Beleganzahl
          </div>
        </div>
        {/* Filter */}
        <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:8, padding:4 }}>
          {[
            { id:'all',  label:'Alle' },
            { id:'verb', label:'Verben' },
            { id:'nom',  label:'Nomen' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding:'5px 10px', borderRadius:5,
              background: filter===f.id ? '#fff' : 'transparent',
              border:'none', cursor:'pointer',
              fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:11,
              color: filter===f.id ? '#0f172a' : '#64748b',
              boxShadow: filter===f.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition:'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:20 }}>
        {/* Graph */}
        <div style={{ flex:1, position:'relative' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`}
            style={{ background:'#fafafa', borderRadius:10, border:'1px solid #f1f5f9', display:'block' }}>
            <defs>
              {nodes.map(n => (
                <radialGradient key={`grad-${n.id}`} id={`grad-${n.id}`} cx="35%" cy="35%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor={zoneColor[n.zone] || '#94a3b8'} stopOpacity="0"/>
                </radialGradient>
              ))}
              <filter id="netShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12"/>
              </filter>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const src = nodeMap[e.source];
              const tgt = nodeMap[e.target];
              if (!src || !tgt) return null;
              const activeId = hovered || selected;
              const isActive = activeId === e.source || activeId === e.target;
              const isFiltered = filter !== 'all' && (
                (filter === 'verb' && (nodeMap[e.source]?.category !== 'Verben' || nodeMap[e.target]?.category !== 'Verben')) ||
                (filter === 'nom'  && nodeMap[e.source]?.category !== 'Nomen'   && nodeMap[e.target]?.category !== 'Nomen')
              );
              if (isFiltered) return null;
              // animated entry
              const y1 = src.y + (src.y - H/2) * (1 - progress) * 0.3;
              const y2 = tgt.y + (tgt.y - H/2) * (1 - progress) * 0.3;
              return (
                <line key={i}
                  x1={src.x} y1={y1} x2={tgt.x} y2={y2}
                  stroke={isActive ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={isActive ? e.strength * 2.5 : e.strength * 1.5}
                  strokeOpacity={isActive ? 0.8 : 0.5}
                  strokeLinecap="round"
                  style={{ transition:'stroke 0.2s, stroke-opacity 0.2s' }}
                />
              );
            })}

            {/* Edge labels on hover */}
            {(hovered || selected) && edges.filter(e =>
              e.source === (hovered || selected) || e.target === (hovered || selected)
            ).map((e, i) => {
              const src = nodeMap[e.source];
              const tgt = nodeMap[e.target];
              if (!src || !tgt) return null;
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              return (
                <text key={`el-${i}`} x={mx} y={my-5} textAnchor="middle"
                  fontFamily="Inter,sans-serif" fontSize={8.5}
                  fill="#94a3b8" pointerEvents="none">
                  {e.reason}
                </text>
              );
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const isFiltered = (
                (filter === 'verb' && n.category !== 'Verben') ||
                (filter === 'nom'  && n.category !== 'Nomen')
              );
              const isHov  = hovered  === n.id;
              const isSel  = selected === n.id;
              const isDim  = (hovered || selected) && !connectedIds.has(n.id);
              const color  = zoneColor[n.zone] || '#94a3b8';
              const r      = n.r * progress;
              const animY  = n.y + (n.y - H/2) * (1 - progress) * 0.3;

              if (isFiltered) return null;

              return (
                <g key={n.id}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleNodeClick(n)}
                  style={{ cursor:'pointer' }}
                  transform={`translate(${n.x}, ${animY})`}
                  opacity={isDim ? 0.25 : 1}
                >
                  {/* Outer glow ring for selected */}
                  {isSel && (
                    <circle r={r+6} fill="none" stroke={color} strokeWidth={2} opacity={0.35}/>
                  )}
                  {/* Main circle */}
                  <circle r={isHov ? r+3 : r}
                    fill={color} fillOpacity={0.15}
                    stroke={color}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                    filter={isHov || isSel ? "url(#netShadow)" : undefined}
                    style={{ transition:'r 0.2s' }}
                  />
                  {/* Gradient highlight */}
                  <circle r={isHov ? r+3 : r}
                    fill={`url(#grad-${n.id})`}
                    pointerEvents="none"
                  />
                  {/* Label */}
                  <text textAnchor="middle" dy={4}
                    fontFamily="Inter,sans-serif"
                    fontWeight={isSel ? 700 : 600}
                    fontSize={r > 28 ? 11 : r > 20 ? 10 : 9}
                    fill={color}
                    pointerEvents="none"
                  >{n.label}</text>
                  {/* Count sub-label */}
                  {(isHov || isSel) && (
                    <text textAnchor="middle" dy={r > 28 ? 17 : 15}
                      fontFamily="Inter,sans-serif" fontWeight={400}
                      fontSize={8.5} fill="#64748b"
                      pointerEvents="none">
                      {n.count.toLocaleString('de-AT')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hint */}
          <div style={{
            position:'absolute', bottom:12, left:12,
            fontFamily:'Inter,sans-serif', fontSize:10, color:'#94a3b8',
          }}>Klick = Phänomen auswählen · Hover = Verbindungen anzeigen</div>
        </div>

        {/* Side panel */}
        <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
          {/* Zone legend */}
          <div style={{
            background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', padding:'10px 12px',
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:8 }}>DIALEKTZONEN</div>
            {DIALECT_ZONES.map(z => (
              <div key={z.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:z.color, flexShrink:0 }}/>
                <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#334155' }}>{z.label}</span>
              </div>
            ))}
          </div>

          {/* Selected node detail */}
          {selected && (() => {
            const node = nodeMap[selected];
            const phen = PHENOMENA.find(p => p.id === selected);
            const vars = VARIANTS[selected] || [];
            const conns = edges.filter(e => e.source===selected || e.target===selected);
            return (
              <div style={{
                background:'#fff', borderRadius:8, border:'1px solid #e2e8f0',
                boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'10px 12px',
              }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:6 }}>AUSGEWÄHLT</div>
                <div style={{ fontFamily:'Inter,sans-serif', fontSize:13, fontWeight:700, color:'#0f172a', marginBottom:8, lineHeight:1.3 }}>
                  {node?.label}
                </div>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>
                  {phen?.boegenCount?.toLocaleString('de-AT')} Bögen · {phen?.variantCount} Varianten
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', marginBottom:10 }}>
                  Zone: {DIALECT_ZONES.find(z=>z.id===node?.zone)?.label}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#78859a', letterSpacing:'0.4px', marginBottom:6 }}>
                  VERBINDUNGEN ({conns.length})
                </div>
                {conns.map(e => {
                  const otherId = e.source===selected ? e.target : e.source;
                  const other   = nodeMap[otherId];
                  const col     = zoneColor[other?.zone] || '#94a3b8';
                  return (
                    <div key={otherId} style={{
                      display:'flex', alignItems:'center', gap:6, marginBottom:4,
                      cursor:'pointer', padding:'3px 4px', borderRadius:4,
                    }} onClick={() => setSelected(otherId)}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:col, flexShrink:0 }}/>
                      <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#334155' }}>{other?.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { NetworkGraph });
