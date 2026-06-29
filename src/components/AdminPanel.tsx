import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Database, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Lock, 
  Unlock, 
  Copy, 
  Check, 
  Award, 
  Flag, 
  Building, 
  Map, 
  FileDown, 
  Link2,
  RefreshCw
} from 'lucide-react';
import { CampeonatoData, Atleta, Modalidade, PontosConfig, EquipeRanking } from '../types';
import { salvarCampeonato, escutarCampeonato } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminPanelProps {
  eventID: string;
  setEventID: (id: string) => void;
  isOnline: boolean;
  setIsOnline: (on: boolean) => void;
}

const DEFAULT_PONTOS: PontosConfig = {
  1: 20,
  2: 18,
  3: 16,
  4: 14,
  5: 12,
  6: 10,
  7: 8,
  8: 6,
  participacao: 0
};

const DEFAULT_CATEGORIAS = [
  'BOYS 8', 'BOYS 9', 'BOYS 10', 'BOYS 11', 'BOYS 12', 'BOYS 13', 'BOYS 14', 'BOYS 15', 'BOYS 16',
  'MEN 17-24', 'MEN 25-29', 'MEN 30-39', 'MEN 40+',
  'GIRLS 8', 'GIRLS 10', 'GIRLS 12', 'GIRLS 14', 'GIRLS 16', 'WOMEN 17+',
  'CRUISER 30-39', 'CRUISER 40-49', 'CRUISER 50+',
  'JUNIOR MEN', 'JUNIOR WOMEN', 'ELITE MEN', 'ELITE WOMEN'
];

