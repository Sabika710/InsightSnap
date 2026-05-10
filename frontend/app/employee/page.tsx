"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '../lib/api'; 

interface Screenshot {
  id: number;
  file_path: string;
  captured_at: string;
  app_name?: string;
}

interface UserCard {
  id: number;
  full_name: string;
  email: string;
  is_active_monitoring: boolean;
  latest_screenshots: Screenshot[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EmployeePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserCard | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [previewImg, setPreviewImg] = useState<Screenshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [time, setTime] = useState(new Date());
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadUser = useCallback(async () => {
    if (isSyncingRef.current) return;
    try {
      const data = await apiFetch('/me') as UserCard;
      if (data) setUser(data);
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    loadUser();
    const interval = setInterval(loadUser, 10000);
    return () => clearInterval(interval);
  }, [router, loadUser]);

  // ✅ FIXED TOGGLE FUNCTION
  async function handleToggleAction() {
    if (!user || toggling) return;

    setToggling(true);
    isSyncingRef.current = true;

    const oldState = user.is_active_monitoring;
    const newState = !oldState;

    // Optimistic update
    setUser(prev => prev ? { ...prev, is_active_monitoring: newState } : null);

    try {
      const response = await apiFetch('/me/monitoring', {
        method: 'PATCH',
        body: JSON.stringify({ is_active_monitoring: newState }),
      });

      if (response && typeof response === 'object') {
        setUser(response as UserCard);
      }

      console.log("Monitoring toggled successfully");
    } catch (err: any) {
      console.error("SYNC_ERROR:", err);

      // Rollback
      setUser(prev => prev ? { ...prev, is_active_monitoring: oldState } : null);

      alert(`System Sync Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setToggling(false);
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 1500);
    }
  }

  const logout = () => {
    localStorage.clear();
    router.replace('/login');
  };

  // 4. RENDER LOGIC
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] font-mono text-cyan-400 uppercase tracking-[0.5em]">
        [ INITIALIZING_NAVY_NODE... ]
      </div>
    );
  }

  const isActive = user?.is_active_monitoring ?? false;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-mono relative overflow-x-hidden p-6 flex flex-col items-center">
      
      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-40 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse shadow-[0_0_10px_cyan]' : 'bg-orange-600 shadow-[0_0_10px_orange]'}`} />
          <span className="text-[10px] tracking-[0.4em] text-cyan-500/50 uppercase font-bold">SnapSync_v2.0</span>
        </div>
        <button 
          onClick={logout} 
          className="text-[9px] text-red-500/50 hover:text-red-500 tracking-[0.3em] uppercase transition-all px-3 py-1 border border-red-500/10 rounded hover:bg-red-500/5"
        >
          [ TERMINATE_SESSION ]
        </button>
      </div>

      <div className="mt-24 mb-8 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">{user?.full_name || 'Authorized User'}</h1>
        <p className="text-[10px] text-cyan-500/30 uppercase tracking-[0.4em] mt-1">{user?.email}</p>
      </div>

      {/* NEON STATUS CIRCLE */}
      <div className="relative mb-12">
        <div className={`absolute inset-0 rounded-full blur-[45px] transition-all duration-1000 opacity-25 ${isActive ? 'bg-cyan-400' : 'bg-orange-500'}`} />
        <div className={`w-52 h-52 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-700 
          ${isActive 
            ? 'border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.4)] bg-cyan-400/5' 
            : 'border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.3)] bg-orange-500/5'}`}>
          <span className={`text-5xl font-black tracking-tighter ${isActive ? 'text-cyan-400' : 'text-orange-500'}`}>
            {isActive ? 'ON' : 'OFF'}
          </span>
          <span className={`text-[9px] font-bold tracking-[0.4em] mt-2 ${isActive ? 'text-cyan-400/60' : 'text-orange-500/60'}`}>
            {isActive ? 'MONITORING' : 'ON BREAK'}
          </span>
        </div>
      </div>

      {/* THE ACTION BUTTON */}
      <div className="w-full max-w-sm mb-16">
        <button
          onClick={handleToggleAction}
          disabled={toggling}
          className={`w-full py-4 rounded-xl font-bold text-[10px] tracking-[0.3em] uppercase border-2 transition-all active:scale-95
            ${isActive 
              ? 'border-orange-500/30 text-orange-500/80 bg-orange-500/5 hover:bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.1)]' 
              : 'border-cyan-400/30 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]'}`}
        >
          {toggling ? '>>> SYNCING_NODE' : isActive ? '[ GO ON BREAK ]' : '[ RESUME MONITORING ]'}
        </button>
      </div>

      {/* FEED GRID */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-6 opacity-30">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500" />
          <span className="text-[9px] uppercase tracking-[0.5em] whitespace-nowrap">Local_Cache_Feed</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => {
            const shot = user?.latest_screenshots?.[i];
            return (
              <div 
                key={shot?.id || i} 
                className="group aspect-video rounded-lg bg-[#0f172a] border border-white/5 overflow-hidden relative transition-all hover:border-cyan-500/40 cursor-zoom-in"
                onClick={() => shot && setPreviewImg(shot)}
              >
                {shot ? (
                  <>
                    <img 
                      src={`${API}/${shot.file_path}`} 
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-opacity" 
                      alt="Capture" 
                    />
                    <div className="absolute bottom-2 left-2 text-[7px] text-cyan-400 font-bold opacity-0 group-hover:opacity-100">
                      {new Date(shot.captured_at).toLocaleTimeString([], { hour12: false })}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[7px] text-slate-800 tracking-tighter italic font-bold">IDLE_CACHING</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-between items-center">
          <span className="text-[8px] text-slate-600 uppercase tracking-widest">
            Node_Status: {isActive ? 'Broadcasting' : 'Suspended'}
          </span>
          <button 
            onClick={() => setShowHistory(true)} 
            className="text-[9px] text-cyan-500/40 hover:text-cyan-400 tracking-widest uppercase"
          >
            Full Archive View &raquo;
          </button>
        </div>
      </div>

      {/* ARCHIVE MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-[#020617] p-8 overflow-y-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-10 border-b border-cyan-500/10 pb-4">
            <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-[0.3em]">Full_Capture_Log</h2>
            <button 
              onClick={() => setShowHistory(false)} 
              className="text-xs text-red-500/60 font-bold tracking-widest hover:text-red-500"
            >
              [ CLOSE_ARCHIVE ]
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {user?.latest_screenshots?.map((shot) => (
              <div 
                key={shot.id} 
                className="group relative aspect-video bg-[#0f172a] border border-white/5 overflow-hidden hover:border-cyan-500/40 transition-all cursor-zoom-in" 
                onClick={() => setPreviewImg(shot)}
              >
                <img 
                  src={`${API}/${shot.file_path}`} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100" 
                  alt="History" 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ENLARGEMENT MODAL */}
      {previewImg && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm animate-in zoom-in-95 duration-200" 
          onClick={() => setPreviewImg(null)}
        >
          <img 
            src={`${API}/${previewImg.file_path}`} 
            className="max-w-full max-h-[85vh] border border-white/10 shadow-2xl" 
            alt="Preview" 
          />
          <div className="absolute bottom-10 text-cyan-400/50 text-[10px] tracking-[0.5em] uppercase">
            Click anywhere to minimize
          </div>
        </div>
      )}
    </div>
  );
}