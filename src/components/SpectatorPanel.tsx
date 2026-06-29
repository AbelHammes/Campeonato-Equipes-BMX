import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Users, 
  MapPin, 
  Clock, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  Search,
  Zap,
  TrendingUp,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CampeonatoData, Atleta, Modalidade, EquipeRanking } from '../types';
import { escutarCampeonato } from '../firebase';

interface SpectatorPanelProps {
  modalidade: Modalidade;
  eventID: string;
}

const DEFAULT_PONTOS = {
  1: 20, 2: 18, 3: 16, 4: 14, 5: 12, 6: 10, 7: 8, 8: 6, participacao: 1
};

export default function SpectatorPanel({ modalidade, eventID }: SpectatorPanelProps) {
  const [data, setData] = useState<CampeonatoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEquipe, setExpandedEquipe] = useState<string | null>(null);

  // Escuta dados em tempo real da modalidade correspondente via Firebase
  useEffect(() => {
    setLoading(true);
    const unsubscribe = escutarCampeonato(eventID || 'default', modalidade, (firebaseData) => {
      if (firebaseData) {
        setData(firebaseData);
      } else {
        // Se não houver dados no Firebase ainda, tenta recuperar do localStorage
        const saved = localStorage.getItem(`bmx_championships_v1`);
        if (saved) {
          try {
            const all = JSON.parse(saved);
            if (all[modalidade]) {
              setData(all[modalidade]);
            }
          } catch (e) {
            console.error("Erro ao ler localStorage:", e);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [modalidade, eventID]);

  // Função auxiliar para calcular pontos de cada posição
  const getPts = (pos: number): number => {
    const num = Number(pos);
    const pontosConfig = data?.pontos || DEFAULT_PONTOS;
    if (num >= 1 && num <= 8) {
      // @ts-ignore
      return Number(pontosConfig[num]) || 0;
    }
    return 0;
  };

  // Calcula ranking das entidades (clube, equipe ou estado)
  const calcularRanking = (): EquipeRanking[] => {
    if (!data || !data.atletas) return [];
    
    const nomesEquipes: string[] = Array.from(new Set(data.atletas.map(a => a.equipe)));
    const FASES = ['m1', 'm2', 'm3', 'f32', 'f16', 'f8', 'qta', 'semi', 'final'];

    return nomesEquipes.map((nome: string) => {
      const pilotos = data.atletas.filter(a => a.equipe === nome);
      let total = 0;
      const contagem: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

      pilotos.forEach(p => {
        let participouNoCampeonato = false;
        
        FASES.forEach(f => {
          // @ts-ignore
          const pos = Number(p[f]);
          if (pos > 0) {
            participouNoCampeonato = true;
            total += getPts(pos);
            if (pos >= 1 && pos <= 8) {
              contagem[pos] = (contagem[pos] || 0) + 1;
            }
          }
        });

        if (participouNoCampeonato) {
          total += Number(data.pontos.participacao) || 0;
        }
      });

      return { nome, total, pilotos, contagem };
    }).sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      for (let i = 1; i <= 8; i++) {
        if ((b.contagem[i] || 0) !== (a.contagem[i] || 0)) {
          return (b.contagem[i] || 0) - (a.contagem[i] || 0);
        }
      }
      return 0;
    });
  };

  const rankingCompleto = calcularRanking();
  
  // Filtragem rápida
  const rankingFiltrado = rankingCompleto.filter(item => 
    item.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Divide o Top 3 para o pódio
  const top3 = rankingCompleto.slice(0, 3);
  // Reordena o Top 3 para exibição clássica do pódio: [2º, 1º, 3º]
  const podioExibicao = [];
  if (top3[1]) podioExibicao.push({ ...top3[1], posicao: 2 });
  if (top3[0]) podioExibicao.push({ ...top3[0], posicao: 1 });
  if (top3[2]) podioExibicao.push({ ...top3[2], posicao: 3 });

  const restoRanking = rankingFiltrado.slice(3);

  const getModalidadeIcon = () => {
    if (modalidade === 'clube') return <Building2 className="w-5 h-5 text-emerald-400" />;
    if (modalidade === 'estado') return <MapPin className="w-5 h-5 text-amber-400" />;
    return <Users className="w-5 h-5 text-blue-400" />;
  };

  const getTermoFormatado = () => {
    return data?.config.termo || modalidade.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase text-xs tracking-wider animate-pulse">Sincronizando com a Arena de BMX...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
      {/* CARD DO PLACAR AO VIVO */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 text-slate-950 p-3 rounded-2xl">
            {getModalidadeIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 uppercase flex items-center gap-1.5 tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                AO VIVO
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                SINC: REALTIME DATABASE
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter text-white uppercase font-display mt-1">
              RANKING POR {getTermoFormatado()}
            </h1>
            <p className="text-xs text-slate-400">Placar oficial do Campeonato Brasileiro de BMX 2026</p>
          </div>
        </div>

        {/* INFO DO EVENTO */}
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-2xl text-right">
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">EVENTO ATIVO:</span>
            <span className="font-mono text-sm font-black text-yellow-400 uppercase">
              {eventID ? eventID.toUpperCase() : 'LOCAL'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-4 py-3 rounded-2xl">
            <Clock className="w-4 h-4 text-yellow-400" />
            <div>
              <span className="text-[9px] font-bold text-slate-500 block leading-none">ÚLTIMA ATUALIZAÇÃO:</span>
              <span className="text-[10px] font-black text-slate-300 leading-none">AUTOMÁTICA</span>
            </div>
          </div>
        </div>
      </div>

      {/* PÓDIO PREMIUM ANIMADO */}
      {rankingCompleto.length > 0 && (
        <div className="mb-10">
          <div className="text-center mb-6">
            <h3 className="font-display font-black text-slate-400 text-xs uppercase tracking-wider flex items-center justify-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              LÍDERES DA COMPETIÇÃO
            </h3>
          </div>

          <div className="flex flex-col md:flex-row items-end justify-center gap-4 max-w-4xl mx-auto px-4">
            {podioExibicao.map((ent) => {
              const isFirst = ent.posicao === 1;
              const isSecond = ent.posicao === 2;
              const isThird = ent.posicao === 3;

              // Cores e tamanhos dependendo da posição
              let cardBg = "bg-slate-900 border-slate-800";
              let medalBg = "bg-slate-800 text-slate-300";
              let height = "h-48 md:h-56";
              let glowColor = "";

              if (isFirst) {
                cardBg = "bg-gradient-to-b from-yellow-950/40 to-slate-950 border-yellow-500/50 shadow-yellow-500/10";
                medalBg = "bg-yellow-500 text-slate-950 animate-bounce";
                height = "h-60 md:h-72 order-1 md:order-2 z-10 scale-[1.05]";
                glowColor = "shadow-[0_0_30px_rgba(234,179,8,0.15)]";
              } else if (isSecond) {
                cardBg = "bg-gradient-to-b from-slate-900/60 to-slate-950 border-slate-400/30";
                medalBg = "bg-slate-300 text-slate-950";
                height = "h-52 md:h-60 order-2 md:order-1";
              } else if (isThird) {
                cardBg = "bg-gradient-to-b from-amber-950/30 to-slate-950 border-amber-700/30";
                medalBg = "bg-amber-700 text-white";
                height = "h-44 md:h-48 order-3";
              }

              return (
                <motion.div
                  key={ent.nome}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: ent.posicao * 0.15 }}
                  className={`w-full md:w-1/3 rounded-[2.5rem] border p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl ${cardBg} ${height} ${glowColor}`}
                >
                  {/* BRILHO DE LUZ NO FUNDO DO PRIMEIRO LUGAR */}
                  {isFirst && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                  )}

                  {/* POSIÇÃO E MEDALHA */}
                  <div className="flex justify-between items-start">
                    <span className={`w-10 h-10 flex items-center justify-center rounded-2xl font-black font-display italic text-lg shadow-lg ${medalBg}`}>
                      {ent.posicao}º
                    </span>
                    <span className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-wider">
                      {ent.pilotos.length} pilotos
                    </span>
                  </div>

                  {/* INFO DA EQUIPE */}
                  <div className="mt-4 text-center">
                    <h4 className="font-display font-black text-lg text-white uppercase tracking-tight line-clamp-2 leading-tight">
                      {ent.nome}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">
                      {modalidade === 'estado' ? 'Estado' : modalidade === 'clube' ? 'Clube' : 'Equipe'}
                    </p>
                  </div>

                  {/* PONTOS DESTAQUE */}
                  <div className="mt-4 text-center border-t border-slate-800/60 pt-4">
                    <span className="text-3xl font-black font-mono text-yellow-400">
                      {ent.total}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest block uppercase mt-1">
                      Pontos Gerais
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* BUSCA E TABELA DO RESTO DO GRUPO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* BARRA DE PESQUISA */}
        <div className="bg-slate-950 p-4 border-b border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-4 h-4 text-yellow-500 animate-pulse" />
            <span className="font-bold uppercase tracking-wider">CLASSIFICAÇÃO GERAL DE BMX 2026</span>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 w-full sm:w-72 shadow-inner focus-within:border-yellow-500/50 transition">
            <Search className="w-4 h-4 text-slate-500 mr-2" />
            <input 
              type="text" 
              placeholder={`Buscar por ${getTermoFormatado()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white outline-none w-full placeholder:text-slate-600 font-bold"
            />
          </div>
        </div>

        {/* LISTA COMPLETA */}
        <div className="p-4 md:p-6 space-y-4">
          <AnimatePresence>
            {rankingCompleto.length > 0 ? (
              rankingFiltrado.map((ent, idx) => {
                const globalIndex = rankingCompleto.findIndex(x => x.nome === ent.nome);
                const isExpanded = expandedEquipe === ent.nome;

                return (
                  <motion.div
                    key={ent.nome}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isExpanded 
                        ? 'bg-slate-950 border-slate-700 shadow-xl' 
                        : 'bg-slate-950/50 hover:bg-slate-900 border-slate-850'
                    }`}
                  >
                    {/* BOTÃO EXPANDÍVEL DA LINHA DO RANKING */}
                    <button
                      onClick={() => setExpandedEquipe(isExpanded ? null : ent.nome)}
                      className="w-full text-left p-4 flex justify-between items-center gap-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 md:gap-5 min-w-0">
                        {/* POSIÇÃO */}
                        <span className={`w-8 h-8 flex items-center justify-center rounded-xl font-black font-display italic text-xs shrink-0 ${
                          globalIndex === 0 ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/20' :
                          globalIndex === 1 ? 'bg-slate-300 text-slate-950' :
                          globalIndex === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {globalIndex + 1}º
                        </span>

                        {/* DETALHE ENTIDADE */}
                        <div className="min-w-0">
                          <h4 className="font-black text-white text-sm md:text-base uppercase tracking-tight italic font-display truncate">
                            {ent.nome}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
                            {ent.pilotos.length} pilotos inscritos
                          </span>
                        </div>
                      </div>

                      {/* TOTAL E EXPANSÃO */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-xl md:text-2xl font-black font-mono text-yellow-400">
                            {ent.total}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-widest">
                            PONTOS
                          </span>
                        </div>
                        
                        <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </button>

                    {/* CONTEÚDO EXPANDIDO - DETALHAMENTO DE PILOTOS */}
                    {isExpanded && (
                      <div className="border-t border-slate-850 bg-slate-950/80 px-4 py-3">
                        <div className="mb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                          CONTRIBUIÇÃO DOS PILOTOS DESTA EQUIPE:
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-900">
                          <table className="w-full text-left text-[11px] font-sans">
                            <thead className="bg-slate-900 text-slate-500 font-bold uppercase text-[8px] tracking-wider border-b border-slate-850">
                              <tr>
                                <th className="p-2.5 pl-4">Piloto (Categoria)</th>
                                <th className="p-2.5 text-center">Motos</th>
                                <th className="p-2.5 text-center">Elims</th>
                                <th className="p-2.5 text-center">Final</th>
                                <th className="p-2.5 text-center">Part.</th>
                                <th className="p-2.5 text-right pr-4">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                              {ent.pilotos.map(p => {
                                const mPts = getPts(p.m1) + getPts(p.m2) + getPts(p.m3);
                                const fPts = getPts(p.f32) + getPts(p.f16) + getPts(p.f8) + getPts(p.qta) + getPts(p.semi);
                                const finalPts = getPts(p.final);
                                const extra = p.m1 > 0 || p.m2 > 0 || p.m3 > 0 || p.f32 > 0 || p.f16 > 0 || p.f8 > 0 || p.qta > 0 || p.semi > 0 || p.final > 0 ? (Number(data.pontos.participacao) || 0) : 0;
                                const totalPiloto = mPts + fPts + finalPts + extra;

                                return (
                                  <tr key={p.id} className="hover:bg-slate-900/30">
                                    <td className="p-2.5 pl-4 font-black text-slate-300 uppercase">
                                      {p.nome} <span className="text-[9px] text-yellow-500 font-bold italic ml-2">({p.cat})</span>
                                    </td>
                                    <td className="p-2.5 text-center font-mono font-medium text-slate-500">{mPts} pts</td>
                                    <td className="p-2.5 text-center font-mono font-medium text-slate-500">{fPts} pts</td>
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-300">{finalPts} pts</td>
                                    <td className="p-2.5 text-center font-mono font-medium text-slate-500">+{extra}</td>
                                    <td className="p-2.5 text-right pr-4 font-mono font-black text-blue-400">{totalPiloto} pts</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="bg-slate-950 p-10 rounded-2xl border border-slate-850 text-center">
                <p className="text-slate-600 text-xs font-bold">Nenhum piloto ou pontuação registrada nesta modalidade ainda.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
