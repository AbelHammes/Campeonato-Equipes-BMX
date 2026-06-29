import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Users, Building, Map, Tv, ArrowRight, Lock } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import SpectatorPanel from './components/SpectatorPanel';
import { Modalidade } from './types';

export default function App() {
  const [viewMode, setViewMode] = useState<Modalidade | null>(null);
  const [eventID, setEventID] = useState('brasileiro2026');
  const [isOnline, setIsOnline] = useState(true);

  // Estados de autenticação do Admin
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Detectar parâmetros da URL na inicialização
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view')?.toLowerCase();
    const eventParam = params.get('event')?.toLowerCase();

    if (viewParam === 'clube' || viewParam === 'equipe' || viewParam === 'estado') {
      setViewMode(viewParam as Modalidade);
    }

    if (eventParam) {
      setEventID(eventParam);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'bmx2026') {
      setIsAdminAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Senha incorreta! Tente novamente.');
      setPassword('');
    }
  };

  // Se o modo espectador estiver ativo através da URL (?view=...)
  if (viewMode) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-yellow-500 selection:text-slate-900 pb-10">
        {/* HEADER DO ESPECTADOR COM NAVEGAÇÃO ENTRE OS LINKS */}
        <header className="bg-slate-950/80 border-b border-slate-900 sticky top-0 z-50 backdrop-blur-md px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-500 text-slate-950 font-black font-display text-xs px-2.5 py-1 rounded-lg italic">
                BMX LIVE
              </span>
              <h2 className="text-sm font-bold text-slate-300">Painel de Transmissão Oficial</h2>
            </div>

            {/* Alternador Rápido de Links para o Espectador */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => {
                  setViewMode('equipe');
                  window.history.replaceState(null, '', `?view=equipe&event=${eventID}`);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase cursor-pointer transition flex items-center gap-1 ${
                  viewMode === 'equipe' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Equipes
              </button>
              <button
                onClick={() => {
                  setViewMode('clube');
                  window.history.replaceState(null, '', `?view=clube&event=${eventID}`);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase cursor-pointer transition flex items-center gap-1 ${
                  viewMode === 'clube' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                Clubes
              </button>
              <button
                onClick={() => {
                  setViewMode('estado');
                  window.history.replaceState(null, '', `?view=estado&event=${eventID}`);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase cursor-pointer transition flex items-center gap-1 ${
                  viewMode === 'estado' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                Estados
              </button>
            </div>
          </div>
        </header>

        <SpectatorPanel modalidade={viewMode} eventID={eventID} />
      </div>
    );
  }

  // Se o Admin estiver autenticado
  if (isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-yellow-500 selection:text-slate-900 pb-10">
        <AdminPanel 
          eventID={eventID} 
          setEventID={setEventID} 
          isOnline={isOnline} 
          setIsOnline={setIsOnline} 
        />
      </div>
    );
  }

  // Tela de Login Admin Estilizada (Substitui o window.prompt original)
  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 selection:bg-yellow-500 selection:text-slate-900 relative overflow-hidden">
      {/* Círculos de luz decorativos de arena ao fundo */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 p-4 rounded-3xl mb-4 shadow-xl shadow-amber-950/20">
            <Lock className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black font-display italic text-white uppercase tracking-tight">
            BMX LIVE PRO <span className="text-yellow-400">2026</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 uppercase font-bold tracking-wider">
            Painel de Controle Restrito
          </p>
        </div>

        {/* FORMULÁRIO DE LOGIN */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">
              Senha do Administrador
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                className="w-full bg-slate-950 border border-slate-800 py-3.5 pl-11 pr-12 rounded-2xl text-xs font-bold text-white outline-none focus:border-yellow-500 transition shadow-inner placeholder:text-slate-700"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {loginError && (
              <p className="text-[11px] text-rose-500 font-bold mt-2 text-center animate-pulse">
                {loginError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-amber-950/20 uppercase tracking-wide text-xs transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            Entrar no Painel Admin
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* ATALHO RÁPIDO PARA ESPECTADORES */}
        <div className="border-t border-slate-800/80 mt-6 pt-5 text-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-3">
            Acesso para Espectadores / Público
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setViewMode('equipe');
                window.history.replaceState(null, '', `?view=equipe&event=${eventID}`);
              }}
              className="bg-slate-950 hover:bg-slate-850 border border-slate-850 p-2.5 rounded-xl text-[10px] font-extrabold text-slate-300 uppercase transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <Users className="w-4 h-4 text-blue-400" />
              Equipes
            </button>
            <button
              onClick={() => {
                setViewMode('clube');
                window.history.replaceState(null, '', `?view=clube&event=${eventID}`);
              }}
              className="bg-slate-950 hover:bg-slate-850 border border-slate-850 p-2.5 rounded-xl text-[10px] font-extrabold text-slate-300 uppercase transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <Building className="w-4 h-4 text-emerald-400" />
              Clubes
            </button>
            <button
              onClick={() => {
                setViewMode('estado');
                window.history.replaceState(null, '', `?view=estado&event=${eventID}`);
              }}
              className="bg-slate-950 hover:bg-slate-850 border border-slate-850 p-2.5 rounded-xl text-[10px] font-extrabold text-slate-300 uppercase transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <Map className="w-4 h-4 text-amber-500" />
              Estados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
