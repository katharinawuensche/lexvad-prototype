// MapPanel — Deck.gl interactive map with dialect region polygons + data points

const hexToRGB = (hex) => [
  parseInt(hex.slice(1,3),16),
  parseInt(hex.slice(3,5),16),
  parseInt(hex.slice(5,7),16),
];

// Dialect region colors — single source of truth is window.LEXVAD_ZONE_COLORS (set by Sidebar.jsx)
const ZONE_LABEL_COLORS = window.LEXVAD_ZONE_COLORS;
const ZONE_COLORS = Object.fromEntries(
  Object.entries(ZONE_LABEL_COLORS).map(([k, v]) => [k, hexToRGB(v)])
);

// ── Voronoi cell builder (clipped to extended bbox) ────────────────────────
function buildVoronoiCells(points) {
  if (!window.d3 || !window.d3.Delaunay || points.length < 3) return [];
  const coords = points.map(p => [p.lon, p.lat]);
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const pad = 0.5;
  const bbox = [
    Math.min(...lons) - pad, Math.min(...lats) - pad,
    Math.max(...lons) + pad, Math.max(...lats) + pad,
  ];
  const delaunay = window.d3.Delaunay.from(coords);
  const voronoi  = delaunay.voronoi(bbox);
  const cells = [];
  for (let i = 0; i < points.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (poly) cells.push({ point: points[i], polygon: poly });
  }
  return cells;
}

function ringsEqual(a, b) {
  return !!a && !!b && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

function closeRing(ring) {
  if (!ring || ring.length < 3) return ring || [];
  return ringsEqual(ring[0], ring[ring.length - 1]) ? ring : [...ring, ring[0]];
}

function buildAustriaMultiPolygon(geojson) {
  if (!geojson?.features?.length) return null;
  const polygons = [];
  geojson.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      polygons.push(geometry.coordinates.map(closeRing));
      return;
    }
    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon) => polygons.push(polygon.map(closeRing)));
    }
  });
  return polygons.length ? polygons : null;
}

function clipVoronoiCellsToMask(cells, maskMultiPolygon) {
  const clipper = window.polygonClipping;
  if (!clipper || !maskMultiPolygon?.length) return cells;

  const clippedCells = [];
  cells.forEach((cell) => {
    const clipped = clipper.intersection([[closeRing(cell.polygon)]], maskMultiPolygon);
    if (!clipped || !clipped.length) return;
    clipped.forEach((polygon) => {
      if (!polygon?.length) return;
      clippedCells.push({
        point: cell.point,
        polygon: polygon.map(closeRing),
      });
    });
  });
  return clippedCells;
}

// Clip a polygon to a list of polygon features (geo zone clipping by simple
// containment of a fine sample of points — keeps cells from spilling onto sea).
// For our purposes the bbox-clipped Voronoi works fine; no extra clip needed.

