export type Modalidade = 'clube' | 'equipe' | 'estado';

export interface Atleta {
  id: number;
  nome: string;
  cat: string;
  placa: string;
  equipe: string; // Representa o Clube, Equipe ou Estado/Delegação
  m1: number;
  m2: number;
  m3: number;
  f32: number;
  f16: number;
  f8: number;
  qta: number;
  semi: number;
  final: number;
}

export interface PontosConfig {
  [posicao: number]: number;
  participacao: number;
}

export interface CampeonatoData {
  config: {
    termo: string; // Ex: 'CLUBE', 'EQUIPE', 'ESTADO'
    eventID: string;
    travado: boolean;
    modalidade: Modalidade;
  };
  categorias: string[];
  atletas: Atleta[];
  pontos: PontosConfig;
}

export interface EquipeRanking {
  nome: string;
  total: number;
  pilotos: Atleta[];
  contagem: { [posicao: number]: number };
}
