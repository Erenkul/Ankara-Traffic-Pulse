interface TimeSliderProps {
  value: number;      // 0-23 saat
  loading?: boolean;
  count: number;
  onChange: (value: number) => void;
}

export function TimeSlider({ value, loading, count, onChange }: TimeSliderProps) {
  return (
    <div className="panel slider">
      <span className="panel-title">Son 7 gün · Ankara saati</span>
      <div className="time">
        {String(value).padStart(2, '0')}:00
        <span className="card-note" style={{ marginLeft: 8 }}>
          {loading ? 'yükleniyor…' : `${count} ölçüm`}
        </span>
      </div>
      <input
        id="history-hour"
        type="range"
        min={0}
        max={23}
        value={value}
        aria-label="Saat seçin"
        onChange={e => onChange(Number(e.target.value))}
      />
      <div className="ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </div>
  );
}
