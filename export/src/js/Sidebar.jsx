// Sidebar — Dateneinblicke panel (right-side detail drawer)

const Sidebar = ({ phenomenon, onClose }) => {
  const { useState, useMemo } = React;
  const [section, setSection] = useState('phaenomen'); // phaenomen | variante | raum
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [hoveredZone,       setHoveredZone]       = useState(null);
  const [raumFilter,        setRaumFilter]        = useState('all');
  const [raumListTab,       setRaumListTab]       = useState('zonen'); // 'zonen' | 'bundesland'
  if (!phenomenon) return null;

  const { VARIANTS, BUNDESLAND_DATA, DIALECT_ZONES, DATA_POINTS } = window.LEXVAD;
  const variants = VARIANTS[phenomenon.id] || [];
  const blData   = (BUNDESLAND_DATA[phenomenon.id] || []).slice().sort((a,b) => b.total - a.total);
  const varById  = Object.fromEntries(variants.map(v => [v.id, v]));

  const totalBelege = blData.reduce((s, b) => s + b.total, 0) || phenomenon.boegenCount;

  // Active variant for co-occurrence view — default to first non-sonstige variant
  const activeVarId = selectedVariantId || (variants.find(v => v.id !== 'sonstige')?.id ?? variants[0]?.id);
  const activeVar   = varById[activeVarId];

  // Co-occurrence: in the Bundesländer that have the active variant,
  // which other variants also appear — and how strongly?
  const coOccurrence = useMemo(() => {
    if (!activeVarId) return [];
    const pts = DATA_POINTS.filter(p => p.item === phenomenon.id);

    // Bundesländer that contain at least one location with the active variant
    const activeBL = new Set(pts.filter(p => p.variant === activeVarId).map(p => p.bundesland));

    // Total locations within those Bundesländer
    const ptsInRegion = pts.filter(p => activeBL.has(p.bundesland));
    const totalInRegion = ptsInRegion.length;

    return variants
      .filter(v => v.id !== activeVarId)
      .map(v => {
        const countInRegion = ptsInRegion.filter(p => p.variant === v.id).length;
        return { ...v, countInRegion, totalInRegion };
      })
      .sort((a, b) => b.countInRegion - a.countInRegion);
  }, [activeVarId, phenomenon.id]);

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

        {/* Phenomenon card */}
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
            {activeVar && (
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
            )}

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

        {/* Dialect zone radar */}
        {section === 'raum' && (() => {
          const BL_TO_ZONE = {
            'Vorarlberg':       'alemannisch',
            'Tirol':            'bair_alemannisch',
            'Salzburg':         'westmittelbair',
            'Kärnten':          'suedbairisch',
            'Steiermark':       'suedmittelbair',
            'Oberösterreich':   'westmittelbair',
            'Niederösterreich': 'ostmittelbair',
            'Wien':             'ostmittelbair',
            'Burgenland':       'ostmittelbair',
          };
          const bundeslaender = Object.keys(BL_TO_ZONE);
          const zoneById = Object.fromEntries(DIALECT_ZONES.map(z => [z.id, z]));

          // Aggregate BUNDESLAND_DATA into per-zone variant counts
          const zoneData = {};
          blData.forEach(bl => {
            const zid = BL_TO_ZONE[bl.bundesland];
            if (!zid) return;
            if (!zoneData[zid]) zoneData[zid] = { total: 0 };
            zoneData[zid].total += bl.total;
            variants.forEach(v => {
              zoneData[zid][v.id] = (zoneData[zid][v.id] || 0) + (bl[v.id] || 0);
            });
          });

          // Per-Bundesland data for BL filter mode
          const blById = Object.fromEntries(blData.map(b => [b.bundesland, b]));

          // Determine what's highlighted based on filter
          const isZoneFilter = raumFilter !== 'all' && DIALECT_ZONES.some(z => z.id === raumFilter);
          const isBLFilter   = raumFilter !== 'all' && bundeslaender.includes(raumFilter);

          // Active zones to show in radar
          const activeZones = DIALECT_ZONES.filter(z => zoneData[z.id]?.total > 0);
          const axisVariants = variants.filter(v => v.id !== 'sonstige');
          const N = axisVariants.length;
          if (N < 3) return null;

          // Radar geometry
          const cx = 130, cy = 130, r = 95;
          const angleStep = (2 * Math.PI) / N;
          const angle = i => -Math.PI / 2 + i * angleStep;
          const pt = (i, val) => {
            const a = angle(i);
            return [cx + val * r * Math.cos(a), cy + val * r * Math.sin(a)];
          };
          const gridLevels = [0.25, 0.5, 0.75, 1.0];

          // Build zone polygons
          const zonePolygons = activeZones.map(z => {
            const zd = zoneData[z.id];
            const pts = axisVariants.map((v, i) => {
              const val = zd.total > 0 ? (zd[v.id] || 0) / zd.total : 0;
              return pt(i, val);
            });
            return { zone: z, pts };
          });

          // BL polygon if a Bundesland is selected
          let blPolygon = null;
          if (isBLFilter) {
            const bl = blById[raumFilter];
            if (bl) {
              const blPts = axisVariants.map((v, i) => {
                const val = bl.total > 0 ? (bl[v.id] || 0) / bl.total : 0;
                return pt(i, val);
              });
              const zid = BL_TO_ZONE[raumFilter];
              blPolygon = { pts: blPts, color: zoneById[zid]?.color || '#0f172a', label: raumFilter };
            }
          }

          // Dim logic
          const dimZone = (zid) => {
            if (raumFilter === 'all') return false;
            if (isZoneFilter) return zid !== raumFilter;
            if (isBLFilter)   return true; // dim all zone polygons when BL selected
            return false;
          };

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

              {/* Filter dropdown */}
              <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:8 }}>FILTER</div>
                <div style={{ position:'relative' }}>
                  <select value={raumFilter} onChange={e => setRaumFilter(e.target.value)} style={{
                    width:'100%', padding:'8px 30px 8px 10px', borderRadius:6,
                    border:'1px solid #e2e8f0', background:'#f8fafc',
                    fontFamily:'Inter,sans-serif', fontSize:12, color:'#0f172a',
                    cursor:'pointer', outline:'none', appearance:'none',
                  }}>
                    <option value="all">Alle anzeigen</option>
                    <optgroup label="Dialektzonen">
                      {DIALECT_ZONES.map(z => (
                        <option key={z.id} value={z.id}>{z.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Bundesland">
                      {bundeslaender.map(bl => (
                        <option key={bl} value={bl}>{bl}</option>
                      ))}
                    </optgroup>
                  </select>
                  <svg width={9} height={9} viewBox="0 0 9 6" fill="#94a3b8"
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                    <path d="M4.594 6L0 0h9.188z"/>
                  </svg>
                </div>
              </div>

              {/* Radar SVG */}
              <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'12px', background:'#fafbfc' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#78859a', letterSpacing:'0.5px', marginBottom:10 }}>VARIANTENPROFIL PRO DIALEKTZONE</div>
                <svg viewBox="0 0 260 260" style={{ width:'100%', height:'auto', display:'block' }}>
                  {/* Grid rings */}
                  {gridLevels.map(lvl => (
                    <polygon key={lvl}
                      points={axisVariants.map((_, i) => pt(i, lvl).join(',')).join(' ')}
                      fill="none" stroke="#e2e8f0" strokeWidth={0.8}/>
                  ))}
                  {/* Axis lines */}
                  {axisVariants.map((v, i) => {
                    const [x, y] = pt(i, 1);
                    return <line key={v.id} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={0.8}/>;
                  })}
                  {/* Zone polygons */}
                  {zonePolygons.map(({ zone, pts: zpts }) => {
                    const isHovered  = hoveredZone === zone.id;
                    const isDimmed   = dimZone(zone.id);
                    const isSelected = isZoneFilter && raumFilter === zone.id;
                    return (
                      <polygon key={zone.id}
                        points={zpts.map(p => p.join(',')).join(' ')}
                        fill={zone.color + (isSelected || isHovered ? '55' : isDimmed ? '0a' : '22')}
                        stroke={zone.color}
                        strokeWidth={isSelected || isHovered ? 2 : 1}
                        opacity={isDimmed ? 0.3 : 1}
                        style={{ cursor:'pointer', transition:'all 0.15s' }}
                        onMouseEnter={() => setHoveredZone(zone.id)}
                        onMouseLeave={() => setHoveredZone(null)}
                      />
                    );
                  })}
                  {/* BL polygon overlay */}
                  {blPolygon && (
                    <polygon
                      points={blPolygon.pts.map(p => p.join(',')).join(' ')}
                      fill={blPolygon.color + '44'}
                      stroke={blPolygon.color}
                      strokeWidth={2.5}
                      strokeDasharray="4 2"
                    />
                  )}
                  {/* Axis labels */}
                  {axisVariants.map((v, i) => {
                    const [x, y] = pt(i, 1.18);
                    const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
                    return (
                      <text key={v.id} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
                        style={{ fontSize:8, fontFamily:'Liberation Mono, monospace', fill:'#334155' }}>
                        {v.label.length > 12 ? v.label.slice(0, 11) + '…' : v.label}
                      </text>
                    );
                  })}
                  {/* % labels on first axis */}
                  {gridLevels.map(lvl => {
                    const [x, y] = pt(0, lvl);
                    return (
                      <text key={lvl} x={x + 3} y={y} textAnchor="start" dominantBaseline="middle"
                        style={{ fontSize:7, fontFamily:'Inter, sans-serif', fill:'#94a3b8' }}>
                        {Math.round(lvl * 100)}%
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Combined zone / Bundesland list */}
              <div style={{ borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', overflow:'hidden' }}>
                {/* Toggle tabs */}
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
                  {raumListTab === 'zonen' && (
                    <>
                      {activeZones.map(z => {
                        const zd = zoneData[z.id];
                        const dominant = axisVariants.reduce((best, v) =>
                          (zd[v.id] || 0) > (zd[best?.id] || 0) ? v : best, axisVariants[0]);
                        const domPct = zd.total > 0 ? Math.round((zd[dominant?.id] || 0) / zd.total * 100) : 0;
                        const isSelected = isZoneFilter && raumFilter === z.id;
                        return (
                          <div key={z.id}
                            onMouseEnter={() => setHoveredZone(z.id)}
                            onMouseLeave={() => setHoveredZone(null)}
                            onClick={() => setRaumFilter(raumFilter === z.id ? 'all' : z.id)}
                            style={{
                              display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
                              borderRadius:6, marginBottom:2, cursor:'pointer',
                              background: isSelected || hoveredZone === z.id ? '#f1f5f9' : 'transparent',
                              border: isSelected ? `1px solid ${z.color}44` : '1px solid transparent',
                              transition:'all 0.15s',
                            }}>
                            <div style={{ width:10, height:10, borderRadius:2, background:z.color, flexShrink:0 }}/>
                            <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:500, color:'#334155', flex:1 }}>{z.label}</span>
                            <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:9, color:'#64748b' }}>{dominant?.label}</span>
                            <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700, color:'#0f172a', minWidth:28, textAlign:'right' }}>{domPct}%</span>
                          </div>
                        );
                      })}
                      {DIALECT_ZONES.filter(z => !zoneData[z.id]?.total).map(z => (
                        <div key={z.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:6, marginBottom:2, opacity:0.35 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:z.color, flexShrink:0 }}/>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#94a3b8' }}>{z.label}</span>
                          <span style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#cbd5e1', marginLeft:'auto' }}>keine Daten</span>
                        </div>
                      ))}
                    </>
                  )}

                  {raumListTab === 'bundesland' && bundeslaender.map(bl => {
                    const blRow = blById[bl];
                    if (!blRow) return null;
                    const zid = BL_TO_ZONE[bl];
                    const zColor = zoneById[zid]?.color || '#94a3b8';
                    const dominant = axisVariants.reduce((best, v) =>
                      (blRow[v.id] || 0) > (blRow[best?.id] || 0) ? v : best, axisVariants[0]);
                    const domPct = blRow.total > 0 ? Math.round((blRow[dominant?.id] || 0) / blRow.total * 100) : 0;
                    const isSelected = isBLFilter && raumFilter === bl;
                    return (
                      <div key={bl}
                        onClick={() => setRaumFilter(raumFilter === bl ? 'all' : bl)}
                        style={{
                          display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
                          borderRadius:6, marginBottom:2, cursor:'pointer',
                          background: isSelected ? '#f1f5f9' : 'transparent',
                          border: isSelected ? `1px solid ${zColor}44` : '1px solid transparent',
                          transition:'all 0.15s',
                        }}>
                        <div style={{ width:10, height:10, borderRadius:2, background:zColor, flexShrink:0 }}/>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:500, color:'#334155', flex:1 }}>{bl}</span>
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
