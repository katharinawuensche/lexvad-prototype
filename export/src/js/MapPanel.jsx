// MapPanel — Deck.gl interactive map with real tile basemap

const hexToRGB = (hex) => [
  parseInt(hex.slice(1,3),16),
  parseInt(hex.slice(3,5),16),
  parseInt(hex.slice(5,7),16),
];

const MapPanel = ({ phenomenon, selectedVariant, mapMode, onPointClick, sidebarOpen }) => {
  const { useState, useEffect, useRef, useMemo } = React;
  const { DATA_POINTS, VARIANTS } = window.LEXVAD;

  const containerRef = useRef(null);
  const deckRef      = useRef(null);
  const [hoverInfo,  setHoverInfo]  = useState(null);
  const [mapReady,   setMapReady]   = useState(false);

  const variants   = VARIANTS[phenomenon.id] || [];
  const variantMap = useMemo(() =>
    Object.fromEntries(variants.map(v => [v.id, v])),
    [phenomenon.id]
  );

  const phenPoints = useMemo(() =>
    DATA_POINTS.filter(p => p.item === phenomenon.id),
    [phenomenon.id]
  );

  const filteredPoints = useMemo(() =>
    selectedVariant === 'all'
      ? phenPoints
      : phenPoints.filter(p => p.variant === selectedVariant),
    [phenPoints, selectedVariant]
  );

  const totalOrte   = phenPoints.length;
  const totalBelege = phenPoints.reduce((s, p) => s + p.anzahl, 0);

  // Build deck.gl layers
  const buildLayers = (points, vMap) => {
    const { TileLayer, BitmapLayer, ScatterplotLayer } = window.deck;
    return [
      // Carto light basemap tiles (no API key)
      new TileLayer({
        id: 'basemap',
        data: (window.__resources?.carto_tiles) || 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        minZoom: 0, maxZoom: 19, tileSize: 256,
        renderSubLayers: (props) => {
          const { bbox: { west, south, east, north } } = props.tile;
          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north],
          });
        },
      }),
      // Dialect data points
      new ScatterplotLayer({
        id: 'dialect-points',
        data: points,
        getPosition: d => [d.lon, d.lat],
        getRadius: 6000,
        radiusUnits: 'meters',
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        getFillColor: d => {
          const v = vMap[d.variant];
          return v ? [...hexToRGB(v.color), 210] : [148, 163, 184, 180];
        },
        stroked: true,
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        onClick: ({ object }) => { if (object) onPointClick(object); },
        onHover: ({ object, x, y }) => setHoverInfo(object ? { object, x, y } : null),
      }),
    ];
  };

  // Initialize Deck.gl once
  useEffect(() => {
    if (!containerRef.current || !window.deck) return;
    const { Deck } = window.deck;

    deckRef.current = new Deck({
      parent: containerRef.current,
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
      initialViewState: {
        longitude: 13.4,
        latitude: 47.4,
        zoom: 6.3,
        pitch: 0,
        bearing: 0,
      },
      controller: true,
      layers: buildLayers(filteredPoints, variantMap),
      onLoad: () => setMapReady(true),
    });

    return () => { deckRef.current?.finalize(); deckRef.current = null; };
  }, []);

  // Update layers when data changes
  useEffect(() => {
    if (!deckRef.current) return;
    deckRef.current.setProps({ layers: buildLayers(filteredPoints, variantMap) });
  }, [filteredPoints, variantMap]);

  const legendItems = variants;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Map container */}
      <div style={{
        borderRadius: 12, border: '1px solid #e2e8f0',
        overflow: 'hidden', background: '#f0ece3',
        position: 'relative', height: 600,
        width: sidebarOpen ? 'calc(100% - 339px)' : '100%',
        transition: 'width 0.3s ease',
      }}>
        {/* Deck.gl mounts here */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Hover tooltip */}
        {hoverInfo && (() => {
          const { object: p, x, y } = hoverInfo;
          const v = variantMap[p.variant];
          const flipX = x > (containerRef.current?.clientWidth || 800) * 0.65;
          const flipY = y > (containerRef.current?.clientHeight || 600) * 0.6;
          return (
            <div style={{
              position: 'absolute',
              left:   flipX ? undefined : x + 12,
              right:  flipX ? (containerRef.current?.clientWidth  - x) + 12 : undefined,
              top:    flipY ? undefined : y + 12,
              bottom: flipY ? (containerRef.current?.clientHeight - y) + 12 : undefined,
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '10px 14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'none', zIndex: 10, minWidth: 170,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>{p.ort}</div>
              <TooltipRow label="Variante"    val={v ? v.label : p.variantLabel} mono />
              <TooltipRow label="Dialektform" val={p.rawVariante} mono />
              <TooltipRow label="Bundesland"  val={p.bundesland} />
              <TooltipRow label="Kreis"       val={p.kreis} />
            </div>
          );
        })()}

        {/* Stats badge — bottom left */}
        <div style={{
          position: 'absolute', left: 16, bottom: 16,
          background: 'rgba(255,255,255,0.93)', borderRadius: 8,
          border: '1px solid #e2e8f0', padding: '8px 14px',
          display: 'flex', flexDirection: 'column', gap: 4,
          backdropFilter: 'blur(8px)', zIndex: 5,
        }}>
          <StatRow icon="pin" label="Ortspunkte" val={totalOrte} />
          <StatRow icon="ppl" label="Belege"     val={totalBelege} />
        </div>

        {/* Legend — bottom right */}
        <div style={{
          position: 'absolute', right: 16, bottom: 16,
          background: 'rgba(255,255,255,0.93)', borderRadius: 8,
          border: '1px solid #e2e8f0', padding: '10px 14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)', zIndex: 5,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.5px', marginBottom: 8 }}>
            BELEG-VARIANTEN
          </div>
          {legendItems.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 20, marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
                <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 11, color: '#334155' }}>{v.label}</span>
              </div>
              {'pct' in v && (
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#64748b' }}>{v.pct}%</span>
              )}
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
          <div style={{
            background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            {[
              { label: '+', fn: () => deckRef.current?.setProps({ initialViewState: undefined }) || zoomDeck(1) },
              { label: '−', fn: () => zoomDeck(-1) },
            ].map((btn, i) => (
              <button key={btn.label} onClick={btn.fn} style={{
                display: 'block', width: 40, height: 40, background: 'none',
                border: i > 0 ? '1px solid #f1f5f9' : 'none',
                borderBottom: i === 0 ? '1px solid #f1f5f9' : 'none',
                cursor: 'pointer', fontSize: 18, color: '#0f172a',
                fontFamily: 'Inter,sans-serif', fontWeight: 300,
              }}>{btn.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Tooltip row helper
const TooltipRow = ({ label, val, mono }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Inter,sans-serif', minWidth: 68 }}>{label}:</span>
    <span style={{ fontSize: 11, color: '#334155', fontFamily: mono ? 'Liberation Mono,monospace' : 'Inter,sans-serif', fontWeight: 500 }}>{val}</span>
  </div>
);

// Stats row helper
const StatRow = ({ icon, label, val }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}>
      {icon === 'pin'
        ? <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>
        : <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
      }
    </svg>
    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#64748b' }}>{label}:</span>
    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{val.toLocaleString('de-AT')}</span>
  </div>
);

// Stub — zoom handled by deck.gl controller natively via scroll/pinch
function zoomDeck(dir) {}

Object.assign(window, { MapPanel });
