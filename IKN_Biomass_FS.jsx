import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, Cell
} from "recharts";

// ── PARAMETER DASAR ─────────────────────────────────────────
const CAPACITY_MW    = 30;
const GWH_PER_YEAR   = 240000;   // MWh/tahun (240 GWh, CF 91%)
const PPA_PRICE      = 1450;     // Rp/kWh — base case

// Investasi & biaya per skenario (Rp juta)
const SCENARIOS = [
  {
    id: "S0",
    label: "S0 — Bulk Baseline",
    color: "#ef4444",
    textColor: "#fca5a5",
    capex: 0,            // Rp juta — tidak ada infrastruktur rantai pasok
    capexPlant: 390000,  // pembangkit 30 MW
    opexPerYear: 312000, // biaya produksi Rp 4.750/kWh × 240.000 MWh (tdk layak)
    lossRate: 0.30,
    note: "Tidak layak — biaya produksi > pendapatan PPA",
    viable: false,
    payback: null,
    irr: null,
    kwhCost: 4750,
  },
  {
    id: "S1",
    label: "S1 — Centralized Hub",
    color: "#f59e0b",
    textColor: "#fcd34d",
    capex: 15000,         // hub pelleting terpusat
    capexPlant: 390000,
    opexPerYear: 244000,  // Rp/tahun (biaya produksi ~Rp 1.850/kWh × 240.000 MWh, base)
    lossRate: 0.05,
    note: "Layak — 1 hub dekat IKN, pelet tersentralisasi",
    viable: true,
    payback: 13,
    irr: 13,
    kwhCost: 1850,
  },
  {
    id: "S2",
    label: "S2 — Decentralized Hub",
    color: "#3b82f6",
    textColor: "#93c5fd",
    capex: 12000,         // 3 mini-hub kecil
    capexPlant: 390000,
    opexPerYear: 256000,  // Rp ~Rp 2.050/kWh (semi-dried, bukan pelet penuh)
    lossRate: 0.08,
    note: "Layak — 3 hub terdesentralisasi, bahan semi-kering",
    viable: true,
    payback: 15,
    irr: 11,
    kwhCost: 2050,
  },
  {
    id: "S3",
    label: "S3 — Hybrid Optimal",
    color: "#10b981",
    textColor: "#6ee7b7",
    capex: 45000,         // 3 mini-hub + 1 pelleting center + sistem digital
    capexPlant: 390000,
    opexPerYear: 235000,  // Rp ~Rp 1.620/kWh × 240.000 MWh (lowest opex)
    lossRate: 0.04,
    note: "Sangat layak — sistem terintegrasi, efisiensi tertinggi",
    viable: true,
    payback: 11,
    irr: 16,
    kwhCost: 1620,
  },
];

const REVENUE_PER_YEAR = (GWH_PER_YEAR * PPA_PRICE) / 1000; // Rp juta

// ── DATA GENERATOR ──────────────────────────────────────────
function generateBEPData(scenario, years = 25) {
  const data = [];
  const totalCapex = scenario.capex + scenario.capexPlant;
  let cumCost = totalCapex;
  let cumRevenue = 0;

  data.push({
    year: 0,
    cumCost: +(totalCapex / 1000).toFixed(1),
    cumRevenue: 0,
    annualRevenue: 0,
    annualCost: +(totalCapex / 1000).toFixed(1),
    cashflow: +(-totalCapex / 1000).toFixed(1),
    cumCashflow: +(-totalCapex / 1000).toFixed(1),
  });

  for (let y = 1; y <= years; y++) {
    cumCost += scenario.opexPerYear;
    cumRevenue += REVENUE_PER_YEAR;
    const cumCF = cumRevenue - cumCost;

    data.push({
      year: y,
      cumCost: +(cumCost / 1000).toFixed(1),
      cumRevenue: +(cumRevenue / 1000).toFixed(1),
      annualRevenue: +(REVENUE_PER_YEAR / 1000).toFixed(1),
      annualCost: +(scenario.opexPerYear / 1000).toFixed(1),
      cashflow: +((REVENUE_PER_YEAR - scenario.opexPerYear) / 1000).toFixed(1),
      cumCashflow: +(cumCF / 1000).toFixed(1),
    });
  }
  return data;
}

