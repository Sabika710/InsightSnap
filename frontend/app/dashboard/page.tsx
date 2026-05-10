'use client'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, Cell, CartesianGrid
} from 'recharts'
import { apiFetch, getSession, clearSession } from '../lib/api'
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
const { useState, useEffect, useCallback } = React;


const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// --- Interfaces ---
interface Screenshot {
  id: number
  file_path: string
  window_title: string | null
  app_name: string | null
  productivity_score: number | null
  captured_at: string
  score?: number; 
}

interface Employee {
  id: number
  full_name: string
  email: string
  is_active_monitoring: boolean
  last_seen: string | null
  latest_screenshots: Screenshot[]
}

interface ChartData {
  score_timeline: { slot: string; user_id: number; full_name: string; avg_score: number }[]
  app_usage: { app_name: string; count: number; avg_score: number }[]
  hourly_avg: { hour: number; avg_score: number }[]
  current_scores: { user_id: number; full_name: string; score: number | null; window_title: string | null }[]
}

// --- Utilities ---
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function scoreColor(score: number | null): string {
  if (score === null) return '#4a6080'
  if (score >= 70) return '#00ff9d'
  if (score >= 50) return '#ffd166'
  return '#ff4560'
}

function formatHour(h: number) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 || 12
  return `${hour}${ampm}`
}

