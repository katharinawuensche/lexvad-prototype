// ComparePanel — side-by-side deck.gl map comparison

const CompareSide = ({ phenId, side }) => {
  const { useState, useEffect, useRef, useMemo } = React;
  const { DATA_POINTS, VARIANTS, PHENOMENA } = window.LEXVAD;

  const containerRef = useRef(null);
  const deckRef      = useRef(null);
  const [hoverInfo,  setHoverInfo]  = useState(null);
  const [viewState,  setViewState]  = useState({
    longitude: 13.4, latitude: 47.4, zoom: 6.0, pitch: 0, bearing: 0,
  });

  const phen      = PHENOMENA.find(p => p.id === phenId) || PHENOMENA[0];
  const variants  = VARIANTS[phenId] || [];
  const variantMap = useMemo(() =>
    Object.fromEntries(variants.map(v => [v.id, v])), [phenId]);

  const pts = useMemo(() =>
    DATA_POINTS.filter(p => p.item === phenId), [phenId]);

  const totalOrte   = pts.length;
  const totalBelege = pts.reduce((s, p) => s + p.anzahl, 0);

  const buildLayers = (points, vMap) => {
    const { TileLayer, BitmapLayer, ScatterplotLayer } = window.deck;
    return [
      new TileLayer({
        id: `basemap-${side}`,
        data: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        minZoom: 0, maxZoom: 19, tileSize: 256,
        renderSubLayers: (props) => {
          const { bbox: { west, south, east, north } } = props.tile;
          return new BitmapLayer(props, { data: null, image: props.data, bounds: [west, south, east, north] });
        },
      }),
      new ScatterplotLayer({
        id: `dialect-points-${side}`,
        data: points,
        getPosition: d => [d.lon, d.lat],
        getRadius: 6000,
        radiusUnits: 'meters',
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        getFillColor: d => {
          const v = vMap[d.variant];
          const hex = v ? v.color : '#94a3b8';
          return [...[parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)], 210];
        },
        stroked: true,
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        onHover: ({ object, x, y }) => setHoverInfo(object ? { object, x, y } : null),
      }),
    ];
  };

  // Init deck
  useEffect(() => {
    if (!containerRef.current || !window.deck) return;
    const { Deck } = window.deck;
    deckRef.current = new Deck({
      parent: containerRef.current,
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
      initialViewState: viewState,
      controller: true,
      layers: buildLayers(pts, variantMap),
    });
    return () => { deckRef.current?.finalize(); deckRef.current = null; };
  }, []);

  // Update layers when phenomenon changes
  useEffect(() => {
    if (!deckRef.current) return;
    deckRef.current.setProps({ layers: buildLayers(pts, variantMap) });
  }, [pts, variantMap]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
        {[
          { label: 'BÖGEN',     val: phen.boegenCount.toLocaleString('de-AT') },
          { label: 'VARIANTEN', val: phen.variantCount },
        ].map(({ label, val }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: '8px 12px', flex: 1, textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{
        borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden',
        background: '#f0ece3', position: 'relative', height: 420, flex: 'none',
      }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Tooltip */}
        {hoverInfo && (() => {
          const { object: p, x, y } = hoverInfo;
          const v = variantMap[p.variant];
          const w = containerRef.current?.clientWidth  || 500;
          const h = containerRef.current?.clientHeight || 420;
          return (
            <div style={{
              position: 'absolute',
              left:   x > w * 0.65 ? undefined : x + 12,
              right:  x > w * 0.65 ? (w - x) + 12 : undefined,
              top:    y > h * 0.65 ? undefined : y + 12,
              bottom: y > h * 0.65 ? (h - y) + 12 : undefined,
              background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '10px 14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'none', zIndex: 10, minWidth: 160,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{p.ort}</div>
              {[
                { label: 'Variante',    val: v ? v.label : p.variantLabel, mono: true },
                { label: 'Dialektform', val: p.rawVariante, mono: true },
                { label: 'Bundesland',  val: p.bundesland },
              ].map(({ label, val, mono }) => (
                <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 68 }}>{label}:</span>
                  <span style={{ fontSize: 11, color: '#334155', fontFamily: mono ? 'Liberation Mono,monospace' : 'Inter,sans-serif', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Stats badge */}
        <div style={{
          position: 'absolute', left: 12, bottom: 12,
          background: 'rgba(255,255,255,0.93)', borderRadius: 7,
          border: '1px solid #e2e8f0', padding: '7px 12px',
          backdropFilter: 'blur(8px)', zIndex: 5,
        }}>
          {[
            { label: 'Ortspunkte', val: totalOrte },
            { label: 'Belege',     val: totalBelege },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#64748b' }}>{label}:</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, color: '#0f172a' }}>{val.toLocaleString('de-AT')}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', right: 12, bottom: 12,
          background: 'rgba(255,255,255,0.93)', borderRadius: 7,
          border: '1px solid #e2e8f0', padding: '9px 12px',
          backdropFilter: 'blur(8px)', zIndex: 5,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#334155', letterSpacing: '0.5px', marginBottom: 6 }}>VARIANTEN</div>
          {variants.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 10, color: '#334155' }}>{v.label}</span>
              </div>
              {'pct' in v && (
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#64748b' }}>{v.pct}%</span>
              )}
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 5 }}>
          <div style={{
            background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            {['+', '−'].map((lbl, i) => (
              <button key={lbl} style={{
                display: 'block', width: 36, height: 36, background: 'none',
                border: 'none', borderBottom: i === 0 ? '1px solid #f1f5f9' : 'none',
                cursor: 'pointer', fontSize: 18, color: '#0f172a', fontWeight: 300,
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Variant distribution bar */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', marginBottom: 8 }}>VARIANTENVERTEILUNG</div>
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
          {variants.map(v => (
            <div key={v.id} title={`${v.label}: ${v.pct}%`}
              style={{ width: `${v.pct}%`, background: v.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
          {variants.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
              <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 10, color: '#334155' }}>{v.label}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 600, color: '#0f172a' }}>{v.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ComparePanel = ({ phenomenon, leftPhen, rightPhen, onChangeLeft, onChangeRight }) => {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <CompareSide phenId={leftPhen}  side="left"  />
      <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0, alignSelf: 'stretch' }} />
      <CompareSide phenId={rightPhen} side="right" />
    </div>
  );
};

Object.assign(window, { ComparePanel });
