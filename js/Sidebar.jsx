// Sidebar — Dateneinblicke panel (right-side detail drawer)

// Zone colors matching MapPanel / GeoJSON
const SIDEBAR_ZONE_COLORS = {
  'Alemannisch':          '#afafaf',
  'Bairisch-Alemannisch': '#b9b9b9',
  'Südbairisch':          '#969696',
  'Südmittelbairisch':    '#737373',
  'Westmittelbairisch':   '#505050',
  'Ostmittelbairisch':    '#2d2d2d',
};
window.LEXVAD_ZONE_COLORS = SIDEBAR_ZONE_COLORS;

const SIDEBAR_ZONE_PATTERN_ORDER = Object.keys(SIDEBAR_ZONE_COLORS);
const zonePatternIndex = (zoneName) => Math.max(0, SIDEBAR_ZONE_PATTERN_ORDER.indexOf(zoneName));
const zonePatternId = (zoneName) => `lexvad-zone-pattern-${zonePatternIndex(zoneName)}`;
const zonePatternSwatchStyle = (zoneName, fallbackColor = '#94a3b8') => {
  const color = SIDEBAR_ZONE_COLORS[zoneName] || fallbackColor;
  const pattern = zonePatternIndex(zoneName) % 6;
  const backgroundImage = [
    `repeating-linear-gradient(45deg, transparent 0 3px, ${color} 3px 4px)`,
    `repeating-linear-gradient(135deg, transparent 0 3px, ${color} 3px 4px)`,
    `repeating-linear-gradient(0deg, transparent 0 3px, ${color} 3px 4px)`,
    `repeating-linear-gradient(90deg, transparent 0 3px, ${color} 3px 4px)`,
    `radial-gradient(circle at 2px 2px, ${color} 1.3px, transparent 1.5px)`,
    `linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%), linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%)`,
  ][pattern];
  return {
    backgroundColor: `${color}26`,
    backgroundImage,
    backgroundSize: pattern >= 4 ? '6px 6px' : undefined,
    backgroundPosition: pattern === 5 ? '0 0, 3px 3px' : undefined,
  };
};
const ZonePatternDefs = () => (
  <defs>
    {SIDEBAR_ZONE_PATTERN_ORDER.map((zoneName, index) => {
      const color = SIDEBAR_ZONE_COLORS[zoneName];
      const pattern = index % 6;
      return (
        <pattern key={zoneName} id={zonePatternId(zoneName)}
          patternUnits="userSpaceOnUse" width={8} height={8}>
          <rect width={8} height={8} fill={color} opacity={0.10}/>
          {pattern === 0 && <path d="M-2 8 L8 -2 M0 10 L10 0" stroke={color} strokeWidth={1.4} opacity={0.8}/>}
          {pattern === 1 && <path d="M-2 0 L8 10 M0 -2 L10 8" stroke={color} strokeWidth={1.4} opacity={0.8}/>}
          {pattern === 2 && <path d="M0 2 H8 M0 6 H8" stroke={color} strokeWidth={1.2} opacity={0.8}/>}
          {pattern === 3 && <path d="M2 0 V8 M6 0 V8" stroke={color} strokeWidth={1.2} opacity={0.8}/>}
          {pattern === 4 && <circle cx={2} cy={2} r={1.2} fill={color} opacity={0.8}/>}
          {pattern === 4 && <circle cx={6} cy={6} r={1.2} fill={color} opacity={0.8}/>}
          {pattern === 5 && <path d="M0 0 H4 V4 H0 Z M4 4 H8 V8 H4 Z" fill={color} opacity={0.45}/>}
        </pattern>
      );
    })}
  </defs>
);