// --- Components ---
function ScoreGauge({ score, size = 80 }: { score: number | null; size?: number }) {
  const val = score ?? 0
  const data = [{ value: val }]
  const color = scoreColor(score)
  return (
    <div className="relative gauge-glow" style={{ width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        innerRadius={size * 0.35}
        outerRadius={size * 0.48}
        data={data}
        startAngle={225}
        endAngle={-45}
        barSize={size * 0.08}
      >
        <RadialBar dataKey="value" background={{ fill: '#1a3028' }} cornerRadius={4}>
          <Cell fill={color} />
        </RadialBar>
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-ibmmono font-bold text-white" style={{ fontSize: size * 0.22 }}>
          {score !== null ? Math.round(score) : '--'}
        </span>
      </div>
    </div>
  )
}

function EmployeeCard({
  emp,
  onSelect,
  onToggle,
  onRemove,
  index
}: {
  emp: Employee;
  onSelect: (emp: Employee) => void;
  onToggle: (id: number, val: boolean) => void;
  onRemove: (id: number) => void;
  index: number;
}) {
  const [toggling, setToggling] = useState(false)
  const latestShot = emp.latest_screenshots?.[0]
  const latestScore = latestShot?.productivity_score ?? null
  const isActive = emp.is_active_monitoring

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    setToggling(true)
    await onToggle(emp.id, !isActive) 
    setToggling(false)
  }

  return (
    <div
      className="card-stagger rounded-xl p-4 flex flex-col gap-3 transition-all hover:translate-y-[-2px]"
      style={{
        background: '#0a1a14',
        border: '1px solid rgba(0,255,157,0.12)',
        animationDelay: `${index * 80}ms`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-ibmmono font-bold text-xs"
            style={{ background: 'rgba(0,255,157,0.05)', color: '#00ff9d', border: '1px solid rgba(0,255,157,0.2)' }}
          >
            {initials(emp.full_name)}
          </div>
          <div className="min-w-0">
            <div className="font-ibmmono font-semibold text-sm text-white truncate leading-tight">
              {emp.full_name}
            </div>
            <div className="font-ibmsans text-[10px] text-[#4a8070] truncate opacity-70">
              {emp.email}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00ff9d] dot-pulse' : 'bg-[#ff4560]'}`} />
                <span className="font-ibmmono text-[9px] uppercase font-bold" style={{ color: isActive ? '#00ff9d' : '#ff4560' }}>
                    {isActive ? 'Live' : 'Paused'}
                </span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(emp.id); }}
                className="text-[9px] font-ibmmono text-[#ff4560]/50 hover:text-[#ff4560] transition-colors"
            >
                [REMOVE_ENTITY]
            </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-black/30 p-3 rounded-lg border border-white/5">
        <ScoreGauge score={latestScore} size={60} />
        <div className="flex-1 min-w-0">
          {latestShot?.app_name ? (
            <div className="font-ibmmono text-[10px] text-[#00ff9d] uppercase truncate font-bold tracking-tight">
              {latestShot.app_name}
            </div>
          ) : (
            <div className="font-ibmmono text-[10px] text-[#2a4060] uppercase italic">System_Idle</div>
          )}
          {latestShot?.window_title && (
            <div className="font-ibmmono text-[9px] text-[#4a8070] truncate mt-0.5" title={latestShot.window_title}>
              {latestShot.window_title}
            </div>
          )}
          {emp.last_seen && (
            <div className="font-ibmmono text-[8px] text-[#2a4060] mt-2 tracking-widest border-t border-white/5 pt-1">
              LAST_SYNC: {new Date(emp.last_seen).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 cursor-pointer group" onClick={() => onSelect(emp)}>
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-lg border border-white/5 bg-black/20 group-hover:border-[#00ff9d]/30 transition-all">
          {emp.latest_screenshots?.filter(s => s.file_path).slice(0, 3).map((shot) => (
            <div key={shot.id} className="aspect-video rounded overflow-hidden border border-white/10 relative bg-black">
              <img
                src={`${API}/${shot.file_path.startsWith('static') ? shot.file_path : shot.file_path.replace(/^\/+/, '')}`}
                alt="capture"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
              />
            </div>
          ))}
          {(!emp.latest_screenshots || emp.latest_screenshots.length === 0) && 
            [0,1,2].map(i => (
              <div key={i} className="aspect-video rounded border border-dashed border-white/5 bg-white/5 flex items-center justify-center">
                <span className="font-ibmmono text-[8px] text-[#1a3028]">NULL</span>
              </div>
            ))
          }
        </div>
        <div className="flex justify-between mt-2 px-1 items-center">
          <span className="font-ibmmono text-[9px] text-[#2a4060] uppercase font-bold tracking-tighter">Visual_Stream</span>
          <span className="font-ibmmono text-[9px] text-[#00ff9d] opacity-0 group-hover:opacity-100 transition-all"
          onClick={() => onSelect(emp)}
          >VIEW_ARCHIVE &raquo;</span>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={toggling}
        className="w-full font-ibmmono text-[10px] font-bold tracking-[0.2em] uppercase py-2.5 rounded-md transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
        style={{
          background: isActive ? 'rgba(255,69,96,0.05)' : 'rgba(0,255,157,0.05)',
          border: isActive ? '1px solid rgba(255,69,96,0.2)' : '1px solid rgba(0,255,157,0.2)',
          color: isActive ? '#ff4560' : '#00ff9d',
        }}
      >
        {toggling ? 'COMM_LINK_BUSY...' : isActive ? '[ TERMINATE_SESSION ]' : '[ INITIALIZE_SESSION ]'}
      </button>
    </div>
  )
}

// --- Main Page ---
export default function DashboardPage() {
  const router = useRouter()
  const [team, setTeam] = useState<Employee[]>([])
  const [charts, setCharts] = useState<ChartData | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pulse' | 'analytics' | 'nexus'>('pulse')
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [question, setQuestion] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    try {
      const [teamData, chartData] = await Promise.all([
        apiFetch('/api/manager/team') as Promise<Employee[]>,
        apiFetch('/api/manager/charts?hours=8') as Promise<ChartData>,
      ])
      setTeam(teamData)
      setCharts(chartData)
      setError('')
      
      setSelectedEmployee(prev => {
        if (!prev) return null;
        return teamData.find(e => e.id === prev.id) || null;
      });
    } catch (err: any) {
      setError(err.message || 'Data sync failed')
      if (err.message?.includes('401')) router.replace('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const session = getSession();
  
  // 1. Static Guard: Don't even start if no session exists
    if (!session) { 
      router.replace('/login'); 
      return; 
    }
    if (session.role !== 'manager') { 
      router.replace('/employee'); 
      return; 
    }

    const fetchDataSafe = async () => {
      try {
        await fetchData();
      } catch (err: any) {
        if (err.message === 'SESSION_EXPIRED' || err.message === 'UNAUTHORIZED_NO_TOKEN') {
          clearInterval(interval); // Stop the 15s timer immediately
          router.replace('/login?error=expired');
        }
      }
  };

  fetchDataSafe();
  const interval = setInterval(fetchDataSafe, 15000);

  return () => clearInterval(interval);
}, [router]);  

  async function toggleEmployee(userId: number, newState: boolean) {
    try {
      const updated = await apiFetch(`/api/manager/users/${userId}/monitoring`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active_monitoring: newState }),
      }) as Employee
      setTeam((prev) => prev.map((e) => e.id === userId ? { ...e, ...updated } : e))
    } catch (err: any) {
      setError(err.message || 'Toggle failed')
    }
  }

  async function handleDelete(userId: number) {
    if (!confirm("CRITICAL: Permanent removal of employee data. Proceed?")) return;
    try {
        await apiFetch(`/api/manager/users/${userId}`, { method: 'DELETE' });
        setTeam(prev => prev.filter(e => e.id !== userId));
        if (selectedEmployee?.id === userId) setSelectedEmployee(null);
    } catch (err: any) {
        setError(err.message || 'Removal failed');
    }
  }
  async function addEmployee() {
     const name = prompt("Enter Employee Full Name:");
     const email = prompt("Enter Employee Email:");

     if (!name || !email) return;
     try {
         const newNode = await apiFetch('/api/manager/users', {
             method: 'POST',
             body: JSON.stringify({
                 full_name: name,
                 email: email,
                 role: 'employee',
                 password: "pass123" 
             }), 
         }) as Employee;
 
         setTeam(prev => [...prev, newNode]);
         fetchData();
     } catch (err: any) {
         setError(err.message || 'Failed to add remote node');
     }
 }

  async function askNexus(e: React.FormEvent, currentQuestion: string) {
    e.preventDefault(); 
    if (!currentQuestion.trim()) return;
    
    setQuestion(""); 

    setChatHistory(prev => [...prev, { role: 'user', content: currentQuestion }]);
    setIsTyping(true);

     try {
      const data = await apiFetch('/api/manager/insights', {
        method: 'POST',
        body: JSON.stringify({ prompt: currentQuestion })
      }) as { reply: string };

      setChatHistory(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (err: any) {
      setError("Uplink Failure: AI Offline");
      setChatHistory(prev => [...prev, { role: 'ai', content: "SYSTEM_ERR: Failed to reach Groq intelligence." }]);
    } finally {
      setIsTyping(false);
    }
   }


  const signOut = () => { clearSession(); router.replace('/login'); }

  // Chart Formatting
  const timelineData = (() => {
    if (!charts) return []
    const slots: Record<string, any> = {}
    charts.score_timeline.forEach(({ slot, full_name, avg_score }) => {
      if (!slots[slot]) slots[slot] = { slot }
      slots[slot][full_name] = avg_score
    })
    return Object.values(slots).sort((a, b) => a.slot.localeCompare(b.slot))
  })()

  const employeeNames = Array.from(new Set(charts?.score_timeline.map(s => s.full_name) || []))
  const colors = ['#00ff9d', '#ffd166', '#00e5ff', '#ff4560', '#a855f7']
  const activeCount = team.filter(e => e.is_active_monitoring).length
  const totalAvg = charts?.current_scores.length 
    ? Math.round(charts.current_scores.reduce((a, b) => a + (b.score || 0), 0) / charts.current_scores.length)
    : 0

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#050e0b' }}>
        <div className="w-12 h-12 border-2 border-[#00ff9d]/20 border-t-[#00ff9d] rounded-full animate-spin" />
        <div className="font-ibmmono text-[#00ff9d] text-xs tracking-[0.4em] uppercase">Authenticating_Uplink...</div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: '#07100f', color: '#e2e8f0' }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 bg-[#050e0b] border-right-[1px] border-white/5">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ff9d] shadow-[0_0_10px_#00ff9d]" />
            <span className="font-ibmmono text-sm font-black tracking-[0.3em] text-white">SNAPSYNC</span>
          </div>
          <div className="font-ibmmono text-[9px] text-[#4a8070] tracking-[0.2em] uppercase opacity-60">Manager_Terminal_v2.4</div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="font-ibmmono text-[10px] text-[#4a8070] uppercase mb-1">Active_Nodes</div>
            <div className="font-ibmmono text-2xl font-bold text-white flex items-baseline gap-1">
              {activeCount}<span className="text-xs text-[#2a4060]">/{team.length}</span>
            </div>
          </div>
          <div>
            <div className="font-ibmmono text-[10px] text-[#4a8070] uppercase mb-1">Fleet_Productivity</div>
            <div className="font-ibmmono text-2xl font-bold" style={{ color: scoreColor(totalAvg) }}>{totalAvg}%</div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: 'pulse', label: 'Team Pulse', icon: '⬢' },
            { id: 'analytics', label: 'Intelligence', icon: '📊' },
            { id: 'nexus', label: 'Nexus Insight', icon: '✧' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-ibmmono text-[11px] uppercase tracking-widest transition-all"
              style={{
                background: tab === t.id ? 'rgba(0,255,157,0.08)' : 'transparent',
                color: tab === t.id ? '#00ff9d' : '#4a8070',
                border: tab === t.id ? '1px solid rgba(0,255,157,0.15)' : '1px solid transparent',
              }}
            >
              <span className="text-lg opacity-50">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
            <button onClick={fetchData} className="w-full font-ibmmono text-[10px] py-2 rounded border border-white/5 bg-white/5 text-[#4a8070] hover:text-white transition-colors uppercase">↺ Refresh_Stats</button>
            <button onClick={signOut} className="w-full font-ibmmono text-[10px] py-2 rounded border border-[#ff4560]/20 text-[#ff4560] hover:bg-[#ff4560]/10 transition-colors uppercase">⏻ Decouple</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-6 sticky top-0 z-20 flex items-center justify-between bg-[#07100f]/80 backdrop-blur-xl border-b border-white/5">
          <div>
            <h1 className="font-ibmmono font-bold text-xl uppercase tracking-tight text-white">
              {tab === 'pulse' ? 'Real-Time Fleet Status' : 'Historical Analysis'}
            </h1>
            <p className="font-ibmsans text-xs text-[#4a8070] mt-1 italic">
              Streaming encrypted telemetry from {team.length} remote workstations...
            </p>
          </div>
          {error && <div className="font-ibmmono text-[10px] text-[#ff4560] bg-[#ff4560]/10 px-4 py-2 rounded border border-[#ff4560]/20 animate-pulse">SYSTEM_ERR: {error}</div>}
        </header>

        <div className="p-8">
          {tab === 'pulse' && (
            <div className="space-y-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full shadow-[0_0_8px_#00ff9d]" />
                  <h2 className="font-ibmmono text-xs font-bold text-[#4a8070] uppercase tracking-[0.3em]">Directory_Manifest</h2>
                </div>
                <button 
                    onClick={addEmployee}
                    className="font-ibmmono text-[10px] px-4 py-2 bg-[#00ff9d]/5 border border-[#00ff9d]/20 text-[#00ff9d] rounded hover:bg-[#00ff9d]/10 transition-all font-bold"
                >
                    + ADD_REMOTE_NODE
                </button>
              </div>

              {/* Personnel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {team.map((emp, i) => (
                  <EmployeeCard 
                    key={emp.id} 
                    emp={emp}
                    onSelect={setSelectedEmployee} // This connects the click to the display
                    onRemove={handleDelete}
                    onToggle={toggleEmployee}
                    index={i}
                  />
                ))}
              </div>

              {/* History Expansion View */}
              {selectedEmployee && (
                <div className="mt-12 rounded-2xl p-8 bg-[#0a1a14] border border-[#00ff9d]/20 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="px-2 py-1 bg-[#00ff9d]/10 text-[#00ff9d] font-ibmmono text-[10px] rounded border border-[#00ff9d]/20">ARCHIVE_MODE</div>
                        <h2 className="font-ibmmono text-2xl font-black text-white">{selectedEmployee.full_name}</h2>
                      </div>
                      <p className="font-ibmmono text-xs text-[#4a8070] tracking-widest uppercase">Telemetry timeline • {selectedEmployee.latest_screenshots.length} recent packets captured</p>
                    </div>
                    <button onClick={() => setSelectedEmployee(null)} className="font-ibmmono text-xs p-2 bg-white/5 hover:bg-white/10 text-[#4a8070] hover:text-white rounded border border-white/5 transition-all">✕ CLOSE_STREAM</button>
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
                    {selectedEmployee.latest_screenshots.map((shot, idx) => {
                      const isFocused = (shot.productivity_score || 0) >= 70;
                      return (
                        <div key={idx} className="flex-shrink-0 w-80 group">
                          <div className="relative rounded-xl overflow-hidden border border-white/5 bg-black h-[200px] transition-all group-hover:border-[#00ff9d]/40">
                            <div className={`absolute top-3 right-3 z-20 px-2 py-1 rounded font-ibmmono text-[9px] uppercase border backdrop-blur-md ${isFocused ? 'bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/20' : 'bg-[#ff4560]/10 text-[#ff4560] border-[#ff4560]/20'}`}>
                              {isFocused ? '● FOCUSED' : '○ DISTRACTED'}
                            </div>
                            <img 
                                src={`${API}/${shot.file_path.replace('backend/', '')}?t=${new Date().getTime()}`} 
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" 
                                alt="Activity" 
                            />
                            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black to-transparent">
                              <p className="font-ibmmono text-[10px] text-[#00ff9d] truncate font-bold">{shot.window_title || 'Background Process'}</p>
                              <div className="flex justify-between items-end mt-2">
                                <div className="font-ibmmono text-[8px] text-gray-500 uppercase">
                                  {new Date(shot.captured_at).toLocaleDateString()} — {new Date(shot.captured_at).toLocaleTimeString()}
                                </div>
                                <div className="font-ibmmono text-sm font-bold" style={{ color: scoreColor(shot.productivity_score) }}>{Math.round(shot.productivity_score || 0)}%</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'analytics' && charts && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Timeline Chart */}
              <div className="rounded-2xl p-8 bg-[#0a1a14] border border-white/5">
                <h2 className="font-ibmmono text-xs font-bold text-[#4a8070] uppercase tracking-widest mb-8">Pulse_Timeline (Last 8 Hours)</h2>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1a3028" vertical={false} />
                       <XAxis 
                         dataKey="slot" 
                         tick={{ fontSize: 10, fill: '#4a8070', fontFamily: 'monospace' }} 
                         axisLine={false} 
                       />
                       <YAxis 
                         domain={[0, 100]} 
                         tick={{ fontSize: 10, fill: '#4a8070', fontFamily: 'monospace' }} 
                         axisLine={false} 
                       />
                       <Tooltip 
                         contentStyle={{ 
                             background: 'rgba(5, 14, 11, 0.9)', 
                             border: '1px solid rgba(0, 255, 157, 0.3)', 
                             borderRadius: '8px',
                             fontFamily: 'monospace', 
                             fontSize: '10px' 
                         }}
                         itemStyle={{ color: '#00ff9d' }}
                         cursor={{ stroke: '#4a8070', strokeWidth: 1 }}
                       />
                       {employeeNames.map((name, i) => (
                         <Line 
                           key={name} 
                           type="monotone" 
                           dataKey={name} 
                           stroke={colors[i % colors.length]} 
                           strokeWidth={3} 
                           dot={{ r: 4, strokeWidth: 2, fill: '#0a1a14' }} 
                           activeDot={{ r: 6, strokeWidth: 0 }}
                           connectNulls 
                         />
                       ))}
                     </LineChart>
                    </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Stats */}
                <div className="rounded-2xl p-8 bg-[#0a1a14] border border-white/5">
                  <h2 className="font-ibmmono text-xs font-bold text-[#4a8070] uppercase tracking-widest mb-8">Hourly_Average_Performance</h2>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.hourly_avg}>
                        <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10, fill: '#4a8070', fontFamily: 'monospace' }} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#4a8070' }} hide />
                        <Bar dataKey="avg_score" radius={[4, 4, 0, 0]} barSize={30}>
                            {charts.hourly_avg.map((entry, i) => (
                            <Cell key={i} fill={scoreColor(entry.avg_score)} fillOpacity={0.6} />
                            ))}
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Live Leaderboard */}
                <div className="rounded-2xl p-8 bg-[#0a1a14] border border-white/5">
                  <h2 className="font-ibmmono text-xs font-bold text-[#4a8070] uppercase tracking-widest mb-6">Efficiency_Ranking</h2>
                  <div className="space-y-4">
                    {[...charts.current_scores].sort((a, b) => (b.score || 0) - (a.score || 0)).map((emp, i) => (
                      <div key={emp.user_id} className="flex items-center gap-4 p-3 rounded bg-black/20 border border-white/5">
                        <span className="font-ibmmono text-xs text-[#2a4060] font-bold">{String(i + 1).padStart(2, '0')}</span>
                        <div className="w-8 h-8 rounded bg-[#00ff9d]/10 flex items-center justify-center font-ibmmono text-[10px] text-[#00ff9d] border border-[#00ff9d]/20">{initials(emp.full_name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-ibmmono text-xs text-white truncate font-bold">{emp.full_name}</div>
                          <div className="font-ibmmono text-[9px] text-[#4a8070] truncate opacity-60 italic">{emp.window_title || 'Node_Standby'}</div>
                        </div>
                        <div className="font-ibmmono font-bold text-lg" style={{ color: scoreColor(emp.score) }}>{emp.score ?? '--'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* App Usage Logic */}
              <div className="rounded-2xl p-8 bg-[#0a1a14] border border-white/5">
                <h2 className="font-ibmmono text-xs font-bold text-[#4a8070] uppercase tracking-widest mb-8">Application_Distribution</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {charts.app_usage.map((app, i) => {
                    const maxVal = charts.app_usage[0]?.count || 1;
                    const width = (app.count / maxVal) * 100;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-center font-ibmmono text-[11px]">
                          <span className="text-white truncate w-40">{app.app_name}</span>
                          <span style={{ color: scoreColor(app.avg_score) }}>{app.avg_score.toFixed(0)}% PROD</span>
                        </div>
                        <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${width}%`, background: scoreColor(app.avg_score) }} />
                        </div>
                        <div className="font-ibmmono text-[9px] text-[#2a4060] text-right">{app.count} SESSIONS_CAPTURED</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
          {tab === 'nexus' && (
            <div className="h-[calc(100vh-200px)] flex flex-col animate-in fade-in duration-500">
              {/* 1. ACTUAL CHAT HISTORY RENDERER */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 p-4">
                {/* Static Welcome Message */}
                <div className="flex gap-4 max-w-[85%]">
                  <div className="w-10 h-10 shrink-0 rounded bg-[#00ff9d]/10 border border-[#00ff9d]/30 flex items-center justify-center font-ibmmono text-xs text-[#00ff9d]">AI</div>
                  <div className="p-5 rounded-2xl bg-[#0a1a14] border border-[#00ff9d]/10 font-ibmmono text-[13px] text-gray-300">
                    <span className="text-[#00ff9d] font-bold tracking-widest">{'>'}{'>'} NEXUS_INSIGHT_V2.4</span>
                    <p className="mt-2">Uplink stable. I am ready to analyze fleet telemetry, bk.</p>
                  </div>
                </div>

                {/* Dynamic Messages from State */}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
    
                    {/* Avatar Box */}
                    <div className={`w-10 h-10 shrink-0 rounded border flex items-center justify-center font-ibmmono text-xs ${
                      msg.role === 'user' ? 'bg-white/5 border-white/10 text-white' : 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]'
                    }`}>
                      {msg.role === 'user' ? 'USR' : 'AI'}
                    </div>

                    {/* Message Content Box */}
                    <div className={`p-5 rounded-2xl border font-ibmmono text-[13px] ${
                      msg.role === 'user' 
                        ? 'bg-white/5 border-white/5 text-gray-200' 
                        : 'bg-[#0a1a14] border-[#00ff9d]/10 text-gray-300'
                    }`}>
                      {/* --- CONTENT LOGIC STARTS HERE --- */}
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-[#00ff9d] prose-code:text-cyan-300">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}                                
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded bg-[#00ff9d]/10 border border-[#00ff9d]/30" />
                    <div className="p-4 bg-[#0a1a14] border border-[#00ff9d]/10 rounded-2xl text-[#00ff9d] font-ibmmono text-[10px]">
                      ANALYZING_DATA_STREAM...
                    </div>
                  </div>
                )}
              </div>

              {/* 2. INPUT SECTION */}
              <div className="mt-auto flex justify-center p-8">
                <div className="relative w-full max-w-2xl group">
                  <div className="absolute -inset-0.5 bg-[#00ff9d] opacity-10 blur-md group-focus-within:opacity-30 transition-opacity rounded-lg"></div>
                  <div className="relative bg-[#050e0b] border border-[#00ff9d]/20 rounded-lg p-4">
                    <form onSubmit={(e) => askNexus(e, question)} className="flex gap-4">
                      <input 
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Command Nexus..."
                        className="bg-transparent outline-none flex-1 text-[#00ff9d] font-ibmmono text-sm"
                      />
                      <button type="submit" className="text-[#00ff9d] opacity-60 hover:opacity-100 transition-opacity">
                        SEND_CMD
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}          
            
      </main>
      
      {/* Scroll Styling */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 157, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 255, 157, 0.2); }
        .dot-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
        .gauge-glow { filter: drop-shadow(0 0 8px rgba(0, 255, 157, 0.2)); }
      `}</style>
    </div>
  )
}