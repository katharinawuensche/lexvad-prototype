// App.jsx — main application component

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dotSize": 1,
  "showZoneBar": true,
  "animateCharts": true,
  "accentColor": "#0f172a"
}/*EDITMODE-END*/;

const VIEWS = [
  { id:'punktkarte',    label:'Punktkarte',   icon:'map-pin', group:'map' },
  { id:'flaechenkarte', label:'Flächenkarte', icon:'layers',  group:'map' },
  { id:'verteilung',    label:'Verteilung',   icon:'bar',     group:'viz', badge:'Neu' },
  { id:'vergleichen',   label:'Vergleichen',  icon:'compare', group:'viz' },
];

const ViewIcon = ({ id }) => {
  const s = { width:13, height:13, flexShrink:0 };
  const icons = {
    'map-pin': <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    'layers':  <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    'bar':     <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    'compare': <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/></svg>,
  };
  return icons[id] || null;
};

// ── Point-in-polygon (ray casting) ───────────────────────────────────────────
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function assignZone(lon, lat, geojson) {
  if (!geojson) return null;
  for (const f of geojson.features) {
    const ring = f.geometry.coordinates[0];
    if (pointInRing(lon, lat, ring)) return f.properties.Dialektregion_Name;
  }
  return null;
}

const App = () => {
  const { useState, useEffect } = React;
  const { PHENOMENA, VARIANTS, DATA_POINTS } = window.LEXVAD;

  const getLS = (k, d) => { try { return JSON.parse(localStorage.getItem('lexvad_' + k)) ?? d; } catch { return d; } };
  const setLS = (k, v) => { try { localStorage.setItem('lexvad_' + k, JSON.stringify(v)); } catch {} };

  const [page,           setPage]           = useState(() => getLS('page', 'kartierung'));
  const [view,           setView]           = useState(() => getLS('view', 'punktkarte'));
  const [phenId,         setPhenId]         = useState(() => getLS('phenId', PHENOMENA[0].id));
  const [variantSel,     setVariantSel]     = useState('all');
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [clickedVariantId, setClickedVariantId] = useState(null);
  const [leftPhen,       setLeftPhen]       = useState(() => getLS('leftPhen',  PHENOMENA[0].id));
  const [rightPhen,      setRightPhen]      = useState(() => getLS('rightPhen', PHENOMENA[2]?.id || PHENOMENA[1].id));
  const [leftVariantSel, setLeftVariantSel] = useState('all');
  const [rightVariantSel,setRightVariantSel]= useState('all');
  const [leftMapType,    setLeftMapType]    = useState('punktkarte');
  const [rightMapType,   setRightMapType]   = useState('punktkarte');
  const [tweaks,         setTweaks]         = useState(TWEAK_DEFAULTS);
  const [tweakOpen,      setTweakOpen]      = useState(false);
  const [geojsonData,    setGeojsonData]    = useState(null);
  const [zoneAssignments,setZoneAssignments]= useState({});

  // Load GeoJSON + compute point-in-polygon zone assignments
  useEffect(() => {
    fetch('assets/dialektregionen.geojson.json')
      .then(r => r.json())
      .then(geo => {
        setGeojsonData(geo);
        const assignments = {};
        DATA_POINTS.forEach(p => {
          const z = assignZone(p.lon, p.lat, geo);
          if (z) assignments[p.id] = z;
        });
        setZoneAssignments(assignments);
      })
      .catch(e => console.warn('GeoJSON load failed', e));
  }, []);

  useEffect(() => { setLS('page',      page);      }, [page]);
  useEffect(() => { setLS('view',      view);      }, [view]);
  useEffect(() => { setLS('phenId',    phenId);    }, [phenId]);
  useEffect(() => { setLS('leftPhen',  leftPhen);  }, [leftPhen]);
  useEffect(() => { setLS('rightPhen', rightPhen); }, [rightPhen]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweakOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweakOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const applyTweak = (key, val) => {
    setTweaks(prev => ({ ...prev, [key]: val }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  };

  const phenomenon = PHENOMENA.find(p => p.id === phenId) || PHENOMENA[0];
  const variants   = VARIANTS[phenId] || [];
  const mapMode    = view === 'flaechenkarte' ? 'flaeche' : 'punkt';

  // ── Shared dropdown ──────────────────────────────────────────────────────────
  const PhenSelect = ({ value, onChange }) => (
    <div style={{ position:'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width:'100%', padding:'9px 34px 9px 12px', borderRadius:6,
        border:'1px solid #e2e8f0', background:'#f8fafc',
        fontFamily:'Inter,sans-serif', fontSize:13, color:'#0f172a',
        cursor:'pointer', outline:'none', appearance:'none',
      }}>
        {PHENOMENA.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <svg width={9} height={9} viewBox="0 0 9 6" fill="#94a3b8"
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
        <path d="M4.594 6L0 0h9.188z"/>
      </svg>
    </div>
  );

  // ── One half of the split settings header ────────────────────────────────────
  const CompareSideSettings = ({ phenValue, onPhenChange, variantValue, onVariantChange, mapTypeValue, onMapTypeChange, isLeft, showClose }) => {
    const sideVariants = VARIANTS[phenValue] || [];
    return (
      <div style={{ flex:1, position:'relative', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'20px 24px' }}>

        {/* Close button */}
        {showClose && (
          <button onClick={() => setView('punktkarte')} title="Vergleich beenden" style={{
            position:'absolute', top:10, right:10, width:24, height:24, borderRadius:'50%',
            border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#94a3b8', transition:'all 0.15s',
          }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}

        {/* Dropdowns row */}
        <div style={{ display:'flex', gap:20, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ flex:'1 1 160px', minWidth:0 }}>
            <label style={{ display:'block', fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.6px', color:'#64748b', marginBottom:6 }}>PHÄNOMEN</label>
            <PhenSelect value={phenValue} onChange={onPhenChange}/>
          </div>
          <div style={{ flex:'1 1 140px', minWidth:0 }}>
            <label style={{ display:'block', fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.6px', color:'#64748b', marginBottom:6 }}>VARIANTEN</label>
            <div style={{ position:'relative' }}>
              <select value={variantValue} onChange={e => onVariantChange(e.target.value)} style={{
                width:'100%', padding:'9px 34px 9px 12px', borderRadius:6,
                border:'1px solid #e2e8f0', background:'#f8fafc',
                fontFamily:'Inter,sans-serif', fontSize:13, color:'#0f172a',
                cursor:'pointer', outline:'none', appearance:'none',
              }}>
                <option value="all">Alle anzeigen</option>
                {sideVariants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <svg width={9} height={9} viewBox="0 0 9 6" fill="#94a3b8"
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <path d="M4.594 6L0 0h9.188z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Map type + reset row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:4, gap:2 }}>
            {VIEWS.filter(v => v.group === 'map').map(v => (
              <button key={v.id} onClick={() => onMapTypeChange(v.id)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:5,
                background: mapTypeValue === v.id ? '#fff' : 'transparent', border:'none', cursor:'pointer',
                fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:13,
                color: mapTypeValue === v.id ? '#0f172a' : '#64748b',
                boxShadow: mapTypeValue === v.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition:'all 0.15s',
              }}>
                <ViewIcon id={v.icon}/>{v.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { onPhenChange(isLeft ? PHENOMENA[0].id : (PHENOMENA[2]?.id || PHENOMENA[1].id)); onVariantChange('all'); }}
            title="Zurücksetzen"
            style={{ width:32, height:32, borderRadius:6, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', transition:'all 0.15s' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // ── Settings bar ─────────────────────────────────────────────────────────────
  const SettingsBar = () => {
    if (view === 'vergleichen') {
      return (
        <div style={{ display:'flex', gap:12, alignItems:'stretch', marginBottom:16 }}>
          <CompareSideSettings
            phenValue={leftPhen}       onPhenChange={setLeftPhen}
            variantValue={leftVariantSel}  onVariantChange={setLeftVariantSel}
            mapTypeValue={leftMapType}     onMapTypeChange={setLeftMapType}
            isLeft={true}
          />
          {/* Swap button */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <button
              onClick={() => {
                const tp = leftPhen;       setLeftPhen(rightPhen);        setRightPhen(tp);
                const tv = leftVariantSel; setLeftVariantSel(rightVariantSel); setRightVariantSel(tv);
                const tm = leftMapType;    setLeftMapType(rightMapType);   setRightMapType(tm);
              }}
              title="Tauschen"
              style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', transition:'all 0.15s' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
          </div>
          <CompareSideSettings
            phenValue={rightPhen}      onPhenChange={setRightPhen}
            variantValue={rightVariantSel} onVariantChange={setRightVariantSel}
            mapTypeValue={rightMapType}    onMapTypeChange={setRightMapType}
            isLeft={false} showClose={true}
          />
        </div>
      );
    }

    return (
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', padding:'20px 24px', marginBottom:16 }}>

        {/* Top row: Phänomen, Varianten, divider, Visualisierungen, actions */}
        <div style={{ display:'flex', gap:20, alignItems:'flex-end', flexWrap:'wrap' }}>

          <div style={{ flex:'0 0 340px' }}>
            <label style={{ display:'block', fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.6px', color:'#64748b', marginBottom:6 }}>PHÄNOMEN</label>
            <PhenSelect value={phenId} onChange={v => { setPhenId(v); setVariantSel('all'); }}/>
          </div>

          <div style={{ flex:'0 0 280px' }}>
            <label style={{ display:'block', fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.6px', color:'#64748b', marginBottom:6 }}>VARIANTEN</label>
            <div style={{ position:'relative' }}>
              <select value={variantSel} onChange={e => setVariantSel(e.target.value)} style={{
                width:'100%', padding:'9px 34px 9px 12px', borderRadius:6,
                border:'1px solid #e2e8f0', background:'#f8fafc',
                fontFamily:'Inter,sans-serif', fontSize:13, color:'#0f172a',
                cursor:'pointer', outline:'none', appearance:'none',
              }}>
                <option value="all">Alle anzeigen</option>
                {variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <svg width={9} height={9} viewBox="0 0 9 6" fill="#94a3b8"
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <path d="M4.594 6L0 0h9.188z"/>
              </svg>
            </div>
          </div>

          <div style={{ flex:'none', height:40, width:1, background:'#f1f5f9', alignSelf:'center' }}/>

          <div>
            <label style={{ display:'block', fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.6px', color:'#64748b', marginBottom:6 }}>VISUALISIERUNGEN</label>
            <div style={{ display:'flex', gap:6 }}>
              {/* Karte — always first */}
              <button onClick={() => setView('punktkarte')} style={{
                display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:6,
                background: (view === 'punktkarte' || view === 'flaechenkarte') ? '#0f172a' : '#f8fafc',
                border: (view === 'punktkarte' || view === 'flaechenkarte') ? 'none' : '1px solid #e2e8f0',
                cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:12,
                color: (view === 'punktkarte' || view === 'flaechenkarte') ? '#fff' : '#334155',
                transition:'all 0.15s',
              }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Karte
              </button>
              {VIEWS.filter(v => v.group === 'viz').map(v => (
                <button key={v.id} onClick={() => setView(v.id)} style={{
                  display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:6,
                  background: view === v.id ? '#0f172a' : '#f8fafc',
                  border: view === v.id ? 'none' : '1px solid #e2e8f0',
                  cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:12,
                  color: view === v.id ? '#fff' : '#334155',
                  transition:'all 0.15s',
                }}>
                  <ViewIcon id={v.icon}/>
                  {v.label}
                  {v.badge && (
                    <span style={{
                      background: view === v.id ? 'rgba(255,255,255,0.2)' : '#0f172a',
                      color:'#fff', borderRadius:10, padding:'1px 5px',
                      fontFamily:'Inter,sans-serif', fontSize:9, fontWeight:700,
                    }}>{v.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <ActionBtn icon="eye" label="Details" onClick={() => setSidebarOpen(s => !s)} active={sidebarOpen}/>
            <ActionBtn icon="reset" label="" onClick={() => { setPhenId(PHENOMENA[0].id); setVariantSel('all'); }}/>
          </div>
        </div>

        {/* Bottom row: Kartentyp + share URL */}
        <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid #f1f5f9', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:10, color:'#94a3b8', letterSpacing:'0.5px', marginRight:4 }}>KARTENTYP</span>
          <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:4, gap:2 }}>
            {VIEWS.filter(v => v.group === 'map').map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:5,
                background: view === v.id ? '#fff' : 'transparent', border:'none', cursor:'pointer',
                fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:13,
                color: view === v.id ? '#0f172a' : '#64748b',
                boxShadow: view === v.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition:'all 0.15s',
              }}>
                <ViewIcon id={v.icon}/>{v.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <input readOnly value={`https://lexat21.research.at/de/maps?a=0,100&q=${phenId}`} style={{
              padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0',
              fontFamily:'Liberation Mono,monospace', fontSize:10, color:'#64748b',
              background:'#f8fafc', width:280, outline:'none',
            }}/>
            <button style={{
              padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0',
              background:'#fff', fontFamily:'Inter,sans-serif', fontSize:11, color:'#334155',
              cursor:'pointer', fontWeight:500,
            }}>Kopieren</button>
          </div>
        </div>

      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter,sans-serif' }}>
      <Header activePage={page} onNavigate={p => { setPage(p); if (p === 'kartierung') setView('punktkarte'); }}/>

      <div style={{ paddingTop:65 }}>

        {page === 'kartierung' && (
          <div style={{ maxWidth:1280, margin:'0 auto', padding:'24px 24px 40px' }}>
            <SettingsBar/>

            <div style={{ position:'relative', transition:'margin-right 0.3s ease' }}>
              {(view === 'punktkarte' || view === 'flaechenkarte') && (
                <MapPanel phenomenon={phenomenon} selectedVariant={variantSel} mapMode={mapMode} onPointClick={(pt) => { setSidebarOpen(true); if (pt?.variant) setClickedVariantId(pt.variant); }} sidebarOpen={sidebarOpen} geojsonData={geojsonData}/>
              )}
              {view === 'vergleichen' && (
                <ComparePanel phenomenon={phenomenon} leftPhen={leftPhen} rightPhen={rightPhen} onChangeLeft={setLeftPhen} onChangeRight={setRightPhen}/>
              )}
              {view === 'verteilung' && (
                <DistributionChart phenomenon={phenomenon}/>
              )}
              {(view === 'punktkarte' || view === 'flaechenkarte') && (
                <div style={{ marginTop:16 }}><BelegDB phenomenon={phenomenon}/></div>
              )}
            </div>

            {sidebarOpen && <Sidebar phenomenon={phenomenon} onClose={() => setSidebarOpen(false)} zoneAssignments={zoneAssignments} geojsonData={geojsonData} clickedVariantId={clickedVariantId}/>}
          </div>
        )}

        {page === 'belegdatenbank' && (
          <div style={{ maxWidth:1280, margin:'0 auto', padding:'24px' }}>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:20, color:'#0f172a', margin:0 }}>Belegdatenbank</h2>
              <p style={{ fontFamily:'Inter,sans-serif', fontSize:13, color:'#64748b', margin:'4px 0 0' }}>Vollständige Auflistung aller erfassten Dialektbelege</p>
            </div>
            <BelegDB phenomenon={phenomenon}/>
          </div>
        )}

        {page === 'projekt' && (
          <div style={{ maxWidth:760, margin:'60px auto', padding:'0 24px' }}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'40px' }}>
              <div style={{ fontFamily:'Tiro Bangla, serif', fontSize:32, color:'#0f172a', marginBottom:8 }}>LexVAD20</div>
              <div style={{ fontFamily:'Inter,sans-serif', fontSize:13, color:'#64748b', marginBottom:24, lineHeight:1.6 }}>Lexikalischer Variation Atlas des Deutschen im 20. Jahrhundert</div>
              <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, color:'#334155', lineHeight:1.7, marginBottom:16 }}>LexVAD20 dokumentiert die lexikalische Variation des österreichischen Deutsch anhand umfangreicher Fragebogenerhebungen aus dem 20. Jahrhundert. Das Projekt kartiert dialektale Varianten für Hunderte von Phänomenen und macht diese geografisch visualisierbar.</p>
              <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, color:'#334155', lineHeight:1.7 }}>Die Datengrundlage bilden die Sammlungen der österreichischen Dialektwörterbücher (WBÖ, ÖWB) sowie regionaler Atlanten wie VALTS, SBS und WAB.</p>
            </div>
          </div>
        )}

        {page === 'kartenkommentare' && (
          <div style={{ maxWidth:1280, margin:'40px auto', padding:'0 24px', textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontFamily:'Inter,sans-serif', fontSize:14 }}>Kartenkommentare werden in einer zukünftigen Version verfügbar sein.</div>
          </div>
        )}

      </div>

      <footer style={{ borderTop:'1px solid #e2e8f0', padding:'16px 24px', fontFamily:'Inter,sans-serif', fontSize:11, color:'#94a3b8', background:'#fff' }}>
        Impressum
      </footer>

      {tweakOpen && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding:'16px', width:240, zIndex:200 }}>
          <div style={{ fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:12 }}>Tweaks</div>
          <TweakSlider label="Punktgröße" min={0.5} max={2} step={0.1} value={tweaks.dotSize} onChange={v => applyTweak('dotSize', v)}/>
          <TweakToggle label="Dialektzone-Leiste" value={tweaks.showZoneBar} onChange={v => applyTweak('showZoneBar', v)}/>
          <TweakToggle label="Chart-Animationen" value={tweaks.animateCharts} onChange={v => applyTweak('animateCharts', v)}/>
        </div>
      )}
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const ActionBtn = ({ icon, label, onClick, active }) => {
  const icons = {
    eye:   <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    reset: <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>,
  };
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:6,
      border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
      background: active ? '#0f172a' : '#fff',
      fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:12,
      color: active ? '#fff' : '#334155',
      cursor:'pointer', transition:'all 0.15s', boxShadow:'0 1px 2px rgba(0,0,0,0.05)',
    }}>
      {icons[icon]}{label}
    </button>
  );
};

const TweakSlider = ({ label, min, max, step, value, onChange }) => (
  <div style={{ marginBottom:12 }}>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
      <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#64748b' }}>{label}</span>
      <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color:'#334155' }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width:'100%', cursor:'pointer' }}/>
  </div>
);

const TweakToggle = ({ label, value, onChange }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
    <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#64748b' }}>{label}</span>
    <button onClick={() => onChange(!value)} style={{ width:36, height:20, borderRadius:10, background: value ? '#0f172a' : '#cbd5e1', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
      <div style={{ position:'absolute', top:2, left: value ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
