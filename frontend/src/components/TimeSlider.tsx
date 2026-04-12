// Faz 2: Geçmiş trafik verisi için zaman kaydırıcı
// PostgreSQL + PostGIS entegrasyonundan sonra aktif edilecek

interface TimeSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

export default function TimeSlider({ value, min, max, onChange, label }: TimeSliderProps) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24,
      background: 'rgba(13, 17, 23, 0.88)',
      color: '#fff', padding: '12px 16px',
      borderRadius: 10, fontSize: 13,
      border: '1px solid #1E6FE8',
      backdropFilter: 'blur(6px)',
      minWidth: 220
    }}>
      {label && (
        <div style={{ color: '#00C2FF', fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div style={{ color: '#e2e8f0', marginBottom: 8 }}>{timeStr}</div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#1E6FE8' }}
      />
    </div>
  );
}