// ── CUSTOM TOOLTIP ───────────────────────────────────────────
function BEPTooltip({ active, payload, label, scenario }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f172a", border: `1px solid ${scenario.color}44`,
      borderRadius: 8, padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12
    }}>
      <p style={{ color: scenario.color, fontWeight: 700, marginBottom: 6 }}>Tahun ke-{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <span style={{ color: "#fff" }}>Rp {p.value?.toLocaleString("id-ID")} M</span>
        </p>
      ))}
    </div>
  );
}

// ── METRIC CARD ──────────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: "#0f172a", border: `1px solid ${color}33`,
      borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 130,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`
      }} />
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ color: "#94a3b8", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, margin: "4px 0 2px" }}>{value}</div>
      {sub && <div style={{ color: "#64748b", fontSize: 10 }}>{sub}</div>}
    </div>
  );
}

// ── COMPARE CHART DATA ───────────────────────────────────────
function generateCompareData() {
  const data = [];
  for (let y = 0; y <= 25; y++) {
    const row = { year: y };
    SCENARIOS.forEach(s => {
      const totalCapex = s.capex + s.capexPlant;
      if (y === 0) {
        row[s.id] = +(-totalCapex / 1000).toFixed(1);
      } else {
        const cumRev = REVENUE_PER_YEAR * y;
        const cumCost = totalCapex + s.opexPerYear * y;
        row[s.id] = +((cumRev - cumCost) / 1000).toFixed(1);
      }
    });
    data.push(row);
  }
  return data;
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function BEPDashboard() {
  const [activeScenario, setActiveScenario] = useState(SCENARIOS[3]);
  const [tab, setTab] = useState("individual");
  const [animKey, setAnimKey] = useState(0);

  const bepData = generateBEPData(activeScenario);
  const compareData = generateCompareData();

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [activeScenario]);

  const bepYear = activeScenario.viable
    ? bepData.find(d => d.cumCashflow >= 0)?.year
    : null;

  return (
    <div style={{
      background: "#080f1e",
      minHeight: "100vh",
      color: "#e2e8f0",
      fontFamily: "'Syne', sans-serif",
      padding: "0 0 40px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .tab-btn { transition: all .2s; cursor: pointer; border: none; background: none; }
        .tab-btn:hover { opacity: 0.8; }
        .sc-btn { transition: all .18s; cursor: pointer; border: none; }
        .sc-btn:hover { transform: translateY(-1px); }
        .fade-in { animation: fadeIn .35s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, #0d1f3c 0%, #0a1628 60%, #080f1e 100%)",
        borderBottom: "1px solid #1e293b",
        padding: "28px 36px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: "#10b981", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8
            }}>
              Studi Kelayakan · Rantai Pasok Biomassa IKN
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: "#f1f5f9" }}>
              Simulasi Break-Even Point
            </h1>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
              PLTB 30 MW · 240 GWh/tahun · PPA Rp 1.450/kWh · Horizon 25 Tahun
            </p>
          </div>
          <div style={{
            background: "#0f172a", border: "1px solid #1e3a5f",
            borderRadius: 10, padding: "10px 18px", textAlign: "right"
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#475569", letterSpacing: 2 }}>KAPASITAS TARGET</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>30 MW</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#3b82f6" }}>IKN · Kalimantan Timur</div>
          </div>
        </div>

        {/* ── SCENARIO SELECTOR ── */}
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {SCENARIOS.map(s => (
            <button key={s.id} className="sc-btn"
              onClick={() => setActiveScenario(s)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: `1.5px solid ${activeScenario.id === s.id ? s.color : "#1e293b"}`,
                background: activeScenario.id === s.id ? `${s.color}18` : "#0f172a",
                color: activeScenario.id === s.id ? s.color : "#64748b",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              }}>
              <span style={{ marginRight: 6 }}>{s.id === "S0" ? "⚠" : s.id === "S3" ? "★" : "●"}</span>
              {s.id}
            </button>
          ))}
        </div>
      </div>

      {/* ── METRICS STRIP ── */}
      <div className="fade-in" key={`metrics-${animKey}`} style={{
        display: "flex", gap: 12, padding: "20px 36px", flexWrap: "wrap",
        borderBottom: "1px solid #1e293b"
      }}>
        <MetricCard icon="💰" label="Biaya Produksi" value={`Rp ${activeScenario.kwhCost.toLocaleString("id-ID")}`} sub="per kWh (avg)" color={activeScenario.color} />
        <MetricCard icon="📉" label="Loss Rate" value={`${(activeScenario.lossRate * 100).toFixed(0)}%`} sub="total rantai pasok" color={activeScenario.color} />
        <MetricCard icon="⏱️" label="Payback Period" value={activeScenario.payback ? `${activeScenario.payback} tahun` : "N/A"} sub="estimasi base case" color={activeScenario.color} />
        <MetricCard icon="📈" label="IRR Estimasi" value={activeScenario.irr ? `${activeScenario.irr}%` : "Negatif"} sub="selama 25 tahun" color={activeScenario.color} />
        <MetricCard icon="🏭" label="Total CAPEX" value={`Rp ${((activeScenario.capex + activeScenario.capexPlant) / 1000).toFixed(0)} M`} sub="pembangkit + infrastruktur" color={activeScenario.color} />
        <MetricCard icon="📊" label="BEP di" value={bepYear ? `Tahun ${bepYear}` : "Tidak tercapai"} sub="titik balik kumulatif" color={activeScenario.color} />
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div style={{ display: "flex", gap: 0, padding: "0 36px", borderBottom: "1px solid #1e293b", marginTop: 4 }}>
        {[
          { key: "individual", label: "Analisis per Skenario" },
          { key: "compare", label: "Perbandingan 4 Skenario" },
          { key: "annual", label: "Arus Kas Tahunan" },
          { key: "sensitivity", label: "Sensitivitas Harga PPA" },
        ].map(t => (
          <button key={t.key} className="tab-btn"
            onClick={() => setTab(t.key)}
            style={{
              padding: "14px 20px", fontSize: 12, fontWeight: 600,
              color: tab === t.key ? activeScenario.color : "#475569",
              borderBottom: tab === t.key ? `2px solid ${activeScenario.color}` : "2px solid transparent",
              marginBottom: -1
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "28px 36px" }}>

        {/* ── TAB: INDIVIDUAL BEP ── */}
        {tab === "individual" && (
          <div className="fade-in" key={`ind-${animKey}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: activeScenario.color }}>{activeScenario.label}</h2>
                <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{activeScenario.note}</p>
              </div>
              {!activeScenario.viable && (
                <div style={{
                  background: "#450a0a", border: "1px solid #ef444466",
                  borderRadius: 8, padding: "8px 16px",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#fca5a5"
                }}>
                  ⚠ TIDAK LAYAK — Biaya produksi melebihi tarif PPA
                </div>
              )}
            </div>

            {/* Cumulative Revenue vs Cost */}
            <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
                Pendapatan Kumulatif vs Biaya Kumulatif (Rp Miliar)
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={bepData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    label={{ value: "Tahun Operasi", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    tickFormatter={v => `${v.toLocaleString("id-ID")}M`} />
                  <Tooltip content={<BEPTooltip scenario={activeScenario} />} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono", color: "#94a3b8", paddingTop: 12 }} />
                  {bepYear && (
                    <ReferenceLine x={bepYear} stroke={activeScenario.color} strokeDasharray="6 3" strokeWidth={1.5}
                      label={{ value: `BEP Th.${bepYear}`, position: "top", fill: activeScenario.color, fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  )}
                  <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
                  <Line name="Pendapatan Kumulatif" dataKey="cumRevenue" stroke="#10b981" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                  <Line name="Biaya Kumulatif (CAPEX+OPEX)" dataKey="cumCost" stroke={activeScenario.color} strokeWidth={2.5}
                    dot={false} activeDot={{ r: 5 }} strokeDasharray={activeScenario.id === "S0" ? "8 4" : "none"} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative Cashflow */}
            <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
                Arus Kas Kumulatif Bersih (Rp Miliar)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={bepData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cf-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeScenario.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={activeScenario.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    tickFormatter={v => `${v.toLocaleString("id-ID")}M`} />
                  <Tooltip content={<BEPTooltip scenario={activeScenario} />} />
                  <ReferenceLine y={0} stroke="#ef444488" strokeWidth={1.5} strokeDasharray="4 2" />
                  {bepYear && <ReferenceLine x={bepYear} stroke={activeScenario.color} strokeDasharray="6 3" strokeWidth={1.5} />}
                  <Area name="Cashflow Kumulatif" dataKey="cumCashflow" stroke={activeScenario.color} strokeWidth={2}
                    fill="url(#cf-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── TAB: COMPARE ── */}
        {tab === "compare" && (
          <div className="fade-in" key="compare">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" }}>Perbandingan Cashflow Kumulatif — 4 Skenario</h2>
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
              Nilai di atas nol = kumulatif untung · Titik crossing nol = Break-Even Point
            </p>
            <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={compareData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    label={{ value: "Tahun Operasi", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    tickFormatter={v => `${v.toLocaleString("id-ID")}M`} />
                  <Tooltip formatter={(v, name) => [`Rp ${v?.toLocaleString("id-ID")} M`, name]}
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                    labelStyle={{ color: "#94a3b8" }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "#94a3b8", paddingTop: 12 }} />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} strokeDasharray="5 3" />
                  {SCENARIOS.map(s => (
                    <Line key={s.id} name={s.label} dataKey={s.id}
                      stroke={s.color} strokeWidth={s.id === "S3" ? 3 : 2}
                      dot={false} activeDot={{ r: 4 }}
                      strokeDasharray={s.id === "S0" ? "8 4" : "none"} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* BEP Summary Table */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {SCENARIOS.map(s => {
                const data = generateBEPData(s);
                const bep = data.find(d => d.cumCashflow >= 0)?.year;
                const finalCF = data[25]?.cumCashflow;
                return (
                  <div key={s.id} style={{
                    background: "#0b1120", border: `1px solid ${s.color}33`,
                    borderRadius: 10, padding: "16px",
                    borderTop: `3px solid ${s.color}`
                  }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 8 }}>{s.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        ["BEP", bep ? `Tahun ${bep}` : "Tidak tercapai"],
                        ["CF Th.25", finalCF ? `Rp ${finalCF.toLocaleString("id-ID")} M` : "—"],
                        ["IRR", s.irr ? `${s.irr}%` : "Negatif"],
                        ["Loss Rate", `${(s.lossRate * 100).toFixed(0)}%`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#475569", fontFamily: "IBM Plex Mono", fontSize: 10 }}>{k}</span>
                          <span style={{ color: s.viable ? "#e2e8f0" : "#ef4444", fontFamily: "IBM Plex Mono", fontSize: 10, fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: ANNUAL CASHFLOW ── */}
        {tab === "annual" && (
          <div className="fade-in" key={`annual-${animKey}`}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: activeScenario.color }}>{activeScenario.label}</h2>
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
              Arus kas tahunan bersih: Pendapatan PPA dikurangi OPEX per tahun (setelah masa CAPEX Tahun 0)
            </p>
            <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={bepData.slice(1)} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="year" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    label={{ value: "Tahun Operasi", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    tickFormatter={v => `${v}M`} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                    formatter={(v, name) => [`Rp ${v?.toLocaleString("id-ID")} M`, name]}
                    labelStyle={{ color: "#94a3b8" }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "#94a3b8", paddingTop: 12 }} />
                  <Bar name="Pendapatan Tahunan" dataKey="annualRevenue" fill="#10b98144" stroke="#10b981" strokeWidth={1} radius={[3, 3, 0, 0]} />
                  <Bar name="Biaya Operasional" dataKey="annualCost" fill={`${activeScenario.color}44`} stroke={activeScenario.color} strokeWidth={1} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Annual Surplus/Deficit */}
            <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px", marginTop: 16 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>
                Surplus / Defisit Tahunan (Rp Miliar) — Tidak termasuk Amortisasi CAPEX
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bepData.slice(1).map(d => {
                  const surplus = d.cashflow;
                  const isPos = surplus >= 0;
                  return (
                    <div key={d.year} style={{
                      background: isPos ? "#052e16" : "#450a0a",
                      border: `1px solid ${isPos ? "#10b98144" : "#ef444444"}`,
                      borderRadius: 6, padding: "6px 10px", minWidth: 64, textAlign: "center"
                    }}>
                      <div style={{ fontFamily: "IBM Plex Mono", fontSize: 9, color: "#475569" }}>Th.{d.year}</div>
                      <div style={{ fontFamily: "IBM Plex Mono", fontSize: 11, fontWeight: 700, color: isPos ? "#10b981" : "#ef4444" }}>
                        {isPos ? "+" : ""}{surplus?.toLocaleString("id-ID")}M
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: SENSITIVITY ── */}
        {tab === "sensitivity" && (
          <div className="fade-in" key="sensitivity">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" }}>Sensitivitas BEP terhadap Harga PPA (Rp/kWh)</h2>
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 24, fontFamily: "'IBM Plex Mono', monospace" }}>
              Variasi harga PPA Rp 1.100–1.900/kWh · Garis merah = tarif PPA baseline (Rp 1.450/kWh)
            </p>

            {/* Sensitivity table: for each scenario, show BEP year at different PPA prices */}
            {(() => {
              const ppaPrices = [1100, 1200, 1300, 1450, 1550, 1650, 1800, 1900];
              return (
                <div>
                  <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
                      Titik BEP (Tahun ke-N) berdasarkan Harga PPA — Per Skenario
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart
                        data={ppaPrices.map(ppa => {
                          const row = { ppa };
                          SCENARIOS.filter(s => s.viable).forEach(s => {
                            const rev = (GWH_PER_YEAR * ppa) / 1000;
                            const cap = s.capex + s.capexPlant;
                            if (rev > s.opexPerYear) {
                              // BEP year: when cumRev > cumCost
                              // cap + opex*y = rev*y => y = cap/(rev-opex)
                              const bepY = Math.ceil(cap / (rev - s.opexPerYear));
                              row[s.id] = bepY <= 25 ? bepY : 26;
                            } else {
                              row[s.id] = 27; // Not reached
                            }
                          });
                          return row;
                        })}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="ppa" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                          tickFormatter={v => `Rp ${v}`}
                          label={{ value: "Harga PPA (Rp/kWh)", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 11 }} />
                        <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                          label={{ value: "BEP (Tahun)", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 11 }}
                          domain={[0, 28]} tickFormatter={v => v > 25 ? ">25" : v} />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                          formatter={(v) => [v > 25 ? "Tidak tercapai" : `Tahun ${v}`, ""]}
                          labelFormatter={v => `PPA: Rp ${v}/kWh`}
                          labelStyle={{ color: "#94a3b8" }} />
                        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "#94a3b8", paddingTop: 12 }} />
                        <ReferenceLine x={1450} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                          label={{ value: "Baseline", position: "top", fill: "#ef4444", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                        <ReferenceLine y={25} stroke="#334155" strokeDasharray="4 2" strokeWidth={1} />
                        {SCENARIOS.filter(s => s.viable).map(s => (
                          <Line key={s.id} name={s.label} dataKey={s.id}
                            stroke={s.color} strokeWidth={2.5} dot={{ r: 3, fill: s.color }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* PPA Sensitivity grid */}
                  <div style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#0d1f3c" }}>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "IBM Plex Mono", fontSize: 11, color: "#64748b", fontWeight: 500, borderBottom: "1px solid #1e293b" }}>PPA (Rp/kWh)</th>
                          {SCENARIOS.filter(s => s.viable).map(s => (
                            <th key={s.id} style={{ padding: "12px 16px", textAlign: "center", fontFamily: "IBM Plex Mono", fontSize: 11, color: s.color, fontWeight: 700, borderBottom: "1px solid #1e293b" }}>{s.id}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ppaPrices.map((ppa, ri) => (
                          <tr key={ppa} style={{ background: ppa === 1450 ? "#1e293b" : ri % 2 === 0 ? "#090f1b" : "#0b1120", borderLeft: ppa === 1450 ? "2px solid #ef4444" : "2px solid transparent" }}>
                            <td style={{ padding: "10px 16px", fontFamily: "IBM Plex Mono", fontSize: 11, color: ppa === 1450 ? "#ef4444" : "#94a3b8", fontWeight: ppa === 1450 ? 700 : 400 }}>
                              Rp {ppa.toLocaleString("id-ID")} {ppa === 1450 ? "← baseline" : ""}
                            </td>
                            {SCENARIOS.filter(s => s.viable).map(s => {
                              const rev = (GWH_PER_YEAR * ppa) / 1000;
                              const cap = s.capex + s.capexPlant;
                              let bepY = rev > s.opexPerYear ? Math.ceil(cap / (rev - s.opexPerYear)) : null;
                              const ok = bepY && bepY <= 25;
                              return (
                                <td key={s.id} style={{ padding: "10px 16px", textAlign: "center", fontFamily: "IBM Plex Mono", fontSize: 11, color: ok ? s.color : "#475569", fontWeight: ok ? 700 : 400 }}>
                                  {ok ? `Th. ${bepY}` : ">25 th"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: "0 36px", marginTop: 8 }}>
        <div style={{ borderTop: "1px solid #1e293b", paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#334155" }}>
            Semua angka adalah estimasi akademik berbasis data sekunder — validasi lapangan diperlukan
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#334155" }}>
            Ref: RUPTL PLN 2025–2034 · Disbun KalTim 2023 · Otorita IKN 2024
          </span>
        </div>
      </div>
    </div>
  );
}