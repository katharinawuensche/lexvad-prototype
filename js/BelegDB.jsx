// BelegDB — Attestation database table view

const BelegDB = ({ phenomenon }) => {
  const { useState, useMemo } = React;
  const { BELEGTABLE, VARIANTS } = window.LEXVAD;

  const [sortCol,  setSortCol]  = useState('ort');
  const [sortDir,  setSortDir]  = useState('asc');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [filterBL, setFilterBL] = useState('all');
  const PAGE_SIZE = 8;

  const variants   = VARIANTS[phenomenon.id] || [];
  const varMap     = Object.fromEntries(variants.map(v => [v.id, v]));
  // Filter table to current phenomenon
  const tableData  = BELEGTABLE.filter(r => r.item === phenomenon.id);
  const bundeslaender = [...new Set(tableData.map(r => r.bundesland).filter(Boolean))].sort();

  const filteredData = useMemo(() => {
    let data = [...tableData];
    if (search) data = data.filter(r =>
      r.ort?.toLowerCase().includes(search.toLowerCase()) ||
      r.benennungsvariante?.toLowerCase().includes(search.toLowerCase()) ||
      r.bundesland?.toLowerCase().includes(search.toLowerCase())
    );
    if (filterBL !== 'all') data = data.filter(r => r.bundesland === filterBL);
    data.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = typeof av === 'number' ? av - bv : av?.localeCompare?.(bv) ?? 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [search, filterBL, sortCol, sortDir, phenomenon.id]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pageData   = filteredData.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const sortIcon = (col) => {
    if (sortCol !== col) return (
      <svg width={8} height={12} viewBox="0 0 8 12" fill="none" style={{marginLeft:4, opacity:0.3}}>
        <path d="M4 0L7 4H1L4 0Z" fill="#64748b"/><path d="M4 12L1 8H7L4 12Z" fill="#64748b"/>
      </svg>
    );
    return (
      <svg width={8} height={12} viewBox="0 0 8 12" fill="none" style={{marginLeft:4}}>
        {sortDir==='asc'
          ? <path d="M4 0L7 5H1L4 0Z" fill="#0f172a"/>
          : <path d="M4 12L1 7H7L4 12Z" fill="#0f172a"/>
        }
      </svg>
    );
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const colStyle = (col) => ({
    padding:'10px 12px', fontFamily:'Inter,sans-serif', fontWeight:700,
    fontSize:11, letterSpacing:'0.5px', color:'#64748b',
    cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
    background: sortCol===col ? '#f8fafc' : 'transparent',
    borderBottom:'2px solid #e2e8f0',
    display:'flex', alignItems:'center',
  });

  const COLS = [
    { id:'ort',                label:'ORT',               flex:2   },
    { id:'bundesland',         label:'BUNDESLAND',        flex:2   },
    { id:'benennungsvariante', label:'VARIANTE',          flex:2.5 },
    { id:'variante',           label:'DIALEKTFORM',       flex:2.5 },
    { id:'kreis',              label:'KREIS',             flex:1.5 },
  ];

  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      boxShadow:'0 1px 2px rgba(0,0,0,0.05)', overflow:'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        padding:'14px 16px', display:'flex', gap:10, alignItems:'center',
        borderBottom:'1px solid #e2e8f0', flexWrap:'wrap',
      }}>
        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:180 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}
            style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Ort, Variante, Bundesland…"
            style={{
              width:'100%', padding:'7px 10px 7px 30px',
              borderRadius:6, border:'1px solid #e2e8f0',
              fontFamily:'Inter,sans-serif', fontSize:12, color:'#0f172a',
              background:'#f8fafc', outline:'none', boxSizing:'border-box',
            }}
          />
        </div>
        {/* Bundesland filter */}
        <select value={filterBL} onChange={e => { setFilterBL(e.target.value); setPage(1); }}
          style={{
            padding:'7px 10px', borderRadius:6, border:'1px solid #e2e8f0',
            fontFamily:'Inter,sans-serif', fontSize:12, color:'#334155',
            background:'#f8fafc', cursor:'pointer', outline:'none',
          }}>
          <option value="all">Alle Bundesländer</option>
          {bundeslaender.map(bl => <option key={bl} value={bl}>{bl}</option>)}
        </select>
        {/* Result count */}
        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
          {filteredData.length} Ergebnisse
        </span>
        {/* Export stub */}
        <button style={{
          display:'flex', alignItems:'center', gap:6, padding:'7px 12px',
          borderRadius:6, border:'1px solid #e2e8f0', background:'#fff',
          fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:12, color:'#334155',
          cursor:'pointer',
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto' }}>
        {/* Header */}
        <div style={{ display:'flex', minWidth:600 }}>
          {COLS.map(col => (
            <div key={col.id} onClick={() => handleSort(col.id)}
              style={{ ...colStyle(col.id), flex:col.flex }}>
              {col.label}{sortIcon(col.id)}
            </div>
          ))}
          {/* <div style={{ flex:0.8, padding:'10px 12px', fontFamily:'Inter,sans-serif',
            fontWeight:700, fontSize:11, letterSpacing:'0.5px', color:'#64748b',
            borderBottom:'2px solid #e2e8f0' }}>AKTION</div> */}
        </div>

        {/* Rows */}
        {pageData.map((row, i) => {
          const varDef = variants.find(v => v.label === row.benennungsvariante);
          const varColor = varDef?.color || '#94a3b8';
          return (
            <div key={i} style={{
              display:'flex', minWidth:600,
              background: i%2===0 ? '#fff' : '#fafafa',
              borderBottom:'1px solid #f1f5f9',
              transition:'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background= i%2===0?'#fff':'#fafafa'}
            >
              {/* Ort */}
              <div style={{ flex:2, padding:'12px 12px', fontFamily:'Inter,sans-serif', fontWeight:500, fontSize:13, color:'#0f172a' }}>
                {row.ort}
              </div>
              {/* Bundesland */}
              <div style={{ flex:2, padding:'12px 12px', fontFamily:'Inter,sans-serif', fontSize:12, color:'#64748b' }}>
                {row.bundesland || '—'}
              </div>
              {/* Benennungsvariante */}
              <div style={{ flex:2.5, padding:'12px 12px', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:varColor, flexShrink:0 }}/>
                <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#334155' }}>{row.benennungsvariante}</span>
              </div>
              {/* Dialektform */}
              <div style={{ flex:2.5, padding:'12px 12px' }}>
                <span style={{ fontFamily:'Liberation Mono,monospace', fontSize:11, background:'#f1f5f9', color:'#334155', padding:'2px 6px', borderRadius:4 }}>
                  {row.variante}
                </span>
              </div>
              {/* Kreis */}
              <div style={{ flex:1.5, padding:'12px 12px', fontFamily:'Inter,sans-serif', fontSize:12, color:'#64748b' }}>
                {row.kreis}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{
        padding:'12px 16px', borderTop:'1px solid #e2e8f0',
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, color:'#94a3b8' }}>
          Zeige {Math.min((page-1)*PAGE_SIZE+1, filteredData.length)}–{Math.min(page*PAGE_SIZE, filteredData.length)} von {filteredData.length} Ergebnissen
        </span>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6"/></svg>
          </PagBtn>
          {Array.from({length:totalPages}, (_,i)=>i+1).map(p => (
            <PagBtn key={p} active={p===page} onClick={() => setPage(p)}>{p}</PagBtn>
          ))}
          <PagBtn onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
          </PagBtn>
        </div>
      </div>
    </div>
  );
};

const PagBtn = ({ children, onClick, disabled, active }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth:28, height:28, padding:'0 6px',
    borderRadius:5,
    border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? '#0f172a' : disabled ? '#f8fafc' : '#fff',
    color: active ? '#fff' : disabled ? '#cbd5e1' : '#334155',
    fontFamily:'Inter,sans-serif', fontSize:11, fontWeight: active ? 700 : 400,
    cursor: disabled ? 'default' : 'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    transition:'background 0.15s',
  }}>{children}</button>
);

Object.assign(window, { BelegDB });
