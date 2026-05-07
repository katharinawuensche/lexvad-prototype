// Header component — matches LexVAD20 Figma design exactly

const Header = ({ activePage, onNavigate }) => {
  const { useState } = React;
  const [lang, setLang] = useState('DE');

  const navItems = [
    { id: 'projekt',         label: 'ÜBER DAS PROJEKT' },
    { id: 'kartierung',      label: 'KARTIERUNG' },
    { id: 'belegdatenbank',  label: 'BELEGDATENBANK' },
    { id: 'kartenkommentare',label: 'KARTENKOMMENTARE' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 65,
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      justifyContent: 'space-between',
    }}>
      {/* Left: logo + nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <span style={{
          fontFamily: "'Tiro Bangla', serif",
          fontSize: 24,
          letterSpacing: '-0.6px',
          color: '#0f172a',
          cursor: 'pointer',
          lineHeight: 1,
        }} onClick={() => onNavigate('kartierung')}>LexVAD20</span>

        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {navItems.map(item => {
            const active = activePage === item.id;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 4px 0',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: '0.5px',
                color: active ? '#0f172a' : '#64748b',
                borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}>{item.label}</button>
            );
          })}
        </nav>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Sun icon */}
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          width: 34, height: 34, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748b',
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>

        {/* Language switcher */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['DE','EN'].map((l, i) => (
            <React.Fragment key={l}>
              {i > 0 && <span style={{ color: '#cbd5e1', fontSize: 12 }}>|</span>}
              <button onClick={() => setLang(l)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: lang === l ? 700 : 400,
                fontSize: 12,
                color: lang === l ? '#0f172a' : '#94a3b8',
              }}>{l}</button>
            </React.Fragment>
          ))}
        </div>

        {/* User avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Header });