export default function AdminPanel({ eventID, setEventID, isOnline, setIsOnline }: AdminPanelProps) {
  // Modalidade ativa no admin
  const [modalidade, setModalidade] = useState<Modalidade>('equipe');
  const [activeTab, setActiveTab] = useState<'config' | 'registro' | 'competicao' | 'ranking'>('config');

  // Estados dos campeonatos carregados na memória
  const [campeonatos, setCampeonatos] = useState<Record<Modalidade, CampeonatoData>>({
    clube: {
      config: { termo: 'CLUBE', eventID: '', travado: false, modalidade: 'clube' },
      categorias: [...DEFAULT_CATEGORIAS],
      atletas: [],
      pontos: { ...DEFAULT_PONTOS }
    },
    equipe: {
      config: { termo: 'EQUIPE', eventID: '', travado: false, modalidade: 'equipe' },
      categorias: [...DEFAULT_CATEGORIAS],
      atletas: [],
      pontos: { ...DEFAULT_PONTOS }
    },
    estado: {
      config: { termo: 'ESTADO', eventID: '', travado: false, modalidade: 'estado' },
      categorias: [...DEFAULT_CATEGORIAS],
      atletas: [],
      pontos: { ...DEFAULT_PONTOS }
    }
  });

  // Função utilitária para garantir consistência e evitar que propriedades indefinidas vindas do Firebase crashem o app
  const sanitizeCampeonatoData = (incoming: any, mod: Modalidade): CampeonatoData => {
    const defaultTermos: Record<Modalidade, string> = {
      clube: 'CLUBE',
      equipe: 'EQUIPE',
      estado: 'ESTADO'
    };
    return {
      config: {
        termo: incoming?.config?.termo || defaultTermos[mod],
        eventID: incoming?.config?.eventID || '',
        travado: typeof incoming?.config?.travado === 'boolean' ? incoming.config.travado : false,
        modalidade: mod,
      },
      categorias: Array.isArray(incoming?.categorias) ? incoming.categorias : [...DEFAULT_CATEGORIAS],
      atletas: Array.isArray(incoming?.atletas) ? incoming.atletas : [],
      pontos: {
        ...DEFAULT_PONTOS,
        ...(incoming?.pontos || {})
      }
    };
  };

  // Carregar dados locais ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem(`bmx_championships_v1`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCampeonatos({
          clube: sanitizeCampeonatoData(parsed.clube, 'clube'),
          equipe: sanitizeCampeonatoData(parsed.equipe, 'equipe'),
          estado: sanitizeCampeonatoData(parsed.estado, 'estado')
        });
      } catch (e) {
        console.error("Erro ao ler do localStorage:", e);
      }
    }
  }, []);

  // Sincronizar com Firebase em tempo real se estiver online
  useEffect(() => {
    if (!isOnline || !eventID) return;

    // Escuta em tempo real cada uma das 3 modalidades com sanitização rigorosa contra crash
    const unsubclube = escutarCampeonato(eventID, 'clube', (data) => {
      if (data) {
        setCampeonatos(prev => ({ ...prev, clube: sanitizeCampeonatoData(data, 'clube') }));
      }
    });

    const unsubequipe = escutarCampeonato(eventID, 'equipe', (data) => {
      if (data) {
        setCampeonatos(prev => ({ ...prev, equipe: sanitizeCampeonatoData(data, 'equipe') }));
      }
    });

    const unsubestado = escutarCampeonato(eventID, 'estado', (data) => {
      if (data) {
        setCampeonatos(prev => ({ ...prev, estado: sanitizeCampeonatoData(data, 'estado') }));
      }
    });

    return () => {
      unsubclube();
      unsubequipe();
      unsubestado();
    };
  }, [isOnline, eventID]);

  // Função central otimizada: salva localmente e no Firebase (apenas a modalidade alterada para evitar conflito/concorrência)
  const saveState = async (updated: Record<Modalidade, CampeonatoData>, targetMod?: Modalidade) => {
    setCampeonatos(updated);
    localStorage.setItem(`bmx_championships_v1`, JSON.stringify(updated));

    if (isOnline && eventID) {
      try {
        if (targetMod) {
          // Otimização de concorrência: Grava APENAS o campeonato que foi de fato modificado
          await salvarCampeonato(eventID, targetMod, updated[targetMod]);
        } else {
          // Gravação geral (ex: restauração de backup completo)
          await salvarCampeonato(eventID, 'clube', updated.clube);
          await salvarCampeonato(eventID, 'equipe', updated.equipe);
          await salvarCampeonato(eventID, 'estado', updated.estado);
        }
      } catch (err) {
        console.error("Erro ao sincronizar com o Firebase:", err);
      }
    }
  };

  const currentData = campeonatos[modalidade];

  // Configuração específica da modalidade ativa
  const setTermo = (val: string) => {
    const next = { ...campeonatos };
    next[modalidade].config.termo = val;
    saveState(next, modalidade);
  };

  const toggleTrava = () => {
    const next = { ...campeonatos };
    next[modalidade].config.travado = !next[modalidade].config.travado;
    saveState(next, modalidade);
  };

  // Alterar tabela de pontuações
  const setPontoValue = (posicao: number, valor: number) => {
    const next = { ...campeonatos };
    next[modalidade].pontos[posicao] = valor;
    saveState(next, modalidade);
  };

  const setParticipacaoValue = (valor: number) => {
    const next = { ...campeonatos };
    next[modalidade].pontos.participacao = valor;
    saveState(next, modalidade);
  };

  // Funções de Backup (Exportar/Importar)
  const exportBackupCompleto = () => {
    const dataStr = JSON.stringify(campeonatos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup_completo_bmx_${eventID || 'campeonato'}_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBackupIndividual = () => {
    const dataStr = JSON.stringify(campeonatos[modalidade], null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup_${modalidade}_bmx_${eventID || 'campeonato'}_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Validação: Backup Completo (3 modalidades)
        if (parsed && typeof parsed === 'object' && ('clube' in parsed || 'equipe' in parsed || 'estado' in parsed)) {
          if (confirm("Este é um arquivo de backup completo (com as 3 modalidades). Isso substituirá todos os dados atuais locais e no banco de dados. Deseja continuar?")) {
            const newCampeonatos = {
              clube: sanitizeCampeonatoData(parsed.clube, 'clube'),
              equipe: sanitizeCampeonatoData(parsed.equipe, 'equipe'),
              estado: sanitizeCampeonatoData(parsed.estado, 'estado')
            };
            await saveState(newCampeonatos);
            alert("Backup completo importado com sucesso para todas as modalidades!");
          }
        } 
        // Validação: Backup Individual (única modalidade)
        else if (parsed && typeof parsed === 'object' && ('config' in parsed || 'categorias' in parsed || 'atletas' in parsed)) {
          if (confirm(`Este é um arquivo de backup individual. Deseja importar esses dados para a modalidade ativa atualmente (${modalidade.toUpperCase()})?`)) {
            const next = { ...campeonatos };
            next[modalidade] = sanitizeCampeonatoData(parsed, modalidade);
            await saveState(next, modalidade);
            alert(`Backup importado com sucesso para a modalidade ${modalidade.toUpperCase()}!`);
          }
        } else {
          alert("Formato de arquivo de backup inválido. Certifique-se de carregar um arquivo de backup .json gerado por este sistema.");
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao ler o arquivo de backup. Certifique-se de que é um arquivo JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reseta o input
  };

  // Manipulação de Categorias
  const [novaCat, setNovaCat] = useState('');
  const addCategoria = () => {
    const clean = novaCat.trim().toUpperCase();
    if (!clean) return;
    if (currentData.categorias.includes(clean)) {
      alert("Esta categoria já existe!");
      return;
    }
    const next = { ...campeonatos };
    next[modalidade].categorias.push(clean);
    saveState(next, modalidade);
    setNovaCat('');
  };

  const removeCategoria = (catName: string) => {
    if (confirm(`Tem certeza que deseja remover a categoria "${catName}"?`)) {
      const next = { ...campeonatos };
      next[modalidade].categorias = next[modalidade].categorias.filter(c => c !== catName);
      saveState(next, modalidade);
    }
  };

  const reordenarCat = (idx: number, direcao: number) => {
    if (idx + direcao < 0 || idx + direcao >= currentData.categorias.length) return;
    const next = { ...campeonatos };
    const arr = next[modalidade].categorias;
    const temp = arr[idx];
    arr[idx] = arr[idx + direcao];
    arr[idx + direcao] = temp;
    saveState(next, modalidade);
  };

  // Cadastro de Pilotos / Inscrição
  const [atletaNome, setAtletaNome] = useState('');
  const [atletaCat, setAtletaCat] = useState(currentData.categorias[0] || '');
  const [atletaPlaca, setAtletaPlaca] = useState('');
  const [atletaEquipe, setAtletaEquipe] = useState('');

  // Sincronizar categoria padrão ao mudar de aba/modalidade
  useEffect(() => {
    if (currentData.categorias.length > 0) {
      setAtletaCat(currentData.categorias[0]);
    } else {
      setAtletaCat('');
    }
  }, [modalidade, currentData.categorias]);

  const addAtleta = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentData.config.travado) {
      alert("Inscrições travadas para este campeonato!");
      return;
    }
    const nomeClean = atletaNome.trim().toUpperCase();
    const placaClean = atletaPlaca.trim().toUpperCase();
    const equipeClean = atletaEquipe.trim().toUpperCase();
    const catSelected = atletaCat;

    if (!nomeClean || !equipeClean || !catSelected) {
      alert("Por favor, preencha o Nome, Equipe/Clube/Estado e escolha a Categoria.");
      return;
    }

    const novoAtleta: Atleta = {
      id: Date.now(),
      nome: nomeClean,
      cat: catSelected,
      placa: placaClean || 'S/N',
      equipe: equipeClean,
      m1: 0, m2: 0, m3: 0, f32: 0, f16: 0, f8: 0, qta: 0, semi: 0, final: 0
    };

    const next = { ...campeonatos };
    next[modalidade].atletas.push(novoAtleta);
    saveState(next, modalidade);

    // Reset formulário
    setAtletaNome('');
    setAtletaPlaca('');
  };

  const deletarAtleta = (id: number) => {
    if (confirm("Deseja realmente excluir este piloto do campeonato?")) {
      const next = { ...campeonatos };
      next[modalidade].atletas = next[modalidade].atletas.filter(a => a.id !== id);
      saveState(next, modalidade);
    }
  };

  // Atualizar pontos/posições do atleta nas fases
  const updateAtletaFase = (atletaId: number, fase: string, posicao: number) => {
    const next = { ...campeonatos };
    const atleta = next[modalidade].atletas.find(a => a.id === atletaId);
    if (atleta) {
      // @ts-ignore
      atleta[fase] = posicao;
      saveState(next, modalidade);
    }
  };

  // Cálculo das pontuações do campeonato ativo
  const getPts = (pos: number): number => {
    const num = Number(pos);
    if (num >= 1 && num <= 8) {
      return Number(currentData.pontos[num]) || 0;
    }
    return 0;
  };

  const calcularRanking = (): EquipeRanking[] => {
    const nomesEquipes: string[] = Array.from(new Set(currentData.atletas.map(a => a.equipe)));
    const FASES = ['m1', 'm2', 'm3', 'f32', 'f16', 'f8', 'qta', 'semi', 'final'];

    return nomesEquipes.map((nome: string) => {
      const pilotos = currentData.atletas.filter(a => a.equipe === nome);
      let total = 0;
      const contagem: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

      pilotos.forEach(p => {
        FASES.forEach(f => {
          // @ts-ignore
          const pos = Number(p[f]);
          if (pos > 0) {
            total += getPts(pos);
            if (pos >= 1 && pos <= 8) {
              contagem[pos] = (contagem[pos] || 0) + 1;
            }
          }
        });
      });

      return { nome, total, pilotos, contagem };
    }).sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      // Critério de desempate: mais 1ºs lugares, depois mais 2ºs, etc.
      for (let i = 1; i <= 8; i++) {
        if ((b.contagem[i] || 0) !== (a.contagem[i] || 0)) {
          return (b.contagem[i] || 0) - (a.contagem[i] || 0);
        }
      }
      return 0;
    });
  };

  // Backup e Restauração de Arquivos JSON
  const exportarJSON = () => {
    const blob = new Blob([JSON.stringify(campeonatos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_bmx_live_${eventID || 'evento'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        // Validar levemente
        if (parsed.clube && parsed.equipe && parsed.estado) {
          saveState(parsed);
          alert("Backup restaurado com sucesso para todas as modalidades!");
        } else {
          alert("Formato de arquivo inválido para backup BMX.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup: " + err);
      }
    };
    reader.readAsText(file);
  };

  // Link ao vivo
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const getSpectatorLink = (mod: Modalidade) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?view=${mod}&event=${eventID || 'default'}`;
  };

  const handleCopyLink = (mod: Modalidade) => {
    const link = getSpectatorLink(mod);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(mod);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  // Geração de PDF oficial por modalidade ativa
  const gerarPDFOficial = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const ranking = calcularRanking();
    
    // Cores oficiais do Campeonato (Estilo Verde-Azul Bandeira)
    const primaryColor = [0, 75, 147]; // Azul CBC
    const accentColor = [0, 143, 57]; // Verde CBC

    // Cabeçalho
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CAMPEONATO BRASILEIRO DE BMX 2026", 105, 12, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`RESULTADOS EM TEMPO REAL POR ${currentData.config.termo}`, 105, 19, { align: "center" });
    doc.setFontSize(9);
    doc.text(`ID Evento: ${eventID ? eventID.toUpperCase() : 'LOCAL'} | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 26, { align: "center" });
    
    let currentY = 40;

    ranking.forEach((ent, index) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }

      // Título da Equipe/Clube/Estado
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 8, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${index + 1}º LUGAR: ${ent.nome.toUpperCase()}`, 18, currentY + 5.5);
      
      doc.setFontSize(11);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(`${ent.total} PTS`, 190, currentY + 5.5, { align: "right" });

      currentY += 10;

      // Pilotos da entidade
      const rows = ent.pilotos.map(p => {
        const mPts = getPts(p.m1) + getPts(p.m2) + getPts(p.m3);
        const fPts = getPts(p.f32) + getPts(p.f16) + getPts(p.f8) + getPts(p.qta) + getPts(p.semi);
        const finalPts = getPts(p.final);
        const totalP = mPts + fPts + finalPts;

        return [
          `${p.nome} (${p.cat})`,
          p.placa,
          `${mPts} pts`,
          `${fPts} pts`,
          `${finalPts} pts`,
          `${totalP} pts`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        margin: { left: 15, right: 15 },
        head: [['Atleta (Categoria)', 'Placa', 'Motos', 'Eliminatórias', 'Final', 'Subtotal']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 23, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    doc.save(`bmx_live_${modalidade}_${eventID || 'campeonato'}.pdf`);
  };

  const handleConectar = () => {
    const cleanID = eventID.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanID) {
      alert("Por favor, digite um ID para o evento (somente letras, números, hifens ou sublinhas).");
      return;
    }
    setEventID(cleanID);
    setIsOnline(true);
    alert(`Conectado com sucesso! Sincronizando o evento "${cleanID.toUpperCase()}" com o Firebase.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* HEADER DE COMANDO */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 text-slate-950 p-2.5 rounded-2xl">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black italic tracking-tight font-display text-white">BMX LIVE PRO <span className="text-yellow-400 font-medium text-sm not-italic font-sans">v2.0 (ADMIN)</span></h1>
            <p className="text-xs text-slate-400">Controle simultâneo e em tempo real dos campeonatos</p>
          </div>
        </div>

        {/* INPUT ONLINE */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 shadow-inner">
            <span className="text-[10px] font-bold text-slate-500 mr-2 uppercase">ID EVENTO:</span>
            <input 
              type="text" 
              value={eventID}
              onChange={(e) => setEventID(e.target.value)}
              placeholder="ex: brasileiro2026"
              className="bg-transparent text-sm font-black text-yellow-400 uppercase outline-none w-36 placeholder:text-slate-700"
            />
          </div>

          {!isOnline ? (
            <button 
              onClick={handleConectar}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-red-950 transition-all uppercase flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              Conectar Online 📡
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 px-4 py-2 rounded-2xl text-xs font-bold uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Sincronizado ✅
            </div>
          )}

          {/* BACKUP & RESTAURAR */}
          <button 
            onClick={exportarJSON}
            title="Salvar arquivo de backup no computador"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-2xl transition border border-slate-700"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <label 
            title="Restaurar backup do computador"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-2xl transition cursor-pointer border border-slate-700"
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" onChange={importarJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* SELECTOR DE MODALIDADE SIMULTÂNEA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button 
          onClick={() => { setModalidade('equipe'); }}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer ${
            modalidade === 'equipe' 
              ? 'bg-gradient-to-r from-emerald-950 to-emerald-900/60 border-emerald-500 shadow-lg text-white scale-[1.02] shadow-emerald-950/40' 
              : 'bg-slate-900 border-slate-850 hover:bg-slate-850 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${modalidade === 'equipe' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-500'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Modalidade</span>
              <h4 className="font-bold text-sm text-white">Campeonato por EQUIPE</h4>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-950/50 px-2.5 py-1 rounded-lg text-emerald-400">
            {campeonatos.equipe.atletas.length} Atletas
          </span>
        </button>

        <button 
          onClick={() => { setModalidade('clube'); }}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer ${
            modalidade === 'clube' 
              ? 'bg-gradient-to-r from-yellow-950 to-yellow-900/40 border-yellow-500 shadow-lg text-white scale-[1.02] shadow-yellow-950/40' 
              : 'bg-slate-900 border-slate-850 hover:bg-slate-850 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${modalidade === 'clube' ? 'bg-yellow-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-500'}`}>
              <Building className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Modalidade</span>
              <h4 className="font-bold text-sm text-white">Campeonato por CLUBE</h4>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-950/50 px-2.5 py-1 rounded-lg text-yellow-400">
            {campeonatos.clube.atletas.length} Atletas
          </span>
        </button>

        <button 
          onClick={() => { setModalidade('estado'); }}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer ${
            modalidade === 'estado' 
              ? 'bg-gradient-to-r from-blue-950 to-blue-900/60 border-blue-500 shadow-lg text-white scale-[1.02] shadow-blue-950/40' 
              : 'bg-slate-900 border-slate-850 hover:bg-slate-850 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${modalidade === 'estado' ? 'bg-blue-500 text-white' : 'bg-slate-950 text-slate-500'}`}>
              <Map className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Modalidade</span>
              <h4 className="font-bold text-sm text-white">Campeonato por ESTADO</h4>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-950/50 px-2.5 py-1 rounded-lg text-blue-400">
            {campeonatos.estado.atletas.length} Atletas
          </span>
        </button>
      </div>

      {/* PAINEL DE LINKS DE TRANSMISSÃO EM TEMPO REAL */}
      <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl mb-6">
        <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5 mb-3 font-display">
          <Link2 className="w-4 h-4 text-emerald-500" />
          Links de Transmissão ao Vivo para Espectadores (Direcionados):
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(['equipe', 'clube', 'estado'] as Modalidade[]).map((mod) => (
            <div key={mod} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
              <div className="overflow-hidden mr-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  {mod === 'equipe' ? '🚗 LINK EQUIPES' : mod === 'clube' ? '🏢 LINK CLUBES' : '🗺️ LINK ESTADOS'}
                </span>
                <span className="text-xs font-mono text-slate-300 block truncate select-all">
                  {getSpectatorLink(mod)}
                </span>
              </div>
              <button 
                onClick={() => handleCopyLink(mod)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition shrink-0 cursor-pointer"
              >
                {copiedLink === mod ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ABAS DA MODALIDADE SELECIONADA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex border-b border-slate-800 overflow-x-auto bg-slate-900/80 sticky top-0 z-10 scrollbar-none">
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 text-center whitespace-nowrap transition cursor-pointer ${
              activeTab === 'config' ? 'border-emerald-500 text-emerald-400 bg-slate-850/40' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            1. CONFIG ({currentData.config.termo})
          </button>
          <button 
            onClick={() => setActiveTab('registro')}
            className={`flex-1 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 text-center whitespace-nowrap transition cursor-pointer ${
              activeTab === 'registro' ? 'border-yellow-500 text-yellow-400 bg-slate-850/40' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            2. INSCRIÇÃO ({currentData.atletas.length})
          </button>
          <button 
            onClick={() => setActiveTab('competicao')}
            className={`flex-1 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 text-center whitespace-nowrap transition cursor-pointer ${
              activeTab === 'competicao' ? 'border-blue-500 text-blue-400 bg-slate-850/40' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            3. LANÇAMENTOS
          </button>
          <button 
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 text-center whitespace-nowrap transition cursor-pointer ${
              activeTab === 'ranking' ? 'border-yellow-500 text-yellow-400 bg-slate-850/40 animate-pulse' : 'border-transparent text-yellow-400/85 hover:text-yellow-400'
            }`}
          >
            4. RESULTADOS AO VIVO
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-slate-950/20">
          {/* ABA 1: CONFIGURAÇÃO */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* COLUNA 1: CONFIGURAÇÃO & BACKUP */}
              <div className="space-y-6">
                {/* TERMINOLOGIA E PONTOS */}
                <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-white italic uppercase text-sm mb-4 font-display flex items-center gap-2">
                      <Flag className="text-emerald-500 w-4 h-4" />
                      Terminologia do Campeonato
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Escolha como quer chamar a entidade principal neste campeonato específico:</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {['EQUIPE', 'CLUBE', 'ESTADO', 'DELEGAÇÃO'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setTermo(t)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase cursor-pointer transition ${
                            currentData.config.termo === t 
                              ? 'bg-gradient-to-r from-emerald-600 to-yellow-500 text-white' 
                              : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-800'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <h3 className="font-black text-white italic uppercase text-sm mb-4 font-display flex items-center gap-2 border-t border-slate-800 pt-5">
                      <Award className="text-yellow-500 w-4 h-4" />
                      Tabela de Pontos por Posição na Final
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Modifique os pontos atribuídos aos pilotos conforme as posições finais:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{i}º LUGAR</label>
                          <input 
                            type="number" 
                            value={currentData.pontos[i] || 0}
                            onChange={(e) => setPontoValue(i, Number(e.target.value))}
                            className="bg-transparent text-sm font-black text-yellow-400 text-center w-full outline-none font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SEGURANÇA E BACKUPS */}
                <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-850">
                  <h3 className="font-black text-white italic uppercase text-sm mb-4 font-display flex items-center gap-2">
                    <Database className="text-emerald-500 w-4 h-4" />
                    Cópia de Segurança & Restauração (Backup)
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Garante integridade e proteção máxima para eventos nacionais. Salve cópias de segurança de rotina locais em formato JSON e restaure-as a qualquer momento.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <button 
                      onClick={exportBackupIndividual}
                      className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-500" />
                      Backup ({modalidade.toUpperCase()})
                    </button>
                    <button 
                      onClick={exportBackupCompleto}
                      className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      Backup Geral (Completo)
                    </button>
                  </div>

                  <div className="border-t border-slate-800/60 pt-4">
                    <label className="text-xs font-bold text-slate-400 block mb-2">Importar arquivo de Backup (.json)</label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 bg-slate-950 border border-slate-800 hover:border-yellow-500 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-2 transition cursor-pointer">
                        <Upload className="w-4 h-4 text-yellow-500" />
                        <span>Selecionar Arquivo JSON</span>
                        <input 
                          type="file" 
                          accept=".json"
                          onChange={handleImportBackup}
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* ORDEM DAS CATEGORIAS */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-850">
                <h3 className="font-black text-white italic uppercase text-sm mb-4 font-display flex items-center gap-2">
                  <Users className="text-yellow-500 w-4 h-4" />
                  Ordem de Categorias do Evento
                </h3>
                <p className="text-xs text-slate-400 mb-4">Cadastre ou organize as categorias oficiais para lançamento das baterias:</p>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="NOVA CATEGORIA"
                    value={novaCat}
                    onChange={(e) => setNovaCat(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategoria()}
                    className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-bold uppercase text-white outline-none focus:border-yellow-500"
                  />
                  <button 
                    onClick={addCategoria}
                    className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-5 rounded-xl font-black text-xs uppercase shadow transition cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 bg-slate-950/40 p-2 rounded-xl border border-slate-850">
                  {currentData.categorias.map((c, i) => (
                    <div key={c} className="flex justify-between items-center bg-slate-950/80 px-3 py-2 border border-slate-850 rounded-xl text-xs font-bold text-slate-300">
                      <span className="font-mono text-slate-500">#{i+1} <span className="text-white font-sans uppercase font-bold ml-1.5">{c}</span></span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => reordenarCat(i, -1)}
                          disabled={i === 0}
                          className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          ⬆️
                        </button>
                        <button 
                          onClick={() => reordenarCat(i, 1)}
                          disabled={i === currentData.categorias.length - 1}
                          className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          ⬇️
                        </button>
                        <button 
                          onClick={() => removeCategoria(c)}
                          className="text-red-500 hover:text-red-400 ml-1 font-black cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {currentData.categorias.length === 0 && (
                    <p className="text-center text-xs text-slate-600 py-6">Nenhuma categoria cadastrada.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: INSCRIÇÃO DE ATLETAS */}
          {activeTab === 'registro' && (
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-850">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="font-black text-white italic uppercase text-sm font-display flex items-center gap-2">
                    <Users className="text-yellow-500 w-4 h-4" />
                    Inscrição e Cadastro de Pilotos
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Preencha os dados dos pilotos que participarão do campeonato</p>
                </div>
                
                <button 
                  onClick={toggleTrava}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow transition duration-300 cursor-pointer ${
                    currentData.config.travado 
                      ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {currentData.config.travado ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Inscrições Fechadas 🔒
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-400" />
                      Inscrições Abertas 🔓
                    </>
                  )}
                </button>
              </div>

              {/* FORMULÁRIO DE INSCRIÇÃO */}
              {!currentData.config.travado ? (
                <form onSubmit={addAtleta} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-5 rounded-2xl border border-slate-850 mb-6">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Nome Completo do Atleta</label>
                    <input 
                      type="text" 
                      placeholder="NOME DO PILOTO" 
                      value={atletaNome}
                      onChange={(e) => setAtletaNome(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold uppercase text-white outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Categoria</label>
                    <select 
                      value={atletaCat}
                      onChange={(e) => setAtletaCat(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold uppercase text-white outline-none focus:border-yellow-500"
                    >
                      <option value="">Selecione...</option>
                      {currentData.categorias.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Placa (Ex: #350)</label>
                    <input 
                      type="text" 
                      placeholder="PLACA" 
                      value={atletaPlaca}
                      onChange={(e) => setAtletaPlaca(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold uppercase text-white outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Nome do(a) {currentData.config.termo}</label>
                    <input 
                      type="text" 
                      placeholder={`DIGITE O ${currentData.config.termo}`} 
                      value={atletaEquipe}
                      onChange={(e) => setAtletaEquipe(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold uppercase text-white outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div className="md:col-span-4 mt-2">
                    <button 
                      type="submit" 
                      className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black py-3 rounded-xl shadow uppercase tracking-wide text-xs transition cursor-pointer"
                    >
                      Cadastrar Atleta no Campeonato
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-xl text-center mb-6">
                  <p className="text-xs text-rose-300 font-bold">As inscrições foram travadas pela administração. Desbloqueie acima se precisar adicionar novos pilotos.</p>
                </div>
              )}

              {/* LISTA DE ATLETAS */}
              <div className="overflow-x-auto rounded-xl border border-slate-850">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-black font-display text-[10px]">
                    <tr>
                      <th className="p-4">Piloto</th>
                      <th className="p-4">Categoria</th>
                      <th className="p-4">{currentData.config.termo}</th>
                      <th className="p-4 text-center">Placa</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {currentData.atletas.map(a => (
                      <tr key={a.id} className="hover:bg-slate-900/50">
                        <td className="p-4 font-black text-white uppercase">{a.nome}</td>
                        <td className="p-4 text-yellow-400 italic font-bold">{a.cat}</td>
                        <td className="p-4 text-slate-300 uppercase font-medium">{a.equipe}</td>
                        <td className="p-4 text-center font-mono font-bold text-slate-400">{a.placa}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => deletarAtleta(a.id)}
                            className="bg-red-950 hover:bg-red-900 border border-red-900/60 text-red-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {currentData.atletas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-slate-500 py-10">Nenhum atleta inscrito neste campeonato.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: LANÇAMENTO DE RESULTADOS */}
          {activeTab === 'competicao' && (
            <div className="space-y-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-850">
                <h3 className="font-black text-white italic uppercase text-sm font-display flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="text-yellow-500 w-4 h-4" />
                  Painel de Lançamento de Posições
                </h3>
                <p className="text-xs text-slate-400">
                  Insira a posição obtida por cada piloto (de 1º a 8º colocado) em cada bateria. Os pontos serão gerados automaticamente na tabela com base nas suas configurações de pontos. Deixe em branco se a bateria ainda não ocorreu.
                </p>
              </div>

              {/* CATEGORIAS EM ACCORDION / CARTÕES */}
              <div className="space-y-4">
                {currentData.categorias.map((cat, idx) => {
                  const pilotos = currentData.atletas.filter(p => p.cat === cat);
                  if (pilotos.length === 0) return null;

                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow">
                      {/* HEADER CATEGORIA */}
                      <div className="bg-slate-950 px-5 py-4 border-b border-slate-850 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="bg-yellow-500 text-slate-950 w-6 h-6 flex items-center justify-center rounded-lg font-black font-mono text-[11px]">
                            {idx + 1}
                          </span>
                          <h3 className="font-black text-white uppercase italic text-sm font-display">{cat}</h3>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800 text-slate-400">
                          {pilotos.length} Pilotos Registrados
                        </span>
                      </div>

                      {/* GRID DE LANÇAMENTO */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-xs">
                          <thead className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[9px] tracking-wider border-b border-slate-850">
                            <tr>
                              <th className="p-3 text-left pl-5">Piloto ({currentData.config.termo})</th>
                              <th className="p-3">Moto 1</th>
                              <th className="p-3">Moto 2</th>
                              <th className="p-3">Moto 3</th>
                              <th className="p-3 text-indigo-400">32ª</th>
                              <th className="p-3 text-indigo-400">16ª</th>
                              <th className="p-3 text-indigo-400">8ª</th>
                              <th className="p-3 text-amber-500">4ª</th>
                              <th className="p-3 text-amber-500">Semi</th>
                              <th className="p-3 bg-yellow-500/10 text-yellow-400 font-bold">FINAL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {pilotos.map(p => (
                              <tr key={p.id} className="hover:bg-slate-850/30">
                                <td className="p-3 text-left pl-5">
                                  <div className="font-black text-white uppercase text-xs leading-none">{p.nome}</div>
                                  <div className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                                    Placa: <span className="font-mono text-yellow-400">{p.placa}</span> | {p.equipe}
                                  </div>
                                </td>
                                
                                {/* FASES INPUTS */}
                                {['m1', 'm2', 'm3', 'f32', 'f16', 'f8', 'qta', 'semi', 'final'].map((fase) => {
                                  // @ts-ignore
                                  const val = p[fase] || '';
                                  const isFinal = fase === 'final';

                                  return (
                                    <td key={fase} className={`p-2 ${isFinal ? 'bg-yellow-500/5' : ''}`}>
                                      <input 
                                        type="number" 
                                        min="1" 
                                        max="8"
                                        placeholder="-"
                                        value={val}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          // Validar de 1 a 8
                                          const cleanVal = (v >= 1 && v <= 8) ? v : 0;
                                          updateAtletaFase(p.id, fase, cleanVal);
                                        }}
                                        className={`w-10 bg-slate-950 text-xs font-black text-center p-2 rounded-lg border focus:outline-none focus:border-yellow-500 font-mono ${
                                          val ? 'text-yellow-400 border-yellow-500/55 bg-yellow-950/20' : 'text-slate-600 border-slate-800'
                                        } ${isFinal ? 'ring-1 ring-yellow-500/30' : ''}`}
                                      />
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
                })}

                {currentData.atletas.length === 0 && (
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-10 text-center">
                    <p className="text-slate-500 text-xs font-bold">Por favor, cadastre os pilotos e organize as categorias na aba "INSCRIÇÃO" para carregar as baterias.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 4: RANKING PREVIEW */}
          {activeTab === 'ranking' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-5 rounded-3xl border border-slate-850 mb-6">
                <div>
                  <h3 className="font-black text-white italic uppercase text-sm font-display flex items-center gap-2">
                    <Award className="text-yellow-500 w-4 h-4 animate-bounce" />
                    Visualização de Tabela de Resultados
                  </h3>
                  <p className="text-xs text-slate-400">Classificação atualizada em tempo real conforme as pontuações e regras</p>
                </div>

                <button 
                  onClick={gerarPDFOficial}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg transition-all uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  Gerar PDF Oficial (PDF)
                </button>
              </div>

              {/* RESULTADO DAS ENTIDADES */}
              <div className="space-y-6">
                {calcularRanking().map((ent, idx) => (
                  <div key={ent.nome} className="bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl border-b-4 border-yellow-500">
                    {/* BARRA DA CLASSIFICAÇÃO */}
                    <div className="bg-slate-950 px-5 py-4 border-b border-slate-850 flex justify-between items-center flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 flex items-center justify-center rounded-xl font-black font-display italic text-sm shadow ${
                          idx === 0 ? 'bg-yellow-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}º
                        </span>
                        <h4 className="font-black text-base text-white uppercase tracking-tight italic font-display">{ent.nome}</h4>
                      </div>
                      
                      <div className="text-right font-mono font-black text-2xl text-yellow-400">
                        {ent.total} <span className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider ml-1">PTS</span>
                      </div>
                    </div>

                    {/* PILOTOS RESPONSÁVEIS PELA PONTUAÇÃO */}
                    <div className="overflow-x-auto bg-slate-950/20">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/40 text-slate-500 uppercase font-bold text-[9px] tracking-wider border-b border-slate-850">
                          <tr>
                            <th className="p-3 pl-5">Piloto (Categoria)</th>
                            <th className="p-3 text-center">Motos</th>
                            <th className="p-3 text-center">Eliminatórias</th>
                            <th className="p-3 text-center">Final</th>
                            <th className="p-3 text-right pr-5">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {ent.pilotos.map(p => {
                            const mPts = getPts(p.m1) + getPts(p.m2) + getPts(p.m3);
                            const fPts = getPts(p.f32) + getPts(p.f16) + getPts(p.f8) + getPts(p.qta) + getPts(p.semi);
                            const finalPts = getPts(p.final);
                            const totalPiloto = mPts + fPts + finalPts;

                            return (
                              <tr key={p.id} className="hover:bg-slate-900/30">
                                <td className="p-3 pl-5 font-black text-slate-300 uppercase">
                                  {p.nome} <span className="text-[9px] text-yellow-500 font-bold italic ml-2">({p.cat})</span>
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-slate-400">{mPts} pts</td>
                                <td className="p-3 text-center font-mono font-bold text-slate-400">{fPts} pts</td>
                                <td className="p-3 text-center font-mono font-bold text-slate-200">{finalPts} pts</td>
                                <td className="p-3 text-right pr-5 font-mono font-black text-blue-400 text-[13px]">{totalPiloto} pts</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {currentData.atletas.length === 0 && (
                  <div className="bg-slate-900 border border-slate-850 rounded-3xl p-10 text-center">
                    <p className="text-slate-500 text-xs font-bold">Nenhum dado calculado de pontuação disponível no momento.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
