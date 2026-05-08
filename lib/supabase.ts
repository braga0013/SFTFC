import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Usuario = {
  id: string;
  nome: string;
  numero_camisa: number | null;
  posicao: string | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Partida = {
  id: string;
  data: string;
  hora: string;
  local: string;
  valor_individual: number | null;
  time_branco: string[];
  time_preto: string[];
  gols_branco: number | null;
  gols_preto: number | null;
  resultado: 'branco' | 'preto' | 'empate' | null;
  criado_por: string;
  created_at: string;
};

export type Votacao = {
  id: string;
  partida_id: string;
  votante_id: string;
  jogador_id: string;
  estrelas: number;
  created_at: string;
};
