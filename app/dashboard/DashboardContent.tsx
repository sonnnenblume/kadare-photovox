'use client'

import { useState, useEffect, useRef } from 'react'

// ── 埋め込みデータ ──────────────────────────────────────────
const CHART_DATA = {"GroupB":{"color":"#1D9E75","users":4,"apr":{"posts":41,"avg_len":28.2,"kw":{"光":6,"窓":9,"天井":4,"壁":7,"空間":3,"ガラス":2,"照明":1,"コンクリート":1,"開放":2,"木":3,"自然":1,"落ち着":0,"吹き抜け":1,"暖か":4,"洞窟":0,"素材":0,"構造":0,"影":0,"反射":0,"外":3,"広":1,"高":1}},"may":{"posts":35,"avg_len":34.9,"kw":{"光":1,"窓":2,"天井":9,"壁":3,"空間":0,"ガラス":0,"照明":0,"コンクリート":1,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":1,"構造":1,"影":0,"反射":4,"外":4,"広":0,"高":0}}},"GroupC":{"color":"#7F77DD","users":4,"apr":{"posts":40,"avg_len":21.0,"kw":{"光":9,"窓":11,"天井":5,"壁":5,"空間":4,"ガラス":2,"照明":3,"コンクリート":2,"開放":2,"木":2,"自然":0,"落ち着":1,"吹き抜け":2,"暖か":0,"洞窟":0,"素材":1,"構造":1,"影":0,"反射":0,"外":3,"広":0,"高":2}},"may":{"posts":13,"avg_len":26.3,"kw":{"光":0,"窓":0,"天井":4,"壁":0,"空間":0,"ガラス":1,"照明":1,"コンクリート":1,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":1,"構造":0,"影":0,"反射":0,"外":0,"広":0,"高":0}}},"GroupD":{"color":"#D85A30","users":2,"apr":{"posts":20,"avg_len":19.6,"kw":{"光":3,"窓":4,"天井":1,"壁":0,"空間":1,"ガラス":1,"照明":1,"コンクリート":1,"開放":1,"木":1,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":0,"影":0,"反射":0,"外":1,"広":1,"高":0}},"may":{"posts":20,"avg_len":22.2,"kw":{"光":0,"窓":0,"天井":1,"壁":1,"空間":0,"ガラス":0,"照明":3,"コンクリート":0,"開放":1,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":1,"影":0,"反射":2,"外":0,"広":0,"高":2}}},"GroupE":{"color":"#D4537E","users":2,"apr":{"posts":22,"avg_len":56.9,"kw":{"光":4,"窓":4,"天井":1,"壁":10,"空間":8,"ガラス":0,"照明":3,"コンクリート":2,"開放":2,"木":1,"自然":2,"落ち着":1,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":3,"影":0,"反射":1,"外":2,"広":2,"高":2}},"may":{"posts":16,"avg_len":36.9,"kw":{"光":0,"窓":0,"天井":2,"壁":0,"空間":1,"ガラス":0,"照明":1,"コンクリート":0,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":1,"影":0,"反射":2,"外":0,"広":1,"高":1}}},"GroupF":{"color":"#BA7517","users":4,"apr":{"posts":50,"avg_len":16.4,"kw":{"光":11,"窓":5,"天井":5,"壁":11,"空間":0,"ガラス":1,"照明":0,"コンクリート":0,"開放":0,"木":1,"自然":0,"落ち着":0,"吹き抜け":2,"暖か":0,"洞窟":0,"素材":1,"構造":0,"影":0,"反射":0,"外":4,"広":1,"高":0}},"may":{"posts":39,"avg_len":31.8,"kw":{"光":3,"窓":2,"天井":5,"壁":0,"空間":0,"ガラス":2,"照明":1,"コンクリート":1,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":1,"影":0,"反射":2,"外":3,"広":2,"高":6}}},"GroupG":{"color":"#639922","users":2,"apr":{"posts":22,"avg_len":16.3,"kw":{"光":4,"窓":6,"天井":3,"壁":1,"空間":4,"ガラス":1,"照明":0,"コンクリート":1,"開放":2,"木":1,"自然":1,"落ち着":1,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":0,"影":0,"反射":0,"外":3,"広":0,"高":1}},"may":{"posts":16,"avg_len":26.6,"kw":{"光":0,"窓":0,"天井":1,"壁":0,"空間":0,"ガラス":0,"照明":1,"コンクリート":0,"開放":1,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":2,"影":0,"反射":0,"外":0,"広":1,"高":2}}},"GroupH":{"color":"#888780","users":1,"apr":{"posts":10,"avg_len":26.6,"kw":{"光":0,"窓":0,"天井":3,"壁":0,"空間":0,"ガラス":0,"照明":0,"コンクリート":0,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":0,"洞窟":0,"素材":0,"構造":1,"影":0,"反射":0,"外":1,"広":1,"高":0}},"may":{"posts":10,"avg_len":18.4,"kw":{"光":0,"窓":0,"天井":0,"壁":0,"空間":2,"ガラス":0,"照明":0,"コンクリート":0,"開放":0,"木":0,"自然":0,"落ち着":0,"吹き抜け":0,"暖か":1,"洞窟":0,"素材":0,"構造":1,"影":0,"反射":0,"外":0,"広":0,"高":0}}}} as const

const KW_SHOW = ['光','窓','天井','壁','空間','照明','反射','構造','開放','外','高'] as const
const GROUPS = Object.keys(CHART_DATA) as (keyof typeof CHART_DATA)[]

const INSIGHTS: Record<string, string> = {
  GroupB: '4月は光・窓・暖かみなど感性的なワードが多かったが、5月は天井・反射が急増し構造・素材への関心にシフト。平均文字数も28→35字に増加。',
  GroupC: '4月は光・窓が飛び抜けて多く（計20回）、採光への着目が顕著。5月は件数が40→13件に減少（提出者が絞られた影響）。',
  GroupD: '4月の光・窓中心から、5月は照明・反射・高さへ移行。人工照明と天井高への注目が増した。',
  GroupE: '4月の平均文字数が57字と全グループ最長。5月は37字に落ち着いたが依然高水準。壁・空間から反射・構造へシフト。',
  GroupF: '4月は光・壁が各11回と最多クラス。5月は文字数が16→32字と約2倍になり、高さへの言及が0→6回に急増。',
  GroupG: '4月は窓・空間・開放感に着目。5月は構造・高さへシフトし、文字数も16→27字に増加。',
  GroupH: '1名のみのデータ（参考値）。4月は天井・構造中心、5月は空間・暖かみへ変化。',
}

// ── シンプルな棒グラフ（Chart.js不使用・SVG） ───────────────
function BarGroup({ label, apr, may, color }: { label: string; apr: number; may: number; color: string }) {
  const max = Math.max(apr, may, 1)
  return (
    <div className="flex flex-col gap-0.5 items-center" style={{ width: 32 }}>
      <div className="flex gap-0.5 items-end" style={{ height: 80 }}>
        <div
          style={{ width: 12, height: `${(apr / max) * 80}px`, background: '#378ADD', borderRadius: 2, minHeight: apr > 0 ? 3 : 0 }}
        />
        <div
          style={{ width: 12, height: `${(may / max) * 80}px`, background: color, borderRadius: 2, minHeight: may > 0 ? 3 : 0 }}
        />
      </div>
      <span className="text-xs text-gray-400" style={{ fontSize: 9 }}>{label}</span>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────
export default function DashboardContent() {
  const [activeGroup, setActiveGroup] = useState<keyof typeof CHART_DATA>('GroupB')
  const d = CHART_DATA[activeGroup]

  const lenDiff = d.may.avg_len - d.apr.avg_len
  const postDiff = d.may.posts - d.apr.posts
  const aprTotal = Object.values(d.apr.kw).reduce((a, b) => a + b, 0)
  const mayTotal = Object.values(d.may.kw).reduce((a, b) => a + b, 0)
  const kwDiff = mayTotal - aprTotal

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-5">
        <p className="text-xs text-gray-500 tracking-widest mb-1 uppercase">秋田県立大学 建築環境システム学科</p>
        <h1 className="text-xl font-medium">Photo World Café — キーワード変化分析</h1>
        <p className="text-sm text-gray-400 mt-1">両月提出者（4月・5月） · グループ別比較</p>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* グループタブ */}
        <div className="flex flex-wrap gap-2">
          {GROUPS.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className="px-3 py-1.5 rounded-lg text-sm border transition-all"
              style={{
                background: activeGroup === g ? CHART_DATA[g].color : 'white',
                color: activeGroup === g ? 'white' : '#6b7280',
                borderColor: activeGroup === g ? CHART_DATA[g].color : '#e5e7eb',
              }}
            >
              {g}
            </button>
          ))}
        </div>

        {/* メトリクス */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '参加人数', value: `${d.users}名`, neutral: true },
            { label: '平均文字数の変化', value: `${lenDiff >= 0 ? '+' : ''}${lenDiff.toFixed(1)}字`, up: lenDiff >= 0 },
            { label: '投稿数の変化', value: `${postDiff >= 0 ? '+' : ''}${postDiff}件`, up: postDiff >= 0 },
            { label: 'KW総出現数の変化', value: `${kwDiff >= 0 ? '+' : ''}${kwDiff}回`, up: kwDiff >= 0 },
          ].map(m => (
            <div key={m.label} className="bg-gray-100 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p
                className="text-xl font-medium"
                style={{ color: m.neutral ? '#111' : m.up ? '#3B6D11' : '#A32D2D' }}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* キーワードバーチャート */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">キーワード出現数の変化（4月 → 5月）</p>
          <div className="flex gap-3 mb-4 text-xs text-gray-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#378ADD' }} />4月</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: d.color }} />5月</span>
          </div>
          <div className="flex gap-2 items-end overflow-x-auto pb-1">
            {KW_SHOW.map(kw => (
              <BarGroup
                key={kw}
                label={kw}
                apr={d.apr.kw[kw] ?? 0}
                may={d.may.kw[kw] ?? 0}
                color={d.color}
              />
            ))}
          </div>
        </div>

        {/* 全グループ文字数比較 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-medium text-gray-400 mb-1">平均コメント文字数 — 全グループ比較</p>
          <div className="flex gap-3 mb-4 text-xs text-gray-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#378ADD' }} />4月</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#888' }} />5月</span>
          </div>
          <div className="flex gap-3 items-end">
            {GROUPS.map(g => {
              const gd = CHART_DATA[g]
              const isActive = g === activeGroup
              const max = 60
              return (
                <div key={g} className="flex flex-col gap-0.5 items-center cursor-pointer" style={{ width: 48 }} onClick={() => setActiveGroup(g)}>
                  <div className="flex gap-0.5 items-end" style={{ height: 80 }}>
                    <div style={{ width: 16, height: `${(gd.apr.avg_len / max) * 80}px`, background: isActive ? '#378ADD' : 'rgba(55,138,221,0.2)', borderRadius: 2, minHeight: 2 }} />
                    <div style={{ width: 16, height: `${(gd.may.avg_len / max) * 80}px`, background: isActive ? gd.color : `${gd.color}44`, borderRadius: 2, minHeight: 2 }} />
                  </div>
                  <span className="text-xs" style={{ fontSize: 10, color: isActive ? gd.color : '#9ca3af', fontWeight: isActive ? 600 : 400 }}>{g.replace('Group', 'G')}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* インサイト */}
        <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 leading-relaxed">
          {INSIGHTS[activeGroup]}
        </div>

      </div>
    </div>
  )
}
