interface TimeSliderProps {
  value: number;      // 0-23 saat
  min: number;
  max: number;
  loading?: boolean;
  onChange: (value: number) => void;
  label?: string;
}

export function TimeSlider({ value, min, max, loading, onChange, label }: TimeSliderProps) {
  const timeStr = `${String(value).padStart(2, '0')}:00`;

  return (
    <div style={{
      position: 'absolute', bottom: 24,
      left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(13,17,23,0.92)',
      color: '#fff', padding: '12px 20px',
      borderRadius: 10, fontSize: 13,
      border: '1px solid #1E6FE8',
      backdropFilter: 'blur(6px)',
      minWidth: 300,
      textAlign: 'center',
    }}>
      {label && (
        <div style={{ color: '#00C2FF', fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>
        {timeStr}
        {loading && <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>yükleniyor…</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#1E6FE8' }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        color: '#555', fontSize: 10, marginTop: 2,
      }}>
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
    </div>
  );
}