const MapPanel = ({ phenomenon, selectedVariant, mapMode, onPointClick, sidebarOpen, geojsonData }) => {
  const { useState, useEffect, useRef, useMemo } = React;
  const { DATA_POINTS, VARIANTS } = window.LEXVAD;

  const containerRef = useRef(null);
  const deckRef      = useRef(null);
  const [hoverInfo,  setHoverInfo] = useState(null);
  const [showZones,  setShowZones] = useState(true);
  // Flächenkarte sub-modes: 'hexagon' | 'voronoi' | 'heatmap'
  const [areaMode,   setAreaMode]  = useState('voronoi');
  const [hexRadius,     setHexRadius]     = useState(8000); // meters
  const [heatmapRadius, setHeatmapRadius] = useState(38);   // pixels

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

  // Austria outline — collected from all dialect-region polygons. Used as a
  // MaskExtension clip for the area layers so hex/voronoi/heatmap don't bleed
  // past the national border.
  const austriaMaskData = useMemo(() => {
    if (!geojsonData) return null;
    const polygons = [];
    geojsonData.features.forEach(f => {
      const g = f.geometry;
      if (!g) return;
      if (g.type === 'Polygon') polygons.push(g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => polygons.push(p));
    });
    return polygons.map(rings => ({ polygon: rings }));
  }, [geojsonData]);

  const austriaClipMultiPolygon = useMemo(() =>
    buildAustriaMultiPolygon(geojsonData),
    [geojsonData]
  );

  // Inverse mask — a huge outer ring with each Austria polygon as an inner
  // hole. Drawn ABOVE aggregation layers (hex, heatmap) to crop their bleed
  // visually. MaskExtension can't be used on aggregation layers in 8.9.
  // const austriaInverseMask = useMemo(() => {
  //   if (!austriaMaskData || !austriaMaskData.length) return null;
  //   const outer = [[-30, 25], [50, 25], [50, 75], [-30, 75], [-30, 25]];
  //   // Use only the outer rings (first ring) of each Austria polygon as holes.
  //   const holes = austriaMaskData.map(p => p.polygon[0]);
  //   return [{ polygon: [outer, ...holes] }];
  // }, [austriaMaskData]);

  const totalOrte   = phenPoints.length;
  const totalBelege = phenPoints.reduce((s, p) => s + p.anzahl, 0);

  // Build deck.gl layers
  const buildLayers = (points, vMap, geojson, zonesVisible, mode, areaSubMode, hexR, heatR, maskData, inverseMask, clipMultiPolygon) => {
    const { TileLayer, BitmapLayer, ScatterplotLayer, GeoJsonLayer, HexagonLayer, HeatmapLayer, PolygonLayer, SolidPolygonLayer, MaskExtension } = window.deck;
    const hasMask = !!(maskData && maskData.length && MaskExtension);
    const usesAreaMask = hasMask && mode === 'flaeche' && areaSubMode !== 'voronoi';
    const maskProps = usesAreaMask ? { extensions: [new MaskExtension()], maskId: 'austria-mask' } : {};
    const layers = [];

    // Helper: build a Carto-light basemap TileLayer. Used twice — once below
    // the data layers, and once above the inverse mask (when hex/heatmap is
    // active) to restore map tiles outside Austria after the cream cover-up.
    const makeBasemap = (id, extra = {}) => new TileLayer({
      id,
      data: (window.__resources && window.__resources.carto_tiles) || 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      minZoom: 0, maxZoom: 19, tileSize: 256,
      renderSubLayers: (props) => {
        const { bbox: { west, south, east, north } } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
      ...extra,
    });

    // Mask layer — only needed for modes that use MaskExtension (not voronoi).
    // Aggregation layers (hex, heatmap) invalidate the mask framebuffer, so
    // voronoi drops the mask entirely and relies on its natural data bounds.
    if (usesAreaMask) {
      layers.push(new SolidPolygonLayer({
        id: 'austria-mask',
        data: maskData,
        getPolygon: d => d.polygon,
        getFillColor: [0, 0, 0, 255],
        operation: 'mask',
        extensions: [new MaskExtension()],
      }));
    }

    // Inverse-mask availability flag — we reuse the single `austria-mask`
    // layer with `maskInverted: true` on the restore basemap, rather than
    // pushing a second mask-operation layer (which would conflict).
    const hasInverseMask = usesAreaMask && !!(inverseMask && inverseMask.length);

    // Carto light basemap (full extent)
    layers.push(makeBasemap('basemap'));

    // Dialect region polygons
    if (geojson && zonesVisible) {
      layers.push(new GeoJsonLayer({
        id: 'dialect-zones',
        data: geojson,
        stroked: true,
        filled: mode === 'punkt' || areaSubMode !== 'voronoi',
        getFillColor: f => {
          const c = ZONE_COLORS[f.properties.Dialektregion_Name] || [200, 200, 200];
          return [...c, 30];
        },
        getLineColor: f => {
          const c = ZONE_COLORS[f.properties.Dialektregion_Name] || [150, 150, 150];
          return [...c, mode === 'flaeche' ? 230 : 200];
        },
        lineWidthMinPixels: mode === 'flaeche' ? 2 : 1.5,
        lineWidthMaxPixels: 4,
        pickable: false,
      }));
    }

    // ── FLÄCHENKARTE: aggregation layers ────────────────────────────────────
    if (mode === 'flaeche') {
      if (areaSubMode === 'voronoi') {
        const cells = clipVoronoiCellsToMask(buildVoronoiCells(points), clipMultiPolygon);
        layers.push(new PolygonLayer({
          id: 'voronoi-cells',
          data: cells,
          getPolygon: d => d.polygon,
          getFillColor: d => {
            const v = vMap[d.point.variant];
            return v ? [...hexToRGB(v.color), 170] : [148, 163, 184, 140];
          },
          getLineColor: [255, 255, 255, 220],
          lineWidthMinPixels: 0.6,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          onClick: ({ object }) => { if (object) onPointClick(object.point); },
          onHover: ({ object, x, y }) => setHoverInfo(object ? { object: object.point, x, y } : null),
          ...maskProps,
        }));
        // small marker dots so points are still locatable
        layers.push(new ScatterplotLayer({
          id: 'voronoi-markers',
          data: points,
          getPosition: d => [d.lon, d.lat],
          getRadius: 1.5, radiusUnits: 'pixels',
          radiusMinPixels: 1.5, radiusMaxPixels: 2.5,
          getFillColor: [15, 23, 42, 220],
          pickable: false,
        }));
      } else if (areaSubMode === 'hexagon') {
        // Color hexagons by dominant Beleg-Variante in each bin.
        // We map each variant id → an integer index, return that index from
        // getColorValue, and supply a matching colorRange + colorDomain so
        // deck.gl uses our palette as a discrete lookup.
        const variantIds = Object.keys(vMap);
        const idToIdx = Object.fromEntries(variantIds.map((id, i) => [id, i]));
        const variantColorRange = variantIds.length
          ? variantIds.map(id => hexToRGB(vMap[id].color))
          : [[148, 163, 184]];
        const colorDomain = variantIds.length
          ? [0, Math.max(0, variantIds.length - 1)]
          : [0, 1];

        const dominantVariantIdx = (pts) => {
          const counts = {};
          pts.forEach(p => {
            const src = p.source || p;
            counts[src.variant] = (counts[src.variant] || 0) + 1;
          });
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          return top ? (idToIdx[top[0]] ?? 0) : 0;
        };

        layers.push(new HexagonLayer({
          id: 'hex-bins',
          data: points,
          getPosition: d => [d.lon, d.lat],
          radius: hexR,
          coverage: 0.92,
          extruded: false,
          opacity: 0.82,
          getColorValue: dominantVariantIdx,
          colorDomain,
          colorRange: variantColorRange,
          colorScaleType: 'quantize',
          updateTriggers: {
            getColorValue: [variantIds.join('|')],
            colorRange: variantIds.join('|'),
          },
          pickable: true,
          onHover: ({ object, x, y }) => {
            if (object && object.points && object.points.length) {
              const counts = {};
              object.points.forEach(p => {
                const src = p.source || p;
                counts[src.variant] = (counts[src.variant] || 0) + 1;
              });
              const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
              setHoverInfo({
                hex: { count: object.points.length, topVariant: top[0], topCount: top[1] },
                x, y,
              });
            } else {
              setHoverInfo(null);
            }
          },
        }));
        // Inverse-mask overlay — clip hex bins to Austria.
        // if (inverseMask) {
        //   layers.push(new PolygonLayer({
        //     id: 'hex-inverse-mask',
        //     data: inverseMask,
        //     getPolygon: d => d.polygon,
        //     getFillColor: [240, 236, 227, 255],
        //     stroked: false,
        //     filled: true,
        //     pickable: false,
        //   }));
        //   // Restore basemap tiles outside Austria so the country isn't shown
        //   // as an island floating on cream. The TileLayer is masked by the
        //   // austria-inverse-mask region so it only paints outside.
        //   if (hasInverseMask) {
        //     layers.push(makeBasemap('basemap-restore-hex', {
        //       extensions: [new MaskExtension()],
        //       maskId: 'austria-mask',
        //       maskInverted: true,
        //     }));
        //   }
        // }
      } else if (areaSubMode === 'heatmap') {
        Object.values(vMap).forEach(v => {
          const vPoints = points.filter(d => d.variant === v.id);
          if (!vPoints.length) return;
          const [r, g, b] = hexToRGB(v.color);
          layers.push(new HeatmapLayer({
            id: `heatmap-${v.id}`,
            data: vPoints,
            getPosition: d => [d.lon, d.lat],
            getWeight: 1,
            radiusPixels: heatR,
            intensity: 1.2,
            threshold: 0.04,
            colorRange: [
              [r, g, b,   0],
              [r, g, b,  80],
              [r, g, b, 140],
              [r, g, b, 180],
              [r, g, b, 210],
              [r, g, b, 240],
            ],
            aggregation: 'SUM',
          }));
        });
        // Inverse-mask overlay — covers everything outside Austria with the
        // map's cream background to clip the heatmap bleed.
        // if (inverseMask) {
        //   layers.push(new PolygonLayer({
        //     id: 'heatmap-inverse-mask',
        //     data: inverseMask,
        //     getPolygon: d => d.polygon,
        //     getFillColor: [240, 236, 227, 255],
        //     stroked: false,
        //     filled: true,
        //     pickable: false,
        //   }));
        //   // Restore basemap tiles outside Austria — masked to the inverse
        //   // region so it only paints over the cream cover-up, not Austria.
        //   if (hasInverseMask) {
        //     layers.push(makeBasemap('basemap-restore-heat', {
        //       extensions: [new MaskExtension()],
        //       maskId: 'austria-mask',
        //       maskInverted: true,
        //     }));
        //   }
        // }
        // small location dots so points are still locatable
        layers.push(new ScatterplotLayer({
          id: 'heatmap-markers',
          data: points,
          getPosition: d => [d.lon, d.lat],
          getRadius: 1.5, radiusUnits: 'pixels',
          radiusMinPixels: 1.5, radiusMaxPixels: 2,
          getFillColor: d => {
            const v = vMap[d.variant];
            return v ? [...hexToRGB(v.color), 240] : [15, 23, 42, 220];
          },
          stroked: true,
          getLineColor: [255, 255, 255, 230],
          lineWidthMinPixels: 0.5,
          pickable: true,
          onClick: ({ object }) => { if (object) onPointClick(object); },
          onHover: ({ object, x, y }) => setHoverInfo(object ? { object, x, y } : null),
        }));
      }

      // Re-stroke dialect-zone borders ABOVE inverse mask so they remain crisp.
      if (geojson && zonesVisible) {
        layers.push(new GeoJsonLayer({
          id: 'dialect-zones-overlay',
          data: geojson,
          stroked: true,
          filled: false,
          getLineColor: f => {
            const c = ZONE_COLORS[f.properties.Dialektregion_Name] || [150, 150, 150];
            return [...c, 230];
          },
          lineWidthMinPixels: 1.6,
          lineWidthMaxPixels: 3,
          pickable: false,
        }));
      }
      return layers;
    }

    // ── PUNKTKARTE: scatter points ──────────────────────────────────────────
    layers.push(new ScatterplotLayer({
      id: 'dialect-points',
      data: points,
      getPosition: d => [d.lon, d.lat],
      getRadius: 5500,
      radiusUnits: 'meters',
      radiusMinPixels: 4,
      radiusMaxPixels: 14,
      getFillColor: d => {
        const v = vMap[d.variant];
        return v ? [...hexToRGB(v.color), 220] : [148, 163, 184, 180];
      },
      stroked: true,
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      onClick: ({ object }) => { if (object) onPointClick(object); },
      onHover: ({ object, x, y }) => setHoverInfo(object ? { object, x, y } : null),
    }));

    return layers;
  };

  // Initialize Deck.gl once
  useEffect(() => {
    if (!containerRef.current || !window.deck) return;
    const { Deck } = window.deck;
    deckRef.current = new Deck({
      parent: containerRef.current,
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
      // MaskExtension needs a stencil buffer; default WebGL context is created
      // without one. Enabling here keeps the Austria clip masks working.
      glOptions: { stencil: true },
      initialViewState: { longitude: 13.4, latitude: 47.4, zoom: 6.3, pitch: 0, bearing: 0 },
      controller: true,
      layers: buildLayers(filteredPoints, variantMap, geojsonData, showZones, mapMode, areaMode, hexRadius, heatmapRadius, austriaMaskData, null, austriaClipMultiPolygon),
    });
    return () => { deckRef.current?.finalize(); deckRef.current = null; };
  }, []);

  // ResizeObserver — keeps Deck.gl canvas in sync with container size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!deckRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      deckRef.current.setProps({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update layers whenever deps change
  useEffect(() => {
    if (!deckRef.current) return;
    deckRef.current.setProps({ layers: buildLayers(filteredPoints, variantMap, geojsonData, showZones, mapMode, areaMode, hexRadius, heatmapRadius, austriaMaskData, null, austriaClipMultiPolygon) });
  }, [filteredPoints, variantMap, geojsonData, showZones, mapMode, areaMode, hexRadius, heatmapRadius, austriaMaskData, austriaClipMultiPolygon]);

  const legendItems = variants;

  // Unique zone names for legend
  const zoneNames = geojsonData
    ? [...new Set(geojsonData.features.map(f => f.properties.Dialektregion_Name))]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        borderRadius: 12, border: '1px solid #e2e8f0',
        overflow: 'hidden', background: '#f0ece3',
        position: 'relative', height: 600,
        width: '100%',
        transition: 'width 0.3s ease',
      }}>
        {/* Deck.gl canvas */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Hover tooltip */}
        {hoverInfo && (() => {
          const { x, y } = hoverInfo;
          const cW = containerRef.current?.clientWidth  || 800;
          const cH = containerRef.current?.clientHeight || 600;
          const tipStyle = {
            position: 'absolute',
            left:   x > cW * 0.65 ? undefined : x + 12,
            right:  x > cW * 0.65 ? (cW - x) + 12 : undefined,
            top:    y > cH * 0.6  ? undefined : y + 12,
            bottom: y > cH * 0.6  ? (cH - y) + 12 : undefined,
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            pointerEvents: 'none', zIndex: 10, minWidth: 170,
          };

          // Hex bin hover
          if (hoverInfo.hex) {
            const h = hoverInfo.hex;
            const v = variantMap[h.topVariant];
            return (
              <div style={tipStyle}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>Hex-Aggregation</div>
                <TooltipRow label="Belege"     val={h.count} />
                <TooltipRow label="Häufigste"  val={v ? v.label : h.topVariant} mono />
                <TooltipRow label="Anteil"     val={`${h.topCount}/${h.count}`} />
              </div>
            );
          }

          // Point/cell hover
          const p = hoverInfo.object;
          if (!p) return null;
          const v = variantMap[p.variant];
          return (
            <div style={tipStyle}>
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
          maxWidth: 210,
        }}>
          {/* Variant legend */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.5px', marginBottom: 6 }}>
            BELEG-VARIANTEN
          </div>
          {legendItems.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, marginBottom: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 10, color: '#334155' }}>{v.label}</span>
              </div>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#64748b', flexShrink: 0 }}>{v.pct}%</span>
            </div>
          ))}

          {/* Zone legend — only when visible */}
          {showZones && zoneNames.length > 0 && (
            <>
              <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0 6px' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.5px', marginBottom: 6 }}>
                DIALEKTZONEN
              </div>
              {zoneNames.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{
                    width: 12, height: 8, borderRadius: 2,
                    background: ZONE_LABEL_COLORS[name] || '#94a3b8',
                    opacity: 0.6, flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#334155' }}>{name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Map controls — top left */}
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
          {/* Zoom +/- */}
          <div style={{
            background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            {['+', '−'].map((label, i) => (
              <button key={label} style={{
                display: 'block', width: 40, height: 40, background: 'none',
                border: 'none',
                borderBottom: i === 0 ? '1px solid #f1f5f9' : 'none',
                cursor: 'pointer', fontSize: 18, color: '#0f172a',
                fontFamily: 'Inter,sans-serif', fontWeight: 300,
              }}>{label}</button>
            ))}
          </div>

          {/* Toggle dialect zones */}
          <button
            onClick={() => setShowZones(s => !s)}
            title={showZones ? 'Dialektzonen ausblenden' : 'Dialektzonen einblenden'}
            style={{
              width: 40, height: 40, background: showZones ? '#0f172a' : '#fff',
              borderRadius: 6, border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: showZones ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 6s4-2 11-2 11 2 11 2"/>
              <path d="M1 12s4-2 11-2 11 2 11 2"/>
              <path d="M1 18s4-2 11-2 11 2 11 2"/>
            </svg>
          </button>
        </div>

        {/* Flächenkarte sub-mode picker — top center */}
        {mapMode === 'flaeche' && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.96)', borderRadius: 10,
            border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: 4, display: 'flex', gap: 2, zIndex: 6,
            backdropFilter: 'blur(8px)',
          }}>
            {[
              { id: 'voronoi', label: 'Voronoi',  icon: 'voronoi' },
              { id: 'hexagon', label: 'Hexagon',  icon: 'hexagon' },
              { id: 'heatmap', label: 'Heatmap',  icon: 'heatmap' },
            ].map(m => (
              <button key={m.id} onClick={() => setAreaMode(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7,
                background: areaMode === m.id ? '#0f172a' : 'transparent',
                color:      areaMode === m.id ? '#fff'    : '#475569',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Inter,sans-serif', fontWeight: 500, fontSize: 12,
                transition: 'all 0.15s',
              }}>
                <AreaModeIcon id={m.icon}/>
                {m.label}
              </button>
            ))}
            {areaMode === 'hexagon' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10, marginLeft: 4,
                borderLeft: '1px solid #e2e8f0',
              }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>RADIUS</span>
                <input
                  type="range" min={3000} max={20000} step={500}
                  value={hexRadius}
                  onChange={e => setHexRadius(parseInt(e.target.value, 10))}
                  style={{ width: 70 }}
                />
                <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 10, color: '#334155', minWidth: 36 }}>
                  {(hexRadius/1000).toFixed(1)}km
                </span>
              </div>
            )}
            {areaMode === 'heatmap' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10, marginLeft: 4,
                borderLeft: '1px solid #e2e8f0',
              }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>RADIUS</span>
                <input
                  type="range" min={10} max={80} step={2}
                  value={heatmapRadius}
                  onChange={e => setHeatmapRadius(parseInt(e.target.value, 10))}
                  style={{ width: 70 }}
                />
                <span style={{ fontFamily: 'Liberation Mono,monospace', fontSize: 10, color: '#334155', minWidth: 24 }}>
                  {heatmapRadius}px
                </span>
              </div>
            )}
          </div>
        )}
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

// Area-mode pill icons (voronoi, hexagon, heatmap)
const AreaModeIcon = ({ id }) => {
  const s = { width: 13, height: 13, flexShrink: 0 };
  if (id === 'voronoi') {
    return (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M3 4 L11 3 L21 6 L20 14 L13 21 L4 18 Z"/>
        <path d="M11 3 L13 12 L20 14"/>
        <path d="M13 12 L4 18"/>
        <path d="M13 12 L13 21"/>
      </svg>
    );
  }
  if (id === 'hexagon') {
    return (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <polygon points="12,3 20,7 20,16 12,20 4,16 4,7"/>
        <polygon points="12,8 16,10 16,14 12,16 8,14 8,10" opacity="0.5"/>
      </svg>
    );
  }
  // heatmap
  return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="12" r="6" opacity="0.6"/>
      <circle cx="12" cy="12" r="9" opacity="0.3"/>
    </svg>
  );
};

Object.assign(window, { MapPanel });