const Sidebar = ({ phenomenon, onClose, zoneAssignments = {}, geojsonData, clickedVariantId }) => {
  const { useState, useMemo, useEffect } = React;
  const [section,          setSection]          = useState('phaenomen');
  const [selectedVariantId,setSelectedVariantId]= useState(null);
  const [hoveredZone,      setHoveredZone]      = useState(null);
  const [raumFilter,       setRaumFilter]        = useState('all');
  const [raumListTab,      setRaumListTab]       = useState('zonen');
  const [ringTab,          setRingTab]           = useState('zonen');

  useEffect(() => {
    if (clickedVariantId) {
      setSelectedVariantId(clickedVariantId);
      setSection('variante');
    }
  }, [clickedVariantId]);

  if (!phenomenon) return null;

  const { VARIANTS, BUNDESLAND_DATA, DATA_POINTS } = window.LEXVAD;
  const variants = VARIANTS[phenomenon.id] || [];
  const blData   = (BUNDESLAND_DATA[phenomenon.id] || []).slice().sort((a,b) => b.total - a.total);
  const varById  = Object.fromEntries(variants.map(v => [v.id, v]));

  const totalBelege = blData.reduce((s, b) => s + b.total, 0) || phenomenon.boegenCount;

  const activeVarId = selectedVariantId || (variants.find(v => v.id !== 'sonstige')?.id ?? variants[0]?.id);
  const activeVar   = varById[activeVarId];

  // Co-occurrence
  const coOccurrence = useMemo(() => {
    if (!activeVarId) return [];
    const pts = DATA_POINTS.filter(p => p.item === phenomenon.id);
    const activeBL = new Set(pts.filter(p => p.variant === activeVarId).map(p => p.bundesland));
    const ptsInRegion = pts.filter(p => activeBL.has(p.bundesland));
    const totalInRegion = ptsInRegion.length;
    return variants
      .filter(v => v.id !== activeVarId)
      .map(v => ({ ...v, countInRegion: ptsInRegion.filter(p => p.variant === v.id).length, totalInRegion }))
      .sort((a, b) => b.countInRegion - a.countInRegion);
  }, [activeVarId, phenomenon.id]);

  // ── Zone data from real point-in-polygon assignments ────────────────────────
  const { zoneData, zoneNames } = useMemo(() => {
    const pts  = DATA_POINTS.filter(p => p.item === phenomenon.id);
    const data = {};
    pts.forEach(p => {
      const zName = zoneAssignments[p.id];
      if (!zName) return;
      if (!data[zName]) data[zName] = { total: 0 };
      data[zName].total++;
      data[zName][p.variant] = (data[zName][p.variant] || 0) + 1;
    });
    // Order by GeoJSON feature order if available, else alphabetical
    const geoOrder = geojsonData
      ? [...new Set(geojsonData.features.map(f => f.properties.Dialektregion_Name))]
      : Object.keys(SIDEBAR_ZONE_COLORS);
    const names = geoOrder.filter(n => data[n]);
    return { zoneData: data, zoneNames: names };
  }, [phenomenon.id, zoneAssignments, geojsonData]);

  // Ring chart data — distribution of active variant across zones or Bundesländer
  const { zoneRing, blRing } = useMemo(() => {
    const pts = DATA_POINTS.filter(p => p.item === phenomenon.id && p.variant === activeVarId);

    const zc = {};
    pts.forEach(p => { const z = zoneAssignments[p.id]; if (z) zc[z] = (zc[z] || 0) + (p.anzahl || 1); });
    const zt = Object.values(zc).reduce((s, v) => s + v, 0);
    const geoOrder = geojsonData
      ? [...new Set(geojsonData.features.map(f => f.properties.Dialektregion_Name))]
      : Object.keys(SIDEBAR_ZONE_COLORS);
    const zRing = geoOrder
      .filter(z => zc[z])
      .map(z => ({ name: z, count: zc[z], total: zt, color: SIDEBAR_ZONE_COLORS[z] || '#94a3b8', patternZone: z }))
      .sort((a, b) => b.count - a.count);

    const bc = {};
    pts.forEach(p => { if (p.bundesland) bc[p.bundesland] = (bc[p.bundesland] || 0) + (p.anzahl || 1); });
    const bt = Object.values(bc).reduce((s, v) => s + v, 0);
    const bRing = Object.entries(bc)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const blPts = DATA_POINTS.filter(q => q.item === phenomenon.id && q.bundesland === name);
        const bz = {};
        blPts.forEach(q => { const z = zoneAssignments[q.id]; if (z) bz[z] = (bz[z] || 0) + 1; });
        const dom = Object.entries(bz).sort((a, b) => b[1] - a[1])[0]?.[0];
        return { name, count, total: bt, color: SIDEBAR_ZONE_COLORS[dom] || '#94a3b8', patternZone: dom };
      });

    return { zoneRing: zRing, blRing: bRing };
  }, [activeVarId, phenomenon.id, zoneAssignments, geojsonData]);

  const tabs = [
    { id:'phaenomen', label:'Phänomen' },
    { id:'variante',  label:'Variante'  },
    { id:'raum',      label:'Dialektaler Raum' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 65, right: 0, bottom: 0, width: 339,
      background: '#fff',
      boxShadow: '-3px 0 12px -5px rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.5px', color:'#78859a', textTransform:'uppercase' }}>
          Dateneinblicke
        </span>
        <button onClick={onClose} style={{
          background:'none', border:'none', cursor:'pointer', color:'#94a3b8',
          display:'flex', alignItems:'center', padding:4, borderRadius:4,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)} style={{
            flex:1, padding:'10px 4px', background:'none', border:'none', cursor:'pointer',
            fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:10, letterSpacing:'0.4px',
            color: section===t.id ? '#0f172a' : '#94a3b8',
            borderBottom: section===t.id ? '2px solid #0f172a' : '2px solid transparent',
            transition: 'color 0.15s',
          }}>{t.label.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ padding: '16px 14px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Phenomenon card — hidden on Variante tab */}
        {section !== 'variante' && (
          <div style={{
            background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0',
            boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px',
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:6 }}>
              AUSGEWÄHLTES PHÄNOMEN
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', lineHeight:1.3, marginBottom:12 }}>
              {phenomenon.label}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {[
                { label:'Bögen',    val: phenomenon.boegenCount.toLocaleString('de-AT') },
                { label:'Varianten',val: phenomenon.variantCount },
              ].map(s => (
                <div key={s.label} style={{
                  flex:1, background:'#fff', borderRadius:8, border:'1px solid #e2e8f0',
                  boxShadow:'0 1px 2px rgba(0,0,0,0.04)', padding:'10px 12px',
                }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#78859a', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variant card — shown only on Variante tab, updates with selected variant */}
        {section === 'variante' && activeVar && (() => {
          const schreibweisenCount = new Set(
            DATA_POINTS
              .filter(p => p.item === phenomenon.id && p.variant === activeVarId && p.rawVariante)
              .map(p => p.rawVariante)
          ).size;
          return (
            <div style={{
              background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0',
              boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px',
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:6 }}>
                AUSGEWÄHLTE VARIANTE
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:activeVar.color, flexShrink:0 }}/>
                <div style={{ fontFamily:'Liberation Mono,monospace', fontSize:16, fontWeight:700, color:'#0f172a', lineHeight:1.3 }}>
                  {activeVar.label}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { label:'Nennungen',     val: activeVar.count.toLocaleString('de-AT') },
                  { label:'Schreibweisen', val: schreibweisenCount },
                ].map(s => (
                  <div key={s.label} style={{
                    flex:1, background:'#fff', borderRadius:8, border:'1px solid #e2e8f0',
                    boxShadow:'0 1px 2px rgba(0,0,0,0.04)', padding:'10px 12px',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#78859a', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Variants distribution */}
        {section === 'phaenomen' && (
          <div style={{
            borderRadius:12, border:'1px solid #e2e8f0',
            boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px',
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:10 }}>
              VARIANTEN-ÜBERSICHT
            </div>
            {variants.map(v => (
              <div key={v.id} style={{ marginBottom:7 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:v.color, flexShrink:0 }}/>
                    <span style={{ fontFamily:'Liberation Mono, monospace', fontSize:11, color:'#334155' }}>{v.label}</span>
                  </div>
                  <span style={{ fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:11, color:'#0f172a' }}>{v.pct}%</span>
                </div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${v.pct}%`, background:v.color, borderRadius:2, transition:'width 0.5s ease' }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Co-occurrence view */}
        {section === 'variante' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Variant picker */}
            <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:8 }}>VARIANTE AUSWÄHLEN</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {variants.filter(v => v.id !== 'sonstige').map(v => (
                  <button key={v.id} onClick={() => setSelectedVariantId(v.id)} style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'5px 10px', borderRadius:20,
                    background: activeVarId === v.id ? v.color : '#f8fafc',
                    border: activeVarId === v.id ? `1px solid ${v.color}` : '1px solid #e2e8f0',
                    cursor:'pointer', transition:'all 0.15s',
                    fontFamily:'Liberation Mono,monospace', fontSize:10,
                    color: activeVarId === v.id ? '#fff' : '#334155',
                    fontWeight: activeVarId === v.id ? 700 : 400,
                  }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: activeVarId === v.id ? 'rgba(255,255,255,0.7)' : v.color, flexShrink:0 }}/>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected variant stats */}
            {/* {activeVar && (
              <div style={{ borderRadius:12, border:`1px solid ${activeVar.color}22`, boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px', background:`${activeVar.color}08` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:activeVar.color, flexShrink:0 }}/>
                  <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:13, fontWeight:700, color:'#0f172a' }}>{activeVar.label}</span>
                  <span style={{ marginLeft:'auto', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, color:'#0f172a' }}>{activeVar.pct}%</span>
                </div>
                <div style={{ height:6, background:'#e2e8f0', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                  <div style={{ height:'100%', width:`${activeVar.pct}%`, background:activeVar.color, borderRadius:3, transition:'width 0.5s ease' }}/>
                </div>
                <div style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#64748b' }}>
                  {activeVar.count} Belege · {DATA_POINTS.filter(p => p.item === phenomenon.id && p.variant === activeVarId).length} Ortspunkte
                </div>
              </div>
            )} */}

            {/* Ring chart — geographic distribution of active variant */}
            {(() => {
              const ringData = ringTab === 'zonen' ? zoneRing : blRing;
              if (ringData.length === 0) return null;

              const cx = 90, cy = 90, R = 72, ri = 44;
              let angle = -Math.PI / 2;
              const segments = ringData.map(d => {
                const sweep = (d.count / d.total) * 2 * Math.PI;
                const end = angle + sweep;
                const large = sweep > Math.PI ? 1 : 0;
                const [c1, s1, c2, s2] = [Math.cos(angle), Math.sin(angle), Math.cos(end), Math.sin(end)];
                const path = `M ${cx+R*c1} ${cy+R*s1} A ${R} ${R} 0 ${large} 1 ${cx+R*c2} ${cy+R*s2} L ${cx+ri*c2} ${cy+ri*s2} A ${ri} ${ri} 0 ${large} 0 ${cx+ri*c1} ${cy+ri*s1} Z`;
                const seg = { ...d, path };
                angle = end;
                return seg;
              });

              return (
                <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px' }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:10,
                    fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', fontFamily:'Inter,sans-serif' }}>
                    <span>VERTEILUNG NACH</span>
                    <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
                      <select value={ringTab} onChange={e => setRingTab(e.target.value)} style={{
                        fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px',
                        fontFamily:'Inter,sans-serif', background:'none', border:'none',
                        cursor:'pointer', outline:'none', appearance:'none', WebkitAppearance:'none',
                        paddingRight:14,
                      }}>
                        <option value="zonen">DIALEKTZONE</option>
                        <option value="bundesland">BUNDESLAND</option>
                      </select>
                      <svg width={8} height={6} viewBox="0 0 9 6" fill="#78859a"
                        style={{ position:'absolute', right:0, pointerEvents:'none' }}>
                        <path d="M4.594 6L0 0h9.188z"/>
                      </svg>
                    </div>
                  </div>

                  <svg viewBox="0 0 180 180" style={{ width:'100%', maxWidth:160, height:'auto', display:'block', margin:'0 auto 12px' }}>
                    <ZonePatternDefs/>
                    {segments.length === 1 ? (
                      <>
                        <circle cx={cx} cy={cy} r={R}
                          fill={segments[0].patternZone ? `url(#${zonePatternId(segments[0].patternZone)})` : segments[0].color}/>
                        <circle cx={cx} cy={cy} r={ri} fill="#fff"/>
                      </>
                    ) : (
                      segments.map(seg => (
                        <path key={seg.name} d={seg.path}
                          fill={seg.patternZone ? `url(#${zonePatternId(seg.patternZone)})` : seg.color}
                          stroke="#fff" strokeWidth={2}/>
                      ))
                    )}
                  </svg>

                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {ringData.map(d => {
                      const exactPct = d.count / d.total * 100;
                      const pctLabel = exactPct < 1 ? '<1%' : `${Math.round(exactPct)}%`;
                      return (
                        <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
                          <div style={{
                            width:9, height:9, borderRadius:'50%', flexShrink:0,
                            border:`1px solid ${d.color}66`,
                            ...zonePatternSwatchStyle(d.patternZone, d.color),
                          }}/>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#334155', flex:1 }}>{d.name}</span>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, color:'#64748b' }}>{pctLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Co-occurring variants */}
            <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:4 }}>REGIONALE KOVORKOMMNISSE</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:10 }}>
                Andere Varianten in denselben Bundesländern
              </div>
              {coOccurrence.length === 0 && (
                <div style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#94a3b8', fontStyle:'italic' }}>Keine Daten gefunden.</div>
              )}
              {coOccurrence.map(v => {
                const pct = v.totalInRegion > 0 ? Math.round(v.countInRegion / v.totalInRegion * 100) : 0;
                return (
                  <div key={v.id} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:v.color, flexShrink:0 }}/>
                        <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:10, color:'#334155' }}>{v.label}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#64748b' }}>{v.countInRegion} Orte</span>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700, color:'#0f172a', minWidth:28, textAlign:'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:v.color, borderRadius:2, transition:'width 0.5s ease' }}/>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Dialect zone radar + list */}
        {section === 'raum' && (() => {
          const axisVariants = variants.filter(v => v.id !== 'sonstige');
          const isZonenTab = raumListTab === 'zonen';

          if (zoneNames.length === 0) return (
            <div style={{ padding:'20px 12px', textAlign:'center', color:'#94a3b8', fontFamily:'Inter,sans-serif', fontSize:12 }}>
              Dialektzonen werden geladen…
            </div>
          );

          // Rows for the active tab: dialect zones or Bundesländer
          const rows = isZonenTab
            ? zoneNames.map(z => ({ name: z, data: zoneData[z] }))
            : blData.map(bl => ({ name: bl.bundesland, data: bl }));

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

              {/* Filter dropdown — scoped to active tab's category */}
              {/* <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:8 }}>FILTER</div>
                <div style={{ position:'relative' }}>
                  <select value={raumFilter} onChange={e => setRaumFilter(e.target.value)} style={{
                    width:'100%', padding:'8px 30px 8px 10px', borderRadius:6,
                    border:'1px solid #e2e8f0', background:'#f8fafc',
                    fontFamily:'Inter,sans-serif', fontSize:12, color:'#0f172a',
                    cursor:'pointer', outline:'none', appearance:'none',
                  }}>
                    <option value="all">Alle anzeigen</option>
                    {isZonenTab
                      ? zoneNames.map(z => <option key={z} value={z}>{z}</option>)
                      : blData.map(bl => <option key={bl.bundesland} value={bl.bundesland}>{bl.bundesland}</option>)
                    }
                  </select>
                  <svg width={9} height={9} viewBox="0 0 9 6" fill="#94a3b8"
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                    <path d="M4.594 6L0 0h9.188z"/>
                  </svg>
                </div>
              </div> */}

              {/* Distribution bars — compact version of DistributionChart */}
              <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px', background:'#fafbfc' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:10 }}>
                  {isZonenTab ? 'VARIANTENVERTEILUNG PRO DIALEKTZONE' : 'VARIANTENVERTEILUNG PRO BUNDESLAND'}
                </div>

                {/* Variant legend */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginBottom:12 }}>
                  {variants.map(v => (
                    <div key={v.id} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:v.color, flexShrink:0 }}/>
                      <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:9, color:'#334155' }}>{v.label}</span>
                    </div>
                  ))}
                </div>

                {/* Stacked bars (each row scaled to 100% — shows variant composition) */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {rows.map(({ name, data }) => {
                    const total = data?.total || 0;
                    const isHov = hoveredZone === name;
                    return (
                      <div key={name}
                        onMouseEnter={() => setHoveredZone(name)}
                        onMouseLeave={() => setHoveredZone(null)}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11,
                            fontWeight: isHov ? 700 : 500, color: isHov ? '#0f172a' : '#334155',
                            transition:'font-weight 0.1s' }}>{name}</span>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700, color:'#64748b' }}>
                            {total.toLocaleString('de-AT')}
                          </span>
                        </div>
                        <div style={{
                          display:'flex', height:14, borderRadius:4, overflow:'hidden', background:'#f1f5f9',
                          boxShadow: isHov ? '0 0 0 2px #0f172a20' : 'none', transition:'box-shadow 0.15s',
                        }}>
                          {variants.map(v => {
                            const count = data?.[v.id] || 0;
                            const w = total > 0 ? count / total * 100 : 0;
                            if (w === 0) return null;
                            return (
                              <div key={v.id}
                                title={`${v.label}: ${count} (${Math.round(w)}%)`}
                                style={{ width:`${w}%`, background:v.color, opacity:0.85, transition:'width 0.5s ease' }}/>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zone / Bundesland list */}
              <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', overflow:'hidden' }}>
                <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0' }}>
                  {[{ id:'zonen', label:'Dialektzonen' }, { id:'bundesland', label:'Bundesländer' }].map(t => (
                    <button key={t.id} onClick={() => { setRaumListTab(t.id); setRaumFilter('all'); }} style={{
                      flex:1, padding:'9px 4px', background:'none', border:'none', cursor:'pointer',
                      fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:10, letterSpacing:'0.4px',
                      color: raumListTab === t.id ? '#0f172a' : '#94a3b8',
                      borderBottom: raumListTab === t.id ? '2px solid #0f172a' : '2px solid transparent',
                      transition:'color 0.15s',
                    }}>{t.label.toUpperCase()}</button>
                  ))}
                </div>

                <div style={{ padding:'10px 10px 8px' }}>
                  {raumListTab === 'zonen' && zoneNames.map(zName => {
                    const zd = zoneData[zName];
                    const color = SIDEBAR_ZONE_COLORS[zName] || '#94a3b8';
                    const dominant = axisVariants.reduce((best, v) =>
                      (zd[v.id] || 0) > (zd[best?.id] || 0) ? v : best, axisVariants[0]);
                    const domPct = zd.total > 0 ? Math.round((zd[dominant?.id] || 0) / zd.total * 100) : 0;
                    const sel = raumFilter === zName;
                    return (
                      <div key={zName}
                        onMouseEnter={() => setHoveredZone(zName)}
                        onMouseLeave={() => setHoveredZone(null)}
                        onClick={() => setRaumFilter(raumFilter === zName ? 'all' : zName)}
                        style={{
                          display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
                          borderRadius:6, marginBottom:2, cursor:'pointer',
                          background: sel || hoveredZone === zName ? '#f1f5f9' : 'transparent',
                          border: sel ? `1px solid ${color}44` : '1px solid transparent',
                          transition:'all 0.15s',
                        }}>
                        <div style={{
                          width:10, height:10, borderRadius:2, flexShrink:0,
                          border:`1px solid ${color}66`,
                          ...zonePatternSwatchStyle(zName, color),
                        }}/>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:500, color:'#334155', flex:1 }}>{zName}</span>
                        <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:9, color:'#64748b' }}>{dominant?.label}</span>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700, color:'#0f172a', minWidth:28, textAlign:'right' }}>{domPct}%</span>
                      </div>
                    );
                  })}

                  {raumListTab === 'bundesland' && blData.map(bl => {
                    const blPts2 = DATA_POINTS.filter(p => p.item === phenomenon.id && p.bundesland === bl.bundesland);
                    const zoneCounts2 = {};
                    blPts2.forEach(p => {
                      const z = zoneAssignments[p.id];
                      if (z) zoneCounts2[z] = (zoneCounts2[z] || 0) + 1;
                    });
                    const dominantZone = Object.entries(zoneCounts2).sort((a, b) => b[1] - a[1])[0]?.[0];
                    const zColor = SIDEBAR_ZONE_COLORS[dominantZone] || '#94a3b8';
                    const dominant = axisVariants.reduce((best, v) =>
                      (bl[v.id] || 0) > (bl[best?.id] || 0) ? v : best, axisVariants[0]);
                    const domPct = bl.total > 0 ? Math.round((bl[dominant?.id] || 0) / bl.total * 100) : 0;
                    const sel = raumFilter === bl.bundesland;
                    return (
                      <div key={bl.bundesland}
                        onMouseEnter={() => setHoveredZone(bl.bundesland)}
                        onMouseLeave={() => setHoveredZone(null)}
                        onClick={() => setRaumFilter(raumFilter === bl.bundesland ? 'all' : bl.bundesland)}
                        style={{
                          display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
                          borderRadius:6, marginBottom:2, cursor:'pointer',
                          background: sel || hoveredZone === bl.bundesland ? '#f1f5f9' : 'transparent',
                          border: sel ? `1px solid ${zColor}44` : '1px solid transparent',
                          transition:'all 0.15s',
                        }}>
                        <div style={{
                          width:10, height:10, borderRadius:2, flexShrink:0,
                          border:`1px solid ${zColor}66`,
                          ...zonePatternSwatchStyle(dominantZone, zColor),
                        }}/>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:500, color:'#334155', flex:1 }}>{bl.bundesland}</span>
                        <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:9, color:'#64748b' }}>{dominant?.label}</span>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700, color:'#0f172a', minWidth:28, textAlign:'right' }}>{domPct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Category badge */}
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
          background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0',
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}>
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#64748b' }}>Kategorie: </span>
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color:'#334155' }}>{phenomenon.category}</span>
        </div>

      </div>
    </div>
  );
};

Object.assign(window, { Sidebar });
