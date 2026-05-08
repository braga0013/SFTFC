import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from './lib/supabase';
import type { Usuario } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

const COLORS = {
  bg: '#111111',
  bgCard: '#1a1a1a',
  bgCard2: '#222222',
  border: '#2e2e2e',
  white: '#FFFFFF',
  gray: '#888888',
  grayLight: '#cccccc',
  blue: '#3B6FE0',
  red: '#D93030',
  green: '#22c55e',
  yellow: '#f59e0b',
};

const POSITIONS = ['CA', 'PE', 'PD', 'MEI', 'MC', 'VOL', 'ZAG', 'LD', 'LE', 'GL'];

// ─── Dados Mockup ────────────────────────────────────────────────
type MatchResult = 'W' | 'D' | 'L';

interface Match {
  id: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  playerGoals: number;
  result: MatchResult;
}

const MOCK_MATCHES: Match[] = [
  { id: '1',  date: '20 ABR 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'Rival City FC',   homeScore: 3, awayScore: 1, competition: 'Liga Principal', playerGoals: 2, result: 'W' },
  { id: '2',  date: '14 ABR 2026', homeTeam: 'FC Dragões',       awayTeam: 'S.F.T.F.C.',      homeScore: 0, awayScore: 0, competition: 'Copa Regional',   playerGoals: 0, result: 'D' },
  { id: '3',  date: '07 ABR 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'União Futebol',    homeScore: 4, awayScore: 2, competition: 'Liga Principal', playerGoals: 1, result: 'W' },
  { id: '4',  date: '01 ABR 2026', homeTeam: 'Atletico Norte',   awayTeam: 'S.F.T.F.C.',      homeScore: 2, awayScore: 1, competition: 'Liga Principal', playerGoals: 1, result: 'L' },
  { id: '5',  date: '25 MAR 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'Sport Bravos',     homeScore: 2, awayScore: 0, competition: 'Copa Regional',   playerGoals: 0, result: 'W' },
  { id: '6',  date: '18 MAR 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'FC Estrelas',      homeScore: 1, awayScore: 1, competition: 'Liga Principal', playerGoals: 1, result: 'D' },
  { id: '7',  date: '11 MAR 2026', homeTeam: 'Ventos FC',        awayTeam: 'S.F.T.F.C.',      homeScore: 0, awayScore: 3, competition: 'Liga Principal', playerGoals: 2, result: 'W' },
  { id: '8',  date: '04 MAR 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'Real Galáxia',     homeScore: 2, awayScore: 1, competition: 'Copa Regional',   playerGoals: 1, result: 'W' },
  { id: '9',  date: '25 FEV 2026', homeTeam: 'Desportivo Sul',   awayTeam: 'S.F.T.F.C.',      homeScore: 3, awayScore: 0, competition: 'Liga Principal', playerGoals: 0, result: 'L' },
  { id: '10', date: '18 FEV 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'Clube Nortenho',   homeScore: 5, awayScore: 1, competition: 'Liga Principal', playerGoals: 3, result: 'W' },
  { id: '11', date: '11 FEV 2026', homeTeam: 'S.F.T.F.C.',      awayTeam: 'FC Montanha',      homeScore: 1, awayScore: 0, competition: 'Copa Regional',   playerGoals: 0, result: 'W' },
  { id: '12', date: '04 FEV 2026', homeTeam: 'Águias SC',        awayTeam: 'S.F.T.F.C.',      homeScore: 2, awayScore: 2, competition: 'Liga Principal', playerGoals: 1, result: 'D' },
];

// ─── Card de Jogador (FIFA Style) ───────────────────────────────
type CardType = 'bronze' | 'silver' | 'gold' | 'special' | 'diamond';

interface CardData {
  rating: number;
  position: string;
  country: string;
  club: string;
  name: string;
  vel: number;
  chu: number;
  pas: number;
  def: number;
}

const CARD_THEMES: Record<CardType, { primary: string; secondary: string; banner: string; textDark: string }> = {
  bronze:  { primary: '#181818', secondary: '#3a3a3a', banner: '#0e0e0e', textDark: '#FFFFFF' },
  silver:  { primary: '#1e1e1e', secondary: '#3d3d3d', banner: '#131313', textDark: '#FFFFFF' },
  gold:    { primary: '#C9A227', secondary: '#8B6910', banner: '#7A5A08', textDark: '#3D2B00' },
  special: { primary: '#2B6CB8', secondary: '#1A3F72', banner: '#12305A', textDark: '#FFFFFF' },
  diamond: { primary: '#1e1e1e', secondary: '#3d3d3d', banner: '#131313', textDark: '#FFFFFF' },
};

function getCardType(rating: number): CardType {
  if (rating >= 95) return 'diamond';
  if (rating >= 90) return 'special';
  if (rating >= 83) return 'gold';
  if (rating >= 75) return 'silver';
  return 'bronze';
}

// Calcula rating local (60-95) usando janela dos últimos 20 jogos para win rate e volume.
// Usar janela recente permite que o rating DIMINUA se o jogador perder seguido ou ficar inativo.
function calcularRatingLocal(
  todasPartidas: { resultado: string | null; time_branco: string[]; time_preto: string[]; created_at: string }[],
  votos: number[],  // estrelas recebidas de todas as votações
  jogadorId: string,
): number {
  const base = 60;

  // Média de estrelas (usa todos os votos para refletir histórico completo)
  const mediaEstrelas = votos.length > 0 ? votos.reduce((a, b) => a + b, 0) / votos.length : 3.0;
  const estrelasPts = (mediaEstrelas / 5) * 20;

  // Janela dos últimos 20 jogos em que o jogador participou
  const jogosComResultado = todasPartidas
    .filter(p => p.time_branco?.includes(jogadorId) || p.time_preto?.includes(jogadorId))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const total = jogosComResultado.length;
  const vitorias = jogosComResultado.filter(p => {
    if (p.time_branco?.includes(jogadorId)) return p.resultado === 'branco';
    if (p.time_preto?.includes(jogadorId))  return p.resultado === 'preto';
    return false;
  }).length;

  // Win rate: 0–10 pts (default 5 sem histórico)
  const vitoriaPts = total > 0 ? (vitorias / total) * 10 : 5;

  // Volume: +1 a cada 5 jogos recentes, máx +5 (25 jogos)
  const volumePts = Math.min(5, Math.floor(total / 5));

  // Bônus estrelas ≥ 4.0
  const bonusPts = mediaEstrelas >= 4.0 ? 5 : 0;

  const raw = base + estrelasPts + vitoriaPts + volumePts + bonusPts;
  return Math.min(95, Math.max(60, Math.round(raw)));
}

function PlayerCard({ data, photoUri }: { data: CardData; photoUri?: string | null }) {
  const type = getCardType(data.rating);
  const t = CARD_THEMES[type];

  return (
    <View style={[styles.cardShield, { backgroundColor: t.primary }]}>
      <View style={styles.cardTopRow}>
        <View>
          <Text style={[styles.cardRating, { color: t.textDark }]}>{data.rating}</Text>
          <Text style={[styles.cardPosition, { color: t.textDark }]}>{data.position}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <Text style={[styles.cardNation, { color: t.textDark }]}>{data.country}</Text>
          <Text style={[styles.cardClubText, { color: t.textDark }]}>{data.club}</Text>
        </View>
      </View>

      <View style={styles.cardAvatarArea}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={[styles.cardAvatarImg, { borderColor: t.secondary }]}
            resizeMode="cover"
          />
        ) : (
          <>
            <View style={[styles.cardSilHead, { backgroundColor: t.secondary }]} />
            <View style={[styles.cardSilBody, { backgroundColor: t.secondary }]} />
          </>
        )}
      </View>

      <View style={[styles.cardBanner, { backgroundColor: t.banner }]}>
        <Text style={styles.cardBannerName}>{data.name}</Text>
      </View>

      <View style={[styles.cardStatsRow, { backgroundColor: t.primary }]}>
        {([
          { val: data.vel, lbl: 'VEL' },
          { val: data.chu, lbl: 'CHU' },
          { val: data.pas, lbl: 'PAS' },
          { val: data.def, lbl: 'DEF' },
        ] as const).map(s => (
          <View key={s.lbl} style={styles.cardStatItem}>
            <Text style={[styles.cardStatVal, { color: t.textDark }]}>{s.val}</Text>
            <Text style={[styles.cardStatLbl, { color: t.textDark }]}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 62 }} />
    </View>
  );
}

// ─── Tela de Elenco ──────────────────────────────────────────────
type TeamMember = {
  id: string; name: string; position: string; photoUri: string | null;
  rating: number; wins: number; matches: number;
};

function TeamMembersScreen({ onClose }: { onClose: () => void }) {
  const [members, setMembers]       = useState<TeamMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [zoomed, setZoomed]         = useState<TeamMember | null>(null);
  const zoomAnim                    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      const [{ data: users }, { data: partidas }, { data: votos }] = await Promise.all([
        supabase.from('usuarios').select('*'),
        supabase.from('partidas').select('id,time_branco,time_preto,resultado,created_at').not('resultado', 'is', null),
        supabase.from('votacoes').select('jogador_id,estrelas'),
      ]);
      if (!users) { setLoading(false); return; }

      const votosPorJogador: Record<string, number[]> = {};
      for (const v of (votos ?? []) as { jogador_id: string; estrelas: number }[]) {
        if (!votosPorJogador[v.jogador_id]) votosPorJogador[v.jogador_id] = [];
        votosPorJogador[v.jogador_id].push(v.estrelas);
      }

      const result: TeamMember[] = (users as Usuario[]).map(u => {
        const rating = calcularRatingLocal(
          (partidas ?? []) as any[],
          votosPorJogador[u.id] ?? [],
          u.id,
        );
        const userGames = (partidas ?? []).filter((p: any) =>
          p.time_branco?.includes(u.id) || p.time_preto?.includes(u.id)
        );
        const wins = userGames.filter((p: any) => {
          if (p.time_branco?.includes(u.id)) return p.resultado === 'branco';
          if (p.time_preto?.includes(u.id))  return p.resultado === 'preto';
          return false;
        }).length;
        return {
          id: u.id,
          name: (u.nome ?? 'JOGADOR').toUpperCase(),
          position: (u.posicao ?? 'CA').toUpperCase().slice(0, 3),
          photoUri: u.foto_url ?? null,
          rating,
          wins,
          matches: userGames.length,
        };
      }).sort((a, b) => b.rating - a.rating);

      setMembers(result);
      setLoading(false);
    }
    load();
  }, []);

  function openZoom(m: TeamMember) {
    setZoomed(m);
    zoomAnim.setValue(0);
    Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }

  function closeZoom() {
    Animated.timing(zoomAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setZoomed(null));
  }

  const cardData = (m: TeamMember): CardData => ({
    rating: m.rating,
    position: m.position,
    country: 'BR',
    club: 'SFTFC',
    name: m.name.split(' ').pop() ?? m.name,
    vel: Math.min(99, 60 + Math.round(m.rating * 0.3)),
    chu: Math.min(99, 55 + Math.round(m.rating * 0.35)),
    pas: Math.min(99, 50 + Math.round(m.rating * 0.32)),
    def: Math.min(99, 30 + Math.round(m.rating * 0.2)),
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.historyHeaderBar}>
        <View>
          <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
          <Text style={styles.historyHeaderTitle}>ELENCO</Text>
        </View>
        <Pressable style={styles.historyLogoutBtn} onPress={onClose}>
          <Text style={styles.logoutText}>← VOLTAR</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.blue} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.elencoScroll} showsVerticalScrollIndicator={false}>
          {members.map((m, i) => (
            <Pressable key={m.id} style={styles.elencoRow} onPress={() => openZoom(m)}>
              <View style={styles.elencoRankBadge}>
                <Text style={styles.elencoRankText}>{i + 1}</Text>
              </View>
              <Image
                source={m.photoUri ? { uri: m.photoUri } : require('./assets/logo.png')}
                style={styles.elencoAvatar}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.elencoName} numberOfLines={1}>{m.name}</Text>
                <View style={styles.elencoPosBadge}>
                  <Text style={styles.elencoPosText}>{m.position}</Text>
                </View>
              </View>
              <View style={styles.elencoStats}>
                <Text style={styles.elencoRating}>{m.rating}</Text>
                <Text style={styles.elencoStatSub}>{m.wins}V · {m.matches}J</Text>
              </View>
              <Text style={styles.elencoChevron}>›</Text>
            </Pressable>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {zoomed && (
        <Pressable style={styles.zoomOverlay} onPress={closeZoom}>
          <Animated.View style={{ transform: [{ scale: zoomAnim }], opacity: zoomAnim, alignItems: 'center' }}>
            <PlayerCard data={cardData(zoomed)} photoUri={zoomed.photoUri} />
            <Text style={styles.zoomDismissHint}>toque para fechar</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

// ─── Tela de Login ───────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')) {
        Alert.alert(
          '📧 E-mail não confirmado',
          'Você precisa confirmar seu e-mail antes de entrar.\n\nVerifique sua caixa de entrada (e o spam) e clique no link de confirmação.',
          [
            { text: 'Reenviar e-mail', onPress: async () => {
              await supabase.auth.resend({ type: 'signup', email: email.trim() });
              Alert.alert('E-mail reenviado!', 'Verifique sua caixa de entrada.');
            }},
            { text: 'OK' },
          ]
        );
      } else if (error.message.toLowerCase().includes('invalid login')) {
        Alert.alert('E-mail ou senha incorretos', 'Verifique seus dados e tente novamente.');
      } else {
        Alert.alert('Erro ao entrar', error.message);
      }
    }
  }

  async function handleRegister() {
    if (!email || !password || !nome) {
      Alert.alert('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nome: nome.trim() } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao criar conta', error.message);
    } else {
      setPendingEmail(email.trim());
      setMode('login');
      setEmail(email.trim());
      setPassword('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <View style={styles.glowOuter} pointerEvents="none" />
      <View style={styles.glowInner} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrapper}>
          <Image
            source={require('./assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.clubName}>S.F.T.F.C.</Text>
        <View style={styles.starRow}>
          <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
          <View style={styles.dividerLine} />
          <Text style={styles.founded}>Est. 2823</Text>
          <View style={styles.dividerLine} />
          <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</Text>
          <Text style={styles.cardSub}>
            {mode === 'login' ? 'Acesse sua conta do clube' : 'Registre-se no S.F.T.F.C.'}
          </Text>

          {pendingEmail !== '' && mode === 'login' && (
            <View style={styles.verifyBanner}>
              <Text style={styles.verifyBannerIcon}>📧</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyBannerTitle}>CONFIRME SEU E-MAIL</Text>
                <Text style={styles.verifyBannerText}>
                  Enviamos um link para{'\n'}<Text style={{ color: COLORS.blue }}>{pendingEmail}</Text>
                  {'\n'}Confirme antes de entrar. Verifique também o spam.
                </Text>
                <Pressable onPress={async () => {
                  await supabase.auth.resend({ type: 'signup', email: pendingEmail });
                  Alert.alert('E-mail reenviado!', 'Verifique sua caixa de entrada.');
                }}>
                  <Text style={[styles.verifyBannerText, { color: COLORS.blue, marginTop: 6 }]}>
                    Não recebeu? Reenviar →
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {mode === 'register' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>NOME</Text>
              <TextInput
                style={[styles.input, focusedField === 'nome' && styles.inputFocused]}
                placeholder="Seu nome no clube"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="words"
                value={nome}
                onChangeText={setNome}
                onFocus={() => setFocusedField('nome')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={[styles.input, focusedField === 'email' && styles.inputFocused]}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>SENHA</Text>
            <TextInput
              style={[styles.input, focusedField === 'password' && styles.inputFocused]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {mode === 'login' && (
            <Pressable style={styles.forgotWrapper} onPress={async () => {
              if (!email) { Alert.alert('Digite seu e-mail primeiro'); return; }
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
              if (error) Alert.alert('Erro', error.message);
              else Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada.');
            }}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.btnLogin, pressed && styles.btnLoginPressed, loading && { opacity: 0.6 }]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.btnLoginText}>{mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</Text>
            }
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.btnRegister, pressed && styles.btnRegisterPressed]}
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); }}
          >
            <Text style={styles.btnRegisterText}>
              {mode === 'login' ? 'CRIAR CONTA' : 'JÁ TENHO CONTA'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>© 2823 S.F.T.F.C. — Todos os direitos reservados</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Tela de Perfil ──────────────────────────────────────────────
function ProfileScreen({ usuario, onLogout, onUsuarioUpdate, hasPendingVote, onOpenVoting }: {
  usuario: Usuario;
  onLogout: () => void;
  onUsuarioUpdate: (u: Usuario) => void;
  hasPendingVote?: boolean;
  onOpenVoting?: () => void;
}) {
  const [photoUri, setPhotoUri]       = useState<string | null>(usuario.foto_url);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNome, setEditNome]       = useState(usuario.nome ?? '');
  const [editPosicao, setEditPosicao] = useState(usuario.posicao ?? '');
  const [editNumero, setEditNumero]   = useState(String(usuario.numero_camisa ?? ''));
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [rating, setRating]           = useState(75);
  const [matchCount, setMatchCount]   = useState(0);
  const [winCount, setWinCount]       = useState(0);
  const [lossCount, setLossCount]     = useState(0);
  const [mediaEstrelas, setMediaEstrelas] = useState<number | null>(null);
  const [showTeam, setShowTeam]       = useState(false);

  const displayName = (usuario.nome || 'JOGADOR').toUpperCase();
  const lastName    = displayName.split(' ').pop() ?? displayName;
  const position    = (usuario.posicao ?? 'CA').toUpperCase().slice(0, 3);
  const number      = usuario.numero_camisa ?? 0;

  const playerCard: CardData = {
    rating,
    position,
    country: 'BR',
    club: 'SFTFC',
    name: lastName,
    vel: Math.min(99, 60 + Math.round(rating * 0.3)),
    chu: Math.min(99, 55 + Math.round(rating * 0.35)),
    pas: Math.min(99, 50 + Math.round(rating * 0.32)),
    def: Math.min(99, 30 + Math.round(rating * 0.2)),
  };

  useEffect(() => {
    async function load() {
      const { data: ratingData } = await supabase
        .rpc('calcular_rating', { p_usuario_id: usuario.id });
      if (typeof ratingData === 'number') setRating(ratingData);

      // Partidas: usa participantes (novo fluxo) e também time_branco/preto (resultado)
      const { data: partidas } = await supabase
        .from('partidas')
        .select('id, participantes, time_branco, time_preto, resultado')
        .contains('participantes', [usuario.id]);
      if (partidas) {
        setMatchCount(partidas.length);
        let wins = 0, losses = 0;
        for (const p of partidas) {
          const noTimeBranco = p.time_branco?.includes(usuario.id);
          const noTimePreto  = p.time_preto?.includes(usuario.id);
          if (!p.resultado) continue;
          if (noTimeBranco && p.resultado === 'branco') wins++;
          else if (noTimePreto && p.resultado === 'preto') wins++;
          else if (p.resultado === 'empate') { /* empate */ }
          else if (noTimeBranco || noTimePreto) losses++;
        }
        setWinCount(wins);
        setLossCount(losses);
      }

      // Média de estrelas recebidas nas votações
      const { data: votos } = await supabase
        .from('votacoes')
        .select('estrelas')
        .eq('jogador_id', usuario.id);
      if (votos && votos.length > 0) {
        const soma = votos.reduce((acc, v) => acc + v.estrelas, 0);
        setMediaEstrelas(soma / votos.length);
      }
    }
    load();
  }, [usuario.id]);

  async function saveProfile() {
    setSavingProfile(true);
    const updates: any = {};
    if (editNome.trim())    updates.nome = editNome.trim();
    if (editPosicao.trim()) updates.posicao = editPosicao.trim();
    if (editNumero.trim())  updates.numero_camisa = parseInt(editNumero, 10);
    const { data } = await supabase
      .from('usuarios').update(updates).eq('id', usuario.id).select().single();
    setSavingProfile(false);
    if (data) {
      onUsuarioUpdate(data as Usuario);
      setEditingProfile(false);
    }
  }

  async function pickAndUploadPhoto() {
    setShowPhotoMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const path     = `${usuario.id}/avatar.jpg`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const fotoUrl = urlData.publicUrl + `?t=${Date.now()}`;
      await supabase.from('usuarios').update({ foto_url: fotoUrl }).eq('id', usuario.id);
      setPhotoUri(fotoUrl);
      onUsuarioUpdate({ ...usuario, foto_url: fotoUrl });
    } catch (e: any) {
      Alert.alert('Erro ao enviar foto', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  if (showTeam) {
    return <TeamMembersScreen onClose={() => setShowTeam(false)} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {showPhotoMenu && (
        <Pressable style={styles.menuBackdrop} onPress={() => setShowPhotoMenu(false)}>
          <View style={styles.photoMenu}>
            {photoUri && (
              <Pressable style={styles.photoMenuItem} onPress={() => setShowPhotoMenu(false)}>
                <Text style={styles.photoMenuIcon}>🔍</Text>
                <Text style={styles.photoMenuText}>Ver Foto</Text>
              </Pressable>
            )}
            <Pressable style={styles.photoMenuItem} onPress={pickAndUploadPhoto}>
              <Text style={styles.photoMenuIcon}>📷</Text>
              <Text style={styles.photoMenuText}>{uploading ? 'Enviando…' : 'Trocar Foto'}</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.profileHeaderBg} />
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
          <Pressable style={styles.avatarWrapper} onPress={() => setShowPhotoMenu(true)}>
            {uploading ? (
              <View style={[styles.avatarLogo, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={COLORS.blue} />
              </View>
            ) : (
              <Image
                source={photoUri ? { uri: photoUri } : require('./assets/logo.png')}
                style={styles.avatarLogo}
                resizeMode="cover"
              />
            )}
          </Pressable>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>#{number}</Text>
          </View>
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{displayName}</Text>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{usuario.posicao?.toUpperCase() ?? 'JOGADOR'}</Text>
          </View>
          <View style={styles.starsRow}>
            <Text style={[styles.starSmall, { color: COLORS.blue }]}>★</Text>
            <Text style={[styles.starSmall, { color: COLORS.blue }]}>★</Text>
            <Text style={[styles.starSmall, { color: COLORS.blue }]}>★</Text>
          </View>
        </View>

        <View style={styles.cardWrapper}>
          <PlayerCard data={playerCard} photoUri={photoUri} />
        </View>

        {/* ── Banner Votação Pendente ── */}
        {hasPendingVote && (
          <Pressable style={styles.pendingVoteBanner} onPress={onOpenVoting}>
            <Text style={styles.pendingVoteIcon}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingVoteTitle}>VOTAÇÃO PENDENTE</Text>
              <Text style={styles.pendingVoteSub}>Avalie os jogadores da última partida</Text>
            </View>
            <Text style={styles.pendingVoteArrow}>›</Text>
          </Pressable>
        )}

        {/* ── Edit Profile ── */}
        {editingProfile ? (
          <View style={styles.editProfileCard}>
            <Text style={styles.editProfileTitle}>EDITAR PERFIL</Text>
            <Text style={styles.editProfileLabel}>Nome</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editNome}
              onChangeText={setEditNome}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.gray}
            />
            <Text style={styles.editProfileLabel}>Posição</Text>
            <Pressable
              style={[styles.editProfileInput, styles.posPickerTrigger]}
              onPress={() => setShowPositionPicker(v => !v)}
            >
              <Text style={{ color: editPosicao ? COLORS.white : COLORS.gray, fontSize: 16 }}>
                {editPosicao || 'Selecionar posição'}
              </Text>
              <Text style={{ color: COLORS.gray, fontSize: 12 }}>{showPositionPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showPositionPicker && (
              <View style={styles.posPickerGrid}>
                {POSITIONS.map(pos => (
                  <Pressable
                    key={pos}
                    style={[styles.posPickerOption, editPosicao === pos && styles.posPickerOptionSelected]}
                    onPress={() => { setEditPosicao(pos); setShowPositionPicker(false); }}
                  >
                    <Text style={[styles.posPickerOptionText, editPosicao === pos && styles.posPickerOptionTextSelected]}>
                      {pos}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.editProfileLabel}>Número da Camisa</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editNumero}
              onChangeText={setEditNumero}
              placeholder="Ex: 10"
              placeholderTextColor={COLORS.gray}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable style={[styles.editProfileBtn, { backgroundColor: COLORS.gray, flex: 1 }]} onPress={() => setEditingProfile(false)}>
                <Text style={styles.editProfileBtnText}>CANCELAR</Text>
              </Pressable>
              <Pressable style={[styles.editProfileBtn, { backgroundColor: COLORS.blue, flex: 1 }]} onPress={saveProfile} disabled={savingProfile}>
                {savingProfile
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.editProfileBtnText}>SALVAR</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.editProfileToggleBtn} onPress={() => setEditingProfile(true)}>
            <Text style={styles.editProfileToggleText}>EDITAR PERFIL</Text>
          </Pressable>
        )}

        {/* ── Stats Grid 2x2 ── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{matchCount}</Text>
            <Text style={styles.statLabel}>PARTIDAS</Text>
            <Text style={styles.statIcon}>🏃</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.green }]}>{winCount}</Text>
            <Text style={styles.statLabel}>VITÓRIAS</Text>
            <Text style={styles.statIcon}>🏆</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.red }]}>{lossCount}</Text>
            <Text style={styles.statLabel}>DERROTAS</Text>
            <Text style={styles.statIcon}>❌</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.yellow }]}>
              {mediaEstrelas !== null ? mediaEstrelas.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>MÉDIA ★</Text>
            <Text style={styles.statIcon}>⭐</Text>
          </View>
        </View>

        <Pressable style={styles.elencoBtn} onPress={() => setShowTeam(true)}>
          <Text style={styles.elencoBtnIcon}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.elencoBtnTitle}>VER ELENCO</Text>
            <Text style={styles.elencoBtnSub}>Posições, pontuação e estatísticas</Text>
          </View>
          <Text style={styles.elencoChevron}>›</Text>
        </Pressable>

        <View style={styles.clubCard}>
          <Image source={require('./assets/logo.png')} style={styles.clubCardLogo} resizeMode="contain" />
          <View style={styles.clubCardInfo}>
            <Text style={styles.clubCardName}>S.F.T.F.C.</Text>
            <Text style={styles.clubCardSub}>Membro desde 2823</Text>
            <View style={styles.clubStars}>
              <Text style={[styles.starSmall, { color: COLORS.blue }]}>★</Text>
              <Text style={[styles.starSmall, { color: COLORS.red }]}>★</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Tela de Histórico de Partidas ───────────────────────────────
type DbPartida = {
  id: string; data: string; hora: string; local: string;
  valor_individual: number | null;
  time_branco: string[]; time_preto: string[];
  gols_branco: number | null; gols_preto: number | null;
  resultado: 'branco' | 'preto' | 'empate' | null;
  participantes?: string[];
  status?: string;
  codigo?: string;
  criado_por?: string;
};

type VotacaoDetalhe = { jogador_id: string; nome: string; media_estrelas: number; total_votos: number };

function MatchHistoryScreen({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) {
  const [partidas, setPartidas]       = useState<DbPartida[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedPartida, setSelectedPartida] = useState<DbPartida | null>(null);
  const [votacaoDetails, setVotacaoDetails]   = useState<VotacaoDetalhe[]>([]);
  const [loadingVotes, setLoadingVotes]       = useState(false);

  async function deletePartida(id: string) {
    Alert.alert('Excluir partida', 'Tem certeza? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const { error: ev } = await supabase.from('votacoes').delete().eq('partida_id', id);
        if (ev) { Alert.alert('Erro ao excluir votos', ev.message); return; }
        const { data: deleted, error: ep } = await supabase
          .from('partidas').delete().eq('id', id).select('id');
        if (ep) { Alert.alert('Erro ao excluir partida', ep.message); return; }
        if (!deleted || deleted.length === 0) {
          Alert.alert('Sem permissão', 'O Supabase bloqueou o delete silenciosamente.\n\nVá no dashboard Supabase → Table Editor → partidas → Policies e adicione uma política DELETE para: auth.uid() = criado_por');
          return;
        }
        setPartidas(prev => prev.filter(p => p.id !== id));
      }},
    ]);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('partidas')
        .select('*')
        .order('data', { ascending: false });
      if (data) setPartidas(data as DbPartida[]);
      setLoading(false);
    }
    load();
  }, []);

  async function openVotacaoResults(partida: DbPartida) {
    setSelectedPartida(partida);
    setLoadingVotes(true);
    const { data } = await supabase
      .from('votacoes')
      .select('jogador_id, estrelas, usuarios!votacoes_jogador_id_fkey(nome)')
      .eq('partida_id', partida.id);
    if (data) {
      const map: Record<string, { nome: string; soma: number; total: number }> = {};
      for (const v of data as any[]) {
        const jid  = v.jogador_id;
        const nome = v.usuarios?.nome ?? jid;
        if (!map[jid]) map[jid] = { nome, soma: 0, total: 0 };
        map[jid].soma  += v.estrelas;
        map[jid].total += 1;
      }
      const list = Object.entries(map).map(([jid, d]) => ({
        jogador_id: jid,
        nome: d.nome,
        media_estrelas: d.soma / d.total,
        total_votos: d.total,
      })).sort((a, b) => b.media_estrelas - a.media_estrelas);
      setVotacaoDetails(list);
    }
    setLoadingVotes(false);
  }

  const wins   = partidas.filter(p => {
    if (p.time_branco?.includes(usuario.id)) return p.resultado === 'branco';
    if (p.time_preto?.includes(usuario.id))  return p.resultado === 'preto';
    return false;
  }).length;
  const total  = partidas.length;

  if (selectedPartida) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View>
            <Text style={styles.historyHeaderSub}>{selectedPartida.local}</Text>
            <Text style={styles.historyHeaderTitle}>VOTAÇÃO DA PARTIDA</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={() => setSelectedPartida(null)}>
            <Text style={styles.logoutText}>← VOLTAR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.historyScroll, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.seasonCard}>
            <Text style={styles.seasonLabel}>{selectedPartida.data} · {selectedPartida.hora}</Text>
            <Text style={[styles.seasonLabel, { fontSize: 18, color: COLORS.white, marginTop: 6 }]}>
              {selectedPartida.gols_branco ?? '–'} × {selectedPartida.gols_preto ?? '–'}
            </Text>
          </View>
          {loadingVotes ? (
            <ActivityIndicator color={COLORS.blue} style={{ marginTop: 40 }} />
          ) : votacaoDetails.length === 0 ? (
            <Text style={[styles.matchDate, { textAlign: 'center', marginTop: 40 }]}>Nenhum voto registrado</Text>
          ) : (
            votacaoDetails.map((v, i) => (
              <View key={v.jogador_id} style={[styles.matchCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
                <View style={[styles.voteIndexBadge, { minWidth: 36, alignItems: 'center' }]}>
                  <Text style={[styles.voteIndexBadgeText, { fontSize: 16 }]}>{i + 1}°</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchTeamSFTFC}>{v.nome.toUpperCase()}</Text>
                  <Text style={styles.matchDate}>{v.total_votos} voto{v.total_votos !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.voteStarsDisplay, { fontSize: 14 }]}>
                    {'★'.repeat(Math.round(v.media_estrelas))}{'☆'.repeat(5 - Math.round(v.media_estrelas))}
                  </Text>
                  <Text style={[styles.matchDate, { color: COLORS.yellow }]}>
                    {v.media_estrelas.toFixed(1)} / 5
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.historyHeaderBar}>
        <View>
          <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
          <Text style={styles.historyHeaderTitle}>HISTÓRICO</Text>
        </View>
        <Pressable style={styles.historyLogoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>SAIR</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.historyScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.seasonCard}>
          <Text style={styles.seasonLabel}>TEMPORADA 2025/26</Text>
          <View style={styles.seasonRow}>
            <View style={styles.seasonStat}>
              <Text style={[styles.seasonNum, { color: COLORS.green }]}>{wins}</Text>
              <Text style={styles.seasonStatLabel}>VITÓRIAS</Text>
            </View>
            <View style={styles.seasonDivider} />
            <View style={styles.seasonStat}>
              <Text style={[styles.seasonNum, { color: COLORS.white }]}>{total}</Text>
              <Text style={styles.seasonStatLabel}>PARTIDAS</Text>
            </View>
          </View>
        </View>

        {loading && <ActivityIndicator color={COLORS.blue} style={{ marginTop: 40 }} />}

        {!loading && partidas.length === 0 && (
          <Text style={[styles.matchDate, { textAlign: 'center', marginTop: 40 }]}>
            Nenhuma partida registrada ainda
          </Text>
        )}

        {partidas.map(p => {
          const meuTime  = p.time_branco?.includes(usuario.id) ? 'branco' : p.time_preto?.includes(usuario.id) ? 'preto' : null;
          const resultColor =
            !meuTime || !p.resultado ? COLORS.gray :
            p.resultado === 'empate' ? COLORS.yellow :
            p.resultado === meuTime  ? COLORS.green : COLORS.red;
          const resultLabel =
            !meuTime || !p.resultado ? 'SEM RESULTADO' :
            p.resultado === 'empate' ? 'EMPATE' :
            p.resultado === meuTime  ? 'VITÓRIA' : 'DERROTA';
          return (
            <View key={p.id} style={styles.matchCard}>
              <Pressable onPress={() => openVotacaoResults(p)}>
                <View style={styles.matchTopRow}>
                  <Text style={styles.matchCompetition}>{p.local.toUpperCase()}</Text>
                  <Text style={styles.matchDate}>{p.data} · {p.hora}</Text>
                </View>
                <View style={styles.matchSep} />
                <View style={styles.matchMiddleRow}>
                  <View style={styles.matchTeamLeft}>
                    <Text style={styles.matchTeamSFTFC}>TIME BRANCO</Text>
                    <Text style={styles.matchVenueTag}>{p.time_branco?.length ?? 0} jog.</Text>
                  </View>
                  <Text style={styles.matchScoreText}>
                    {p.gols_branco ?? '–'} × {p.gols_preto ?? '–'}
                  </Text>
                  <View style={styles.matchTeamRight}>
                    <Text style={styles.matchTeamOpponent} numberOfLines={2}>TIME PRETO</Text>
                  </View>
                </View>
                <View style={styles.matchBottomRow}>
                  <View style={[styles.resultBadge, { borderColor: resultColor, backgroundColor: resultColor + '18' }]}>
                    <Text style={[styles.resultText, { color: resultColor }]}>{resultLabel}</Text>
                  </View>
                  {p.valor_individual && (
                    <Text style={[styles.matchGoalsText, { color: COLORS.green }]}>
                      💰 R$ {p.valor_individual}
                    </Text>
                  )}
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={[styles.matchDate, { color: COLORS.blue }]}>
                  Toque para ver votação →
                </Text>
                {p.criado_por === usuario.id && (
                  <Pressable
                    onPress={() => deletePartida(p.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Formação Tática ─────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const MINI_W = 68;
const MINI_H = 88;

interface SquadPlayer { id: number; name: string; number: number; position: string; rating: number; cardTypeOverride?: CardType; userId?: string; photoUri?: string }

const SQUAD_PLAYERS: SquadPlayer[] = [
  { id: 0, name: 'ARTHUR',  number: 1,  position: 'Goleiro',         rating: 87 },
  { id: 1, name: 'RAYO',    number: 2,  position: 'Lateral Direito', rating: 84 },
  { id: 2, name: 'PARKER',  number: 5,  position: 'Zagueiro',        rating: 82 },
  { id: 3, name: 'BRAGA',   number: 10, position: 'Meia Central',    rating: 80 },
  { id: 4, name: 'VITAO',   number: 4,  position: 'Zagueiro',        rating: 79 },
  { id: 5, name: 'CUERVO',  number: 7,  position: 'Meia Esquerdo',   rating: 77 },
  { id: 6, name: 'HOFFMAN', number: 9,  position: 'Atacante',        rating: 76 },
];

interface FormationSlot { label: string; x: number; y: number }
interface FormationDef  { slots: FormationSlot[]; synergies: [number, number][] }

const FORMATIONS: Record<string, FormationDef> = {
  '2-3-1': {
    slots: [
      { label: 'GK',  x: 0.50, y: 0.86 }, { label: 'ZAG', x: 0.28, y: 0.67 },
      { label: 'ZAG', x: 0.72, y: 0.67 }, { label: 'ME',  x: 0.16, y: 0.37 },
      { label: 'MC',  x: 0.50, y: 0.33 }, { label: 'MD',  x: 0.84, y: 0.37 },
      { label: 'CA',  x: 0.50, y: 0.11 },
    ],
    synergies: [[0,1],[0,2],[1,2],[1,3],[2,5],[3,4],[4,5],[3,6],[4,6],[5,6]],
  },
  '3-2-1': {
    slots: [
      { label: 'GK',  x: 0.50, y: 0.86 }, { label: 'LD',  x: 0.18, y: 0.67 },
      { label: 'ZAG', x: 0.50, y: 0.71 }, { label: 'LE',  x: 0.82, y: 0.67 },
      { label: 'MC',  x: 0.33, y: 0.40 }, { label: 'MC',  x: 0.67, y: 0.40 },
      { label: 'CA',  x: 0.50, y: 0.11 },
    ],
    synergies: [[0,1],[0,2],[0,3],[1,2],[2,3],[1,4],[3,5],[4,5],[4,6],[5,6]],
  },
  '2-2-2': {
    slots: [
      { label: 'GK',  x: 0.50, y: 0.86 }, { label: 'ZAG', x: 0.28, y: 0.69 },
      { label: 'ZAG', x: 0.72, y: 0.69 }, { label: 'MC',  x: 0.28, y: 0.47 },
      { label: 'MC',  x: 0.72, y: 0.47 }, { label: 'CA',  x: 0.28, y: 0.20 },
      { label: 'CA',  x: 0.72, y: 0.20 },
    ],
    synergies: [[0,1],[0,2],[1,2],[1,3],[2,4],[3,4],[3,5],[4,6],[5,6]],
  },
  '1-3-2': {
    slots: [
      { label: 'GK',  x: 0.50, y: 0.86 }, { label: 'ZAG', x: 0.50, y: 0.72 },
      { label: 'ME',  x: 0.16, y: 0.47 }, { label: 'MC',  x: 0.50, y: 0.44 },
      { label: 'MD',  x: 0.84, y: 0.47 }, { label: 'CA',  x: 0.28, y: 0.16 },
      { label: 'CA',  x: 0.72, y: 0.16 },
    ],
    synergies: [[0,1],[1,2],[1,3],[1,4],[2,3],[3,4],[2,5],[3,5],[3,6],[4,6]],
  },
  '3-1-2': {
    slots: [
      { label: 'GK',  x: 0.50, y: 0.86 }, { label: 'LD',  x: 0.18, y: 0.67 },
      { label: 'ZAG', x: 0.50, y: 0.71 }, { label: 'LE',  x: 0.82, y: 0.67 },
      { label: 'MC',  x: 0.50, y: 0.44 }, { label: 'CA',  x: 0.28, y: 0.16 },
      { label: 'CA',  x: 0.72, y: 0.16 },
    ],
    synergies: [[0,1],[0,2],[0,3],[1,2],[2,3],[1,4],[2,4],[3,4],[4,5],[4,6],[5,6]],
  },
};

function MiniPlayerCard({
  player, slotLabel, selected,
}: { player: SquadPlayer; slotLabel: string; selected: boolean }) {
  const type = player.cardTypeOverride ?? getCardType(player.rating);
  const t = CARD_THEMES[type];
  return (
    <View style={{ alignItems: 'center', transform: [{ scale: selected ? 1.12 : 1 }] }}>
      <View style={[styles.miniCard, { backgroundColor: t.primary }]}>
        <View style={styles.miniCardTop}>
          <Text style={[styles.miniRating, { color: t.textDark }]}>{player.rating}</Text>
          <Text style={[styles.miniPos,    { color: t.textDark }]}>{slotLabel}</Text>
        </View>
        <View style={styles.miniSilArea}>
          {player.photoUri ? (
            <Image source={{ uri: player.photoUri }} style={styles.miniPhoto} resizeMode="cover" />
          ) : (
            <>
              <View style={[styles.miniSilHead, { backgroundColor: t.secondary }]} />
              <View style={[styles.miniSilBody, { backgroundColor: t.secondary }]} />
            </>
          )}
        </View>
        <View style={[styles.miniBanner, { backgroundColor: t.banner }]}>
          <Text style={styles.miniName} numberOfLines={1}>{player.name}</Text>
        </View>
        <View style={{ height: 10 }} />
      </View>
      {selected && (
        <View pointerEvents="none" style={styles.miniSelRing} />
      )}
    </View>
  );
}

function FormationScreen({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) {
  const [formKey, setFormKey]         = useState('2-3-1');
  const [assignments, setAssignments] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [selSlot, setSelSlot]         = useState<number | null>(null);
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>(SQUAD_PLAYERS);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [hasSynergy, setHasSynergy]     = useState(false);
  const formacaoLoaded   = useRef(false);
  const restoredAsn      = useRef<number[] | null>(null);

  // Carregar formação salva localmente
  useEffect(() => {
    async function loadFormacao() {
      const saved = await SecureStore.getItemAsync('formacao_config');
      if (saved) {
        try {
          const { formKey: fk, assignments: asn } = JSON.parse(saved);
          if (fk && FORMATIONS[fk]) setFormKey(fk);
          if (Array.isArray(asn) && asn.length === 7) restoredAsn.current = asn;
        } catch {}
      }
      formacaoLoaded.current = true;
    }
    loadFormacao();
  }, []);

  // Salvar formação quando mudar
  useEffect(() => {
    if (!formacaoLoaded.current) return;
    SecureStore.setItemAsync('formacao_config', JSON.stringify({ formKey, assignments }));
  }, [formKey, assignments]);

  useEffect(() => {
    async function loadSquad() {
      setLoadingSquad(true);
      const { data: users } = await supabase.from('usuarios').select('*');
      if (!users || users.length === 0) { setLoadingSquad(false); return; }

      const { data: partidas } = await supabase
        .from('partidas')
        .select('id, time_branco, time_preto, resultado, created_at')
        .not('resultado', 'is', null);

      const { data: votos } = await supabase.from('votacoes').select('jogador_id, estrelas');

      const votosPorJogador: Record<string, number[]> = {};
      for (const v of (votos ?? []) as { jogador_id: string; estrelas: number }[]) {
        if (!votosPorJogador[v.jogador_id]) votosPorJogador[v.jogador_id] = [];
        votosPorJogador[v.jogador_id].push(v.estrelas);
      }

      const squad: SquadPlayer[] = (users as Usuario[]).map((u, i) => {
        const nome = (u.nome ?? 'JOGADOR').toUpperCase();
        const lastName = nome.split(' ').pop() ?? nome;
        const rating = calcularRatingLocal(
          (partidas ?? []) as any[],
          votosPorJogador[u.id] ?? [],
          u.id,
        );
        return {
          id: i,
          name: lastName.slice(0, 10),
          number: u.numero_camisa ?? i + 1,
          position: (u.posicao ?? 'CA').toUpperCase().slice(0, 3),
          rating,
          userId: u.id,
          photoUri: u.foto_url ?? undefined,
        };
      });

      const ultimos5 = ((partidas ?? []) as any[])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      const vits5 = ultimos5.filter((p: any) => p.resultado !== null && p.resultado !== 'empate').length;
      setHasSynergy(vits5 >= 3);

      // Ordenar por rating; preencher com placeholders se < 7
      squad.sort((a, b) => b.rating - a.rating);
      const placeholderPositions = ['GK', 'ZAG', 'ME', 'MC', 'MD', 'CA', 'CA'];
      const finalSquad: SquadPlayer[] = squad.map((p, i) => ({ ...p, id: i }));
      while (finalSquad.length < 7) {
        const i = finalSquad.length;
        finalSquad.push({ id: i, name: '???', number: 0, position: placeholderPositions[i], rating: 60 });
      }
      setSquadPlayers(finalSquad);

      // Restaurar assignments salvos se os índices ainda são válidos
      const restored = restoredAsn.current;
      const validRestored =
        restored &&
        restored.length === 7 &&
        new Set(restored).size === 7 &&
        restored.every(idx => idx >= 0 && idx < finalSquad.length);
      setAssignments(validRestored ? restored! : [0, 1, 2, 3, 4, 5, 6]);
      setLoadingSquad(false);
    }
    loadSquad();
  }, [usuario.id]);

  const formation = FORMATIONS[formKey];

  // Banco = jogadores não presentes nos 7 slots da formação
  const bench = squadPlayers.filter((_, idx) => !assignments.includes(idx));
  const hasBench = bench.length > 0;

  const HEADER_H    = Platform.OS === 'ios' ? 100 : 82;
  const SYNERGY_H   = 38;
  const FORM_SEL_H  = 80;
  const BENCH_H     = hasBench ? 96 : 0;
  const TAB_H       = Platform.OS === 'ios' ? 80 : 60;
  const PITCH_PAD   = 8;
  const PITCH_W     = SW - PITCH_PAD * 2;
  const PITCH_H     = SH - HEADER_H - SYNERGY_H - FORM_SEL_H - BENCH_H - TAB_H - PITCH_PAD;

  const swapping  = selSlot !== null;
  const lineColor = hasSynergy && !swapping ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)';

  function handleSlotPress(idx: number) {
    if (selSlot === null) {
      setSelSlot(idx);
    } else if (selSlot === idx) {
      setSelSlot(null);
    } else {
      const next = [...assignments];
      [next[selSlot], next[idx]] = [next[idx], next[selSlot]];
      setAssignments(next);
      setSelSlot(null);
    }
  }

  function handleBenchPress(playerIdx: number) {
    if (selSlot === null) return;
    const next = [...assignments];
    next[selSlot] = playerIdx;
    setAssignments(next);
    setSelSlot(null);
  }

  return (
    <View style={[styles.root, { backgroundColor: '#0a0a0a' }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.formHeader}>
        <View>
          <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
          <Text style={styles.historyHeaderTitle}>FORMAÇÃO</Text>
        </View>
        <View style={styles.formBadge}>
          <Text style={styles.formBadgeText}>{formKey}</Text>
        </View>
        <Pressable style={styles.historyLogoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>SAIR</Text>
        </Pressable>
      </View>

      {/* Synergy / swap hint */}
      <View style={[styles.synergyBar, hasSynergy && !swapping && styles.synergyBarActive]}>
        <View style={[styles.synergyDot, hasSynergy && !swapping && styles.synergyDotActive]} />
        {swapping ? (
          <Text style={[styles.synergyText, { color: '#FFD700' }]}>
            ⇄  Toca campo ou banco para substituir · mesmo para cancelar
          </Text>
        ) : (
          <Text style={[styles.synergyText, hasSynergy && styles.synergyTextActive]}>
            {hasSynergy
              ? 'Sinergia ativa  (3+ vitórias nos últimos 5 jogos)'
              : 'Sinergia inativa — vença mais jogos para ativar'}
          </Text>
        )}
      </View>

      {/* Formation selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.formSelScroll}
        contentContainerStyle={styles.formSelContent}
      >
        {Object.keys(FORMATIONS).map(key => {
          const p = key.split('-');
          const isActive = formKey === key;
          return (
            <Pressable
              key={key}
              style={[styles.formSelBtn, isActive && styles.formSelBtnActive]}
              onPress={() => { setFormKey(key); setSelSlot(null); }}
            >
              <Text style={[styles.formSelText, isActive && styles.formSelTextActive]}>
                {p[0]} - {p[1]} -
              </Text>
              <Text style={[styles.formSelText, isActive && styles.formSelTextActive, styles.formSelTextLine2]}>
                {p[2]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Pitch */}
      <View style={[styles.pitchContainer, { padding: PITCH_PAD }]}>
        <View style={[styles.pitch, { width: PITCH_W, height: PITCH_H }]}>

          {/* Grass stripes */}
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={`s${i}`}
              style={{
                position: 'absolute', left: 0, width: PITCH_W,
                height: PITCH_H / 10, top: i * (PITCH_H / 10),
                backgroundColor: i % 2 === 0 ? '#111a12' : '#0d1510',
              }}
            />
          ))}

          {/* Field markings */}
          <View style={styles.pitchOutline} />
          <View style={[styles.pitchMidLine, { top: PITCH_H / 2 - 1 }]} />
          <View style={[styles.pitchMidCircle, { left: PITCH_W / 2 - 48, top: PITCH_H / 2 - 48 }]} />
          <View style={[styles.pitchBox, { width: PITCH_W * 0.55, height: PITCH_H * 0.13, left: PITCH_W * 0.225, top: 0 }]} />
          <View style={[styles.pitchBox, { width: PITCH_W * 0.55, height: PITCH_H * 0.13, left: PITCH_W * 0.225, top: PITCH_H - PITCH_H * 0.13 }]} />

          {/* Synergy lines */}
          {formation.synergies.map(([ai, bi]) => {
            const a = formation.slots[ai], b = formation.slots[bi];
            const ax = a.x * PITCH_W, ay = a.y * PITCH_H;
            const bx = b.x * PITCH_W, by = b.y * PITCH_H;
            const dx = bx - ax, dy = by - ay;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const active = hasSynergy && !swapping;
            const lh = active ? 2.5 : 1;
            return (
              <View key={`l${ai}-${bi}`}>
                {/* Glow layer (only when active) */}
                {active && (
                  <View
                    style={{
                      position: 'absolute',
                      width: len,
                      height: 8,
                      left: ax + dx / 2 - len / 2,
                      top:  ay + dy / 2 - 4,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                )}
                {/* Main line */}
                <View
                  style={{
                    position: 'absolute',
                    width: len,
                    height: lh,
                    left: ax + dx / 2 - len / 2,
                    top:  ay + dy / 2 - lh / 2,
                    backgroundColor: lineColor,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              </View>
            );
          })}

          {/* Player cards */}
          {!loadingSquad && formation.slots.map((slot, idx) => {
            const player  = squadPlayers[assignments[idx]];
            if (!player) return null;
            const isSel   = selSlot === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => handleSlotPress(idx)}
                style={{
                  position: 'absolute',
                  left: slot.x * PITCH_W - MINI_W / 2,
                  top:  slot.y * PITCH_H - MINI_H / 2,
                  zIndex: isSel ? 20 : 10,
                  opacity: swapping && !isSel ? 0.6 : 1,
                }}
              >
                <MiniPlayerCard player={player} slotLabel={slot.label} selected={isSel} />
              </Pressable>
            );
          })}
          {loadingSquad && (
            <View style={{ position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' }}>
              <ActivityIndicator color={COLORS.blue} size="large" />
            </View>
          )}
        </View>
      </View>

      {/* Banco de reservas */}
      {hasBench && (
        <View style={styles.benchBar}>
          <Text style={styles.benchLabel}>
            {swapping ? 'BANCO  —  toca para substituir' : 'BANCO'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.benchScroll}
          >
            {bench.map(player => {
              const playerIdx = squadPlayers.indexOf(player);
              return (
                <Pressable
                  key={player.id}
                  onPress={() => handleBenchPress(playerIdx)}
                  style={[styles.benchItem, swapping && styles.benchItemActive]}
                >
                  <MiniPlayerCard player={player} slotLabel={player.position} selected={false} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Tela de Votação ─────────────────────────────────────────────
type VotingPlayer = { id: string; name: string; num: number };
interface VoteResult { player: VotingPlayer; stars: number; }

const VOTE_CARD_W = SW - 32;
const PLACE_LABELS = ['1° LUGAR', '2° LUGAR', '3° LUGAR'];

function VotingScreen({ usuario, onLogout, onVoteComplete }: { usuario: Usuario; onLogout: () => void; onVoteComplete?: () => void }) {
  const [phase, setPhase]       = useState<'idle' | 'voting' | 'results'>('idle');
  const [curIdx, setCurIdx]     = useState(0);
  const [curStars, setCurStars] = useState(0);
  const [votes, setVotes]       = useState<number[]>([]);
  const [ranked, setRanked]     = useState<VoteResult[]>([]);
  const [pendingMatch, setPendingMatch] = useState<DbPartida | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [matchPlayers, setMatchPlayers] = useState<VotingPlayer[]>([]);

  const carouselRef = useRef<ScrollView>(null);
  const carouselPos = useRef(0);
  const voteBases   = useRef(Array.from({ length: 20 }, () => Math.floor(Math.random() * 100) + 50));

  useEffect(() => {
    async function checkPendingVote() {
      setLoadingMatch(true);
      const { data: partidas } = await supabase
        .from('partidas')
        .select('*')
        .not('resultado', 'is', null)
        .order('data', { ascending: false })
        .limit(5);
      if (partidas) {
        for (const p of partidas as DbPartida[]) {
          const isPlayer = p.time_branco?.includes(usuario.id) || p.time_preto?.includes(usuario.id);
          if (!isPlayer) continue;
          const { data: jaVotou } = await supabase
            .from('votacoes')
            .select('id')
            .eq('partida_id', p.id)
            .eq('votante_id', usuario.id)
            .limit(1);
          if (!jaVotou || jaVotou.length === 0) {
            setPendingMatch(p);
            const allIds = [...(p.time_branco ?? []), ...(p.time_preto ?? [])].filter(id => id !== usuario.id);
            if (allIds.length > 0) {
              const { data: uList } = await supabase.from('usuarios').select('id, nome').in('id', allIds);
              if (uList) {
                setMatchPlayers(uList.map((u: any, i: number) => ({ id: u.id, name: (u.nome ?? 'JOGADOR').toUpperCase(), num: i + 1 })));
              }
            }
            break;
          }
        }
      }
      setLoadingMatch(false);
    }
    checkPendingVote();
  }, [usuario.id]);

  function startVoting() {
    setCurIdx(0); setCurStars(0); setVotes([]);
    setPhase('voting');
  }

  async function confirmVote() {
    if (curStars === 0) return;
    const players = matchPlayers.length > 0 ? matchPlayers : SQUAD_PLAYERS.map((p, i) => ({ id: String(p.id), name: p.name, num: i + 1 }));
    const newVotes = [...votes, curStars];
    if (curIdx < players.length - 1) {
      setVotes(newVotes); setCurIdx(curIdx + 1); setCurStars(0);
    } else {
      const results: VoteResult[] = players
        .map((p, i) => ({ player: p, stars: newVotes[i] }))
        .sort((a, b) => b.stars - a.stars);
      setRanked(results);
      setPhase('results');
      if (pendingMatch) {
        const rows = players.map((p, i) => ({
          partida_id: pendingMatch.id,
          votante_id: usuario.id,
          jogador_id: p.id,
          estrelas: newVotes[i],
        }));
        await supabase.from('votacoes').upsert(rows, { ignoreDuplicates: true });
        setPendingMatch(null);
        onVoteComplete?.();
      }
    }
  }

  useEffect(() => {
    if (phase !== 'results' || ranked.length === 0) return;
    const count = Math.min(ranked.length, 3) + 1;
    carouselPos.current = 0;
    const t = setInterval(() => {
      carouselPos.current = (carouselPos.current + 1) % count;
      carouselRef.current?.scrollTo({ x: carouselPos.current * (VOTE_CARD_W + 16), animated: true });
    }, 3200);
    return () => clearInterval(t);
  }, [phase, ranked]);

  // ── IDLE ──
  if (phase === 'idle') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View>
            <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
            <Text style={styles.historyHeaderTitle}>VOTAÇÃO</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.voteNewPage} showsVerticalScrollIndicator={false}>
          {loadingMatch ? (
            <ActivityIndicator color={COLORS.blue} style={{ marginTop: 40 }} />
          ) : pendingMatch ? (
            <>
              <View style={[styles.voteNewBadge, { backgroundColor: COLORS.red }]}>
                <Text style={styles.voteNewBadgeText}>VOTAÇÃO PENDENTE</Text>
              </View>
              <Text style={styles.voteNewTitle}>{'VOTAÇÃO\nPOR AVALIAR'}</Text>
              <Text style={styles.voteNewDesc}>
                Você jogou em {pendingMatch.local} no dia {pendingMatch.data} e ainda não avaliou os jogadores dessa partida!
              </Text>
              <Pressable
                style={({ pressed }) => [styles.voteNewStartBtn, { backgroundColor: COLORS.red }, pressed && { opacity: 0.85 }]}
                onPress={startVoting}
              >
                <Text style={styles.voteNewStartText}>⚡  VOTAR AGORA</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.voteNewBadge}>
                <Text style={styles.voteNewBadgeText}>MELHOR JOGADOR DO FUT7</Text>
              </View>
              <Text style={styles.voteNewTitle}>{'VOTE JOGADOR\nPOR JOGADOR'}</Text>
              <Text style={styles.voteNewDesc}>
                Um card por vez, escolha as estrelas e veja o pódio reagir com o top 3 e a temida Bola Murcha.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.voteNewStartBtn, pressed && { opacity: 0.85 }]}
                onPress={startVoting}
              >
                <Text style={styles.voteNewStartText}>⚡  INICIAR VOTAÇÃO</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── VOTING ──
  if (phase === 'voting') {
    const players   = matchPlayers.length > 0 ? matchPlayers : SQUAD_PLAYERS.map((p, i) => ({ id: String(p.id), name: p.name, num: i + 1 }));
    const player    = players[curIdx];
    const voteCount = voteBases.current[curIdx % voteBases.current.length] + curIdx * 7;
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.voteNewPage}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.voteNewBadge}>
            <Text style={styles.voteNewBadgeText}>MELHOR JOGADOR DO FUT7</Text>
          </View>
          <Text style={styles.voteNewTitle}>{'VOTE JOGADOR\nPOR JOGADOR'}</Text>
          <Text style={styles.voteNewDesc}>
            Um card por vez, escolha as estrelas e veja o pódio reagir com o top 3 e a temida Bola Murcha.
          </Text>

          <View style={styles.votePlayerCard}>
            <View style={styles.voteCardTopRow}>
              <View style={styles.voteIndexBadge}>
                <Text style={styles.voteIndexBadgeText}>
                  JOGADOR {curIdx + 1}/{players.length}
                </Text>
              </View>
              <Text style={styles.voteVoteCount}>{voteCount} votos</Text>
            </View>

            <View style={styles.votePlayerInfoRow}>
              <View style={styles.voteNumBox}>
                <Text style={styles.voteNumText}>{player?.num ?? curIdx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voteNameBig}>{player?.name ?? '—'}</Text>
                <Text style={styles.votePosText}>Jogador da partida</Text>
              </View>
            </View>

            <View style={styles.voteCardDivider} />

            <Text style={styles.voteStarLabel}>ESCOLHA AS ESTRELAS</Text>
            <View style={styles.voteStarRowNew}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => setCurStars(n)} style={styles.voteStarBtn}>
                  <Text style={[styles.voteStarIconNew, n <= curStars && styles.voteStarActive]}>
                    {n <= curStars ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={[styles.voteNewStartBtn, curStars === 0 && styles.srCTABtnOff]}
            onPress={confirmVote}
          >
            <Text style={[styles.voteNewStartText, curStars === 0 && { color: '#444' }]}>
              {curIdx < players.length - 1 ? 'CONFIRMAR  →' : 'VER RESULTADO  ⚡'}
            </Text>
          </Pressable>

          <Pressable onPress={() => setPhase('idle')} style={{ alignSelf: 'center', marginTop: 4 }}>
            <Text style={styles.srModeBack}>CANCELAR</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── RESULTS ──
  const topThree = ranked.slice(0, 3);
  const worst    = ranked[ranked.length - 1];
  const allCards = [...topThree, worst];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.historyHeaderBar}>
        <View>
          <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
          <Text style={styles.historyHeaderTitle}>RESULTADO</Text>
        </View>
        <Pressable style={styles.historyLogoutBtn} onPress={() => setPhase('idle')}>
          <Text style={styles.logoutText}>VOLTAR</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.voteNewPage, { paddingBottom: 8 }]}>
          <View style={[styles.voteNewBadge, { backgroundColor: COLORS.red }]}>
            <Text style={styles.voteNewBadgeText}>RESULTADO FINAL</Text>
          </View>
          <Text style={styles.voteNewTitle}>{'PÓDIO DA\nRODADA'}</Text>
          <Text style={styles.voteNewDesc}>
            Revelação animada dos melhores do fut7 e do Bola Murcha em cards com clima de premiação.
          </Text>
        </View>

        <ScrollView
          ref={carouselRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={VOTE_CARD_W + 16}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 40 }}
        >
          {allCards.map((r, idx) => {
            const isWorst   = idx === allCards.length - 1;
            const voteCount = voteBases.current[(r.player.num - 1) % voteBases.current.length] + idx * 7 + 5;

            if (isWorst) {
              return (
                <View key="worst" style={[styles.voteResultCard, styles.voteResultCardWorst, { width: VOTE_CARD_W }]}>
                  <View style={styles.voteResultTopRow}>
                    <View style={[styles.voteNewBadge, { backgroundColor: COLORS.red, marginBottom: 0 }]}>
                      <Text style={styles.voteNewBadgeText}>CHAMADA FINAL · BOLA MURCHA</Text>
                    </View>
                    <View style={styles.voteWorstStamp}>
                      <Text style={styles.voteWorstStampText}>MURCHI.U'</Text>
                    </View>
                  </View>

                  <View style={[styles.votePlayerInfoRow, { marginTop: 20 }]}>
                    <View style={[styles.voteNumBox, { backgroundColor: COLORS.red }]}>
                      <Text style={{ fontSize: 24 }}>😠</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voteNameBig}>{r.player.name}</Text>
                      <Text style={styles.votePosText}>
                        Último lugar confirmado — a bola murchou · {voteCount} votos
                      </Text>
                    </View>
                  </View>

                  <View style={{ minHeight: 60 }} />

                  <View style={styles.voteResultBottom}>
                    <Text style={[styles.voteResultBottomLabel, { color: COLORS.red }]}>
                      CHAMADA FINAL APÓS O TOP 3
                    </Text>
                    <Text style={styles.voteStarsDisplay}>
                      {'★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)}
                    </Text>
                  </View>
                  <View style={styles.voteWorstBallMark} />
                </View>
              );
            }

            return (
              <View key={r.player.id} style={[styles.voteResultCard, { width: VOTE_CARD_W }]}>
                <View style={styles.voteResultTopRow}>
                  <View style={[styles.voteNewBadge, { marginBottom: 0 }]}>
                    <Text style={styles.voteNewBadgeText}>
                      REVELAÇÃO {String(idx + 1).padStart(2, '0')} · {PLACE_LABELS[idx]}
                    </Text>
                  </View>
                  <Text style={styles.voteResultScore}>{r.stars}.0</Text>
                </View>

                <View style={[styles.votePlayerInfoRow, { marginTop: 20 }]}>
                  <View style={styles.voteNumBox}>
                    <Text style={styles.voteNumText}>{r.player.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voteNameBig}>{r.player.name}</Text>
                    <Text style={styles.votePosText}>Jogador da partida · {voteCount} votos</Text>
                  </View>
                </View>

                <View style={{ minHeight: 60 }} />

                <View style={styles.voteResultBottom}>
                  <Text style={styles.voteStarsDisplay}>
                    {'★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

// ─── Tela de Sorteio ─────────────────────────────────────────────
const SR_DAY_NAMES   = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const SR_MONTH_NAMES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function SorteioScreen({ usuario, onLogout, joinMatchCode, onJoinHandled }: {
  usuario: Usuario; onLogout: () => void;
  joinMatchCode?: string | null; onJoinHandled?: () => void;
}) {
  type Phase = 'schedule' | 'lobby' | 'join-lobby' | 'join-preview' | 'captain-mode' | 'manual-captain'
    | 'coin-flip' | 'share-code' | 'join-code' | 'team-building-live' | 'watch-draw';

  const [phase, setPhase]               = useState<Phase>('schedule');
  const [venue, setVenue]               = useState('');
  const [matchDate, setMatchDate]       = useState('');
  const [matchHour, setMatchHour]       = useState('');
  const [matchMinute, setMatchMinute]   = useState('');
  const [matchPrice, setMatchPrice]     = useState('');
  const [currentPartidaId, setCurrentPartidaId]         = useState<string | null>(null);
  const [currentPartidaCodigo, setCurrentPartidaCodigo] = useState('');
  const [livePartida, setLivePartida]   = useState<any>(null);
  const [participants, setParticipants] = useState<Usuario[]>([]);
  const [isCreator, setIsCreator]       = useState(false);
  const [creatingPartida, setCreatingPartida] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningMatch, setJoiningMatch] = useState(false);
  const [captains, setCaptains]         = useState<[string, string]>(['', '']);
  const [manualPicks, setManualPicks]   = useState<string[]>([]);
  const [coinLabel, setCoinLabel]       = useState('SORTEANDO CAPITÃES...');
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [sessionCode, setSessionCode]   = useState('');
  const [joiningCode, setJoiningCode]   = useState(false);
  const [isCapBranco, setIsCapBranco]   = useState(true);
  const [liveSession, setLiveSession]   = useState<any>(null);
  const [minhasPartidas, setMinhasPartidas] = useState<DbPartida[]>([]);
  const [loadingMinhas, setLoadingMinhas]   = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate]         = useState(new Date());
  const [matchDateDisplay, setMatchDateDisplay] = useState('');
  const [previewPartida, setPreviewPartida] = useState<any>(null);
  const [watchSession, setWatchSession]     = useState<any>(null);

  const coinSpin    = useRef(new Animated.Value(0)).current;
  const coinOpacity = useRef(new Animated.Value(1)).current;
  const partidaSub  = useRef<any>(null);
  const sessionSub  = useRef<any>(null);
  const watchSub    = useRef<any>(null);

  useEffect(() => {
    if (joinMatchCode) {
      setJoinCodeInput(joinMatchCode);
      onJoinHandled?.();
      fetchPreview(joinMatchCode);
    }
  }, [joinMatchCode]);

  useEffect(() => {
    if (phase !== 'schedule') return;
    async function loadMinhas() {
      setLoadingMinhas(true);
      const { data } = await supabase
        .from('partidas')
        .select('*')
        .contains('participantes', [usuario.id])
        .in('status', ['aberta', 'cheia'])
        .order('created_at', { ascending: false });
      if (data) setMinhasPartidas(data as DbPartida[]);
      setLoadingMinhas(false);
    }
    loadMinhas();
  }, [usuario.id, phase]);

  useEffect(() => {
    if (phase === 'share-code' && liveSession?.status === 'ativo') {
      setPhase('team-building-live');
    }
  }, [liveSession?.status, phase]);

  useEffect(() => {
    const count = (livePartida?.participantes ?? []).length;
    if (count === 14 && isCreator && phase === 'lobby') {
      Alert.alert(
        '🏆 Lista fechada!',
        'Os 14 jogadores confirmaram presença. Toque em ESCOLHER CAPITÃES para iniciar o sorteio.',
        [{ text: 'ESCOLHER CAPITÃES', onPress: () => { setManualPicks([]); setPhase('captain-mode'); } }, { text: 'Agora não' }]
      );
    }
  }, [(livePartida?.participantes ?? []).length, isCreator, phase]);

  async function subscribeToPartida(pid: string) {
    if (partidaSub.current) partidaSub.current.unsubscribe();
    partidaSub.current = supabase
      .channel('partida-' + pid)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'partidas', filter: 'id=eq.' + pid,
      }, async (payload: any) => {
        setLivePartida(payload.new);
        const parts: string[] = payload.new.participantes ?? [];
        if (parts.length > 0) {
          const { data } = await supabase.from('usuarios').select('*').in('id', parts);
          if (data) setParticipants(data as Usuario[]);
        }
      })
      .subscribe();
  }

  async function subscribeToSession(sid: string) {
    if (sessionSub.current) sessionSub.current.unsubscribe();
    sessionSub.current = supabase
      .channel('sessao-' + sid)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'sessoes_sorteio', filter: 'id=eq.' + sid,
      }, (payload: any) => { setLiveSession(payload.new); })
      .subscribe();
  }

  async function subscribeToWatchSession(sid: string) {
    if (watchSub.current) watchSub.current.unsubscribe();
    watchSub.current = supabase
      .channel('watch-sessao-' + sid)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'sessoes_sorteio', filter: 'id=eq.' + sid,
      }, (payload: any) => { setWatchSession(payload.new); })
      .subscribe();
  }

  async function checkAndWatchSorteio(pid: string, creatorId: string) {
    if (creatorId === usuario.id) return;
    const { data } = await supabase
      .from('sessoes_sorteio')
      .select('*')
      .eq('partida_id', pid)
      .maybeSingle();
    if (data) {
      setWatchSession(data);
      await subscribeToWatchSession(data.id);
      setPhase('watch-draw');
      return;
    }
    // Escuta INSERT caso o sorteio ainda não tenha começado
    if (watchSub.current) watchSub.current.unsubscribe();
    watchSub.current = supabase
      .channel('watch-insert-' + pid)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'sessoes_sorteio', filter: 'partida_id=eq.' + pid,
      }, async (payload: any) => {
        if (watchSub.current) watchSub.current.unsubscribe();
        setWatchSession(payload.new);
        await subscribeToWatchSession(payload.new.id);
        setPhase('watch-draw');
      })
      .subscribe();
  }

  async function criarPartida() {
    if (creatingPartida) return;
    setCreatingPartida(true);
    const { data, error } = await supabase
      .from('partidas')
      .insert({
        local: venue,
        data: matchDate,
        hora: (matchHour || '00') + ':' + (matchMinute || '00'),
        valor_individual: matchPrice ? parseFloat(matchPrice.replace(',', '.')) : null,
        participantes: [usuario.id],
        criado_por: usuario.id,
        status: 'aberta',
      })
      .select().single();
    setCreatingPartida(false);
    if (!data) { Alert.alert('Erro ao criar partida', error?.message ?? ''); return; }
    setCurrentPartidaId(data.id);
    setCurrentPartidaCodigo(data.codigo);
    setIsCreator(true);
    setLivePartida(data);
    const { data: uList } = await supabase.from('usuarios').select('*').in('id', [usuario.id]);
    if (uList) setParticipants(uList as Usuario[]);
    await subscribeToPartida(data.id);
    setPhase('lobby');
  }

  async function handleJoinByCode(code: string) {
    setJoiningMatch(true);
    const { data: partida } = await supabase
      .from('partidas').select('*').eq('codigo', code.toUpperCase()).single();
    if (!partida) {
      Alert.alert('Partida não encontrada', 'Verifique o código e tente novamente.');
      setJoiningMatch(false); setPhase('schedule'); return;
    }
    const alreadyIn = (partida.participantes ?? []).includes(usuario.id);
    const count = (partida.participantes ?? []).length;
    if (!alreadyIn && count >= 14) {
      Alert.alert('Partida cheia', 'Os 14 jogadores já confirmaram presença.');
      setJoiningMatch(false); setPhase('schedule'); return;
    }
    let finalPartida = partida;
    if (!alreadyIn) {
      const newParts = [...(partida.participantes ?? []), usuario.id];
      const newStatus = newParts.length >= 14 ? 'cheia' : 'aberta';
      const { data: upd } = await supabase
        .from('partidas').update({ participantes: newParts, status: newStatus })
        .eq('id', partida.id).select().single();
      finalPartida = upd ?? { ...partida, participantes: newParts, status: newStatus };
    }
    const parts: string[] = finalPartida.participantes ?? [];
    setCurrentPartidaId(finalPartida.id);
    setCurrentPartidaCodigo(finalPartida.codigo);
    setIsCreator(finalPartida.criado_por === usuario.id);
    setLivePartida(finalPartida);
    if (parts.length > 0) {
      const { data: uList } = await supabase.from('usuarios').select('*').in('id', parts);
      if (uList) setParticipants(uList as Usuario[]);
    }
    await subscribeToPartida(finalPartida.id);
    setJoiningMatch(false);
    setPhase('lobby');
    checkAndWatchSorteio(finalPartida.id, finalPartida.criado_por ?? '');
  }

  async function fetchPreview(code: string) {
    setJoiningMatch(true);
    const { data: partida } = await supabase
      .from('partidas').select('*').eq('codigo', code.toUpperCase()).single();
    setJoiningMatch(false);
    if (!partida) {
      Alert.alert('Partida não encontrada', 'Verifique o código e tente novamente.');
      setPhase('schedule'); return;
    }
    setPreviewPartida(partida);
    setJoinCodeInput(code.toUpperCase());
    setPhase('join-preview');
  }

  function launchCoin(caps: [string, string], label: string) {
    setCaptains(caps);
    setCoinLabel(label);
    setPhase('coin-flip');
    coinSpin.setValue(0); coinOpacity.setValue(1);
    Animated.sequence([
      Animated.timing(coinSpin, { toValue: 8, duration: 2200, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(coinOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(async () => {
      const pool = participants.filter(p => p.nome !== caps[0] && p.nome !== caps[1]).map(p => p.nome);
      const { data: sd, error: se } = await supabase.from('sessoes_sorteio').insert({
        local: livePartida?.local ?? venue,
        data: livePartida?.data ?? matchDate,
        hora: livePartida?.hora ?? ((matchHour || '00') + ':' + (matchMinute || '00')),
        valor: String(livePartida?.valor_individual ?? matchPrice ?? ''),
        players_pool: pool,
        time_branco: [caps[0]], time_preto: [caps[1]],
        capitao_branco: caps[0], capitao_preto: caps[1],
        turn: 0, status: 'aguardando', criado_por: usuario.id,
        partida_id: currentPartidaId,
      }).select().single();
      if (sd) {
        setSessionId(sd.id); setSessionCode(sd.codigo);
        setIsCapBranco(true); setLiveSession(sd);
        await subscribeToSession(sd.id);
        setPhase('share-code');
      } else { Alert.alert('Erro ao criar sessão', se?.message ?? ''); }
    });
  }

  function randomCaptains() {
    const pool = participants.map(p => p.nome ?? 'JOGADOR');
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    launchCoin([shuffled[0], shuffled[1]], 'SORTEANDO CAPITÃES...');
  }

  function confirmManualCaptains() {
    if (manualPicks.length !== 2) return;
    launchCoin([manualPicks[0], manualPicks[1]], 'PREPARANDO TIMES...');
  }

  const rotateY = coinSpin.interpolate({ inputRange: [0, 8], outputRange: ['0deg', '2880deg'] });

  function resetAll() {
    if (partidaSub.current) partidaSub.current.unsubscribe();
    if (sessionSub.current) sessionSub.current.unsubscribe();
    if (watchSub.current)   watchSub.current.unsubscribe();
    setPhase('schedule'); setVenue(''); setMatchDate(''); setMatchHour('');
    setMatchMinute(''); setMatchPrice(''); setCurrentPartidaId(null);
    setCurrentPartidaCodigo(''); setLivePartida(null); setParticipants([]);
    setIsCreator(false); setJoinCodeInput(''); setCaptains(['', '']);
    setManualPicks([]); setSessionId(null); setSessionCode(''); setLiveSession(null);
    setWatchSession(null);
  }

  async function reentrarPartida(partida: DbPartida) {
    // Busca dados frescos do Supabase — a lista cacheada pode estar desatualizada
    const { data: fresh } = await supabase.from('partidas').select('*').eq('id', partida.id).single();
    const p = fresh ?? partida;
    setCurrentPartidaId(p.id);
    setCurrentPartidaCodigo(p.codigo ?? '');
    setIsCreator(p.criado_por === usuario.id);
    setLivePartida(p);
    const parts: string[] = p.participantes ?? [];
    if (parts.length > 0) {
      const { data: uList } = await supabase.from('usuarios').select('*').in('id', parts);
      if (uList) setParticipants(uList as Usuario[]);
    }
    await subscribeToPartida(p.id);
    setPhase('lobby');
    checkAndWatchSorteio(p.id, p.criado_por ?? '');
  }

  // ── WATCH DRAW (jogadores não-capitães acompanham o sorteio) ──
  if (phase === 'watch-draw') {
    const sess        = watchSession ?? {};
    const liveBranco  = (sess.time_branco  ?? []) as string[];
    const livePreto   = (sess.time_preto   ?? []) as string[];
    const liveAvail   = (sess.players_pool ?? []) as string[];
    const isDone      = sess.status === 'concluido';
    const myName      = (usuario.nome ?? '').toUpperCase();
    const myTeam      = liveBranco.map((n: string) => n.toUpperCase()).includes(myName)
      ? 'BRANCO'
      : livePreto.map((n: string) => n.toUpperCase()).includes(myName)
        ? 'PRETO'
        : null;

    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.srTeamHeader}>
          <Image source={require('./assets/logo.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.clubName}>S.F.T.F.C.</Text>
            <View style={styles.starRow}>
              <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
              <Text style={styles.historyHeaderSub}>SORTEIO AO VIVO</Text>
              <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
            </View>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={resetAll}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {isDone && myTeam && (
            <View style={[styles.voteNewBadge, {
              backgroundColor: myTeam === 'BRANCO' ? '#e5e5e5' : '#1a1a1a',
              borderWidth: 2,
              borderColor: myTeam === 'BRANCO' ? COLORS.white : COLORS.gray,
              alignSelf: 'stretch',
              paddingVertical: 16,
              borderRadius: 12,
              marginBottom: 4,
            }]}>
              <Text style={[styles.voteNewBadgeText, {
                color: myTeam === 'BRANCO' ? '#111' : COLORS.white,
                fontSize: 18,
              }]}>
                ✅ VOCÊ ESTÁ NO TIME {myTeam}
              </Text>
            </View>
          )}

          <View style={styles.srTeamsRow}>
            <View style={[styles.srTeamCard, !isDone && sess.turn === 0 && styles.srTeamCardActive]}>
              <Text style={styles.srTeamLabel}>TIME</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.srTeamName}>BRANCO</Text>
                <View style={styles.srTeamBadge}><Text style={styles.srTeamBadgeText}>{liveBranco.length}</Text></View>
              </View>
              {liveBranco.map((name: string, i: number) => (
                <View key={name} style={[styles.srTeamPlayerRow,
                  name.toUpperCase() === myName && { backgroundColor: '#ffffff22', borderRadius: 4 }]}>
                  {i === 0 && <Text style={{ fontSize: 9 }}>👑</Text>}
                  <Text style={[styles.srTeamPlayerName, name.toUpperCase() === myName && { color: COLORS.white, fontWeight: '800' }]} numberOfLines={1}>
                    {name}{i === 0 ? ' CAP.' : ''}
                  </Text>
                  {name.toUpperCase() === myName && <Text style={{ fontSize: 10, color: COLORS.green }}> ◀ você</Text>}
                </View>
              ))}
            </View>

            <View style={[styles.srTeamCard, styles.srTeamCardDark, !isDone && sess.turn === 1 && styles.srTeamCardActive]}>
              <Text style={styles.srTeamLabel}>TIME</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.srTeamName}>PRETO</Text>
                <View style={styles.srTeamBadge}><Text style={styles.srTeamBadgeText}>{livePreto.length}</Text></View>
              </View>
              {livePreto.map((name: string, i: number) => (
                <View key={name} style={[styles.srTeamPlayerRow,
                  name.toUpperCase() === myName && { backgroundColor: '#ffffff22', borderRadius: 4 }]}>
                  {i === 0 && <Text style={{ fontSize: 9 }}>👑</Text>}
                  <Text style={[styles.srTeamPlayerName, name.toUpperCase() === myName && { color: COLORS.white, fontWeight: '800' }]} numberOfLines={1}>
                    {name}{i === 0 ? ' CAP.' : ''}
                  </Text>
                  {name.toUpperCase() === myName && <Text style={{ fontSize: 10, color: COLORS.green }}> ◀ você</Text>}
                </View>
              ))}
            </View>
          </View>

          {!isDone && (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
              <ActivityIndicator color={COLORS.blue} />
              <Text style={styles.historyHeaderSub}>
                Vez do cap. {sess.turn === 0 ? sess.capitao_branco : sess.capitao_preto} escolher…
              </Text>
              <Text style={[styles.voteNewDesc, { textAlign: 'center' }]}>
                {liveAvail.length} jogador{liveAvail.length !== 1 ? 'es' : ''} restante{liveAvail.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {isDone && (
            <View style={{ alignItems: 'center', gap: 16, paddingVertical: 20 }}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
              <Text style={[styles.historyHeaderTitle, { textAlign: 'center' }]}>TIMES FORMADOS!</Text>
              {!myTeam && (
                <Text style={[styles.voteNewDesc, { textAlign: 'center', color: COLORS.gray }]}>
                  Você não foi encontrado em nenhum time (verifique seu nome no perfil).
                </Text>
              )}
              <Pressable style={[styles.srCTABtn, { width: '100%' }]} onPress={resetAll}>
                <Text style={styles.srCTABtnText}>↩  VOLTAR PARA AGENDA</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── SCHEDULE ──
  if (phase === 'schedule') {
    const VENUES = [
      { id: 'ARENA',            icon: '🏟️' },
      { id: 'MECA SPORTS',      icon: '⚽' },
      { id: 'MCM BIG SERTÓRIO', icon: '🏢' },
    ];
    const canCreate = !!venue && matchDate.trim().length >= 8 && matchPrice.trim() !== '';
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View>
            <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
            <Text style={styles.historyHeaderTitle}>AGENDAMENTO</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.historyScroll, { paddingBottom: 180 }]} showsVerticalScrollIndicator={false}>
          {loadingMinhas ? (
            <ActivityIndicator color={COLORS.blue} style={{ marginTop: 8, marginBottom: 8 }} />
          ) : minhasPartidas.length > 0 ? (
            <>
              <Text style={styles.srSectionLabel}>MINHAS PARTIDAS EM ANDAMENTO</Text>
              {minhasPartidas.map(p => (
                <Pressable key={p.id} style={styles.matchCard} onPress={() => reentrarPartida(p)}>
                  <View style={styles.matchTopRow}>
                    <Text style={styles.matchCompetition}>{(p.local ?? '').toUpperCase()}</Text>
                    <Text style={styles.matchDate}>{p.data} · {p.hora}</Text>
                  </View>
                  <View style={styles.matchSep} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.matchTeamSFTFC}>CÓDIGO: {p.codigo}</Text>
                    <Text style={[styles.matchDate, { color: COLORS.green }]}>
                      {(p.participantes ?? []).length}/14 jogadores
                    </Text>
                  </View>
                  <Text style={[styles.matchDate, { textAlign: 'right', marginTop: 4, color: COLORS.blue }]}>
                    Toque para voltar ao lobby →
                  </Text>
                </Pressable>
              ))}
              <View style={[styles.matchSep, { marginVertical: 12 }]} />
            </>
          ) : null}
          <Text style={styles.srSectionLabel}>ESCOLHER LOCAL</Text>
          {VENUES.map(v => (
            <Pressable key={v.id} style={[styles.srVenueBtn, venue === v.id && styles.srVenueBtnActive]} onPress={() => setVenue(v.id)}>
              <Text style={styles.srVenueIcon}>{v.icon}</Text>
              <Text style={[styles.srVenueLabel, venue === v.id && styles.srVenueLabelActive]}>{v.id}</Text>
              {venue === v.id && <Text style={styles.srVenueCheck}>✓</Text>}
            </Pressable>
          ))}
          <Text style={[styles.srSectionLabel, { marginTop: 18 }]}>DATA DO JOGO</Text>
          <Pressable style={styles.srInputField} onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}>
            <Text style={styles.srInputIcon}>📅</Text>
            <Text style={[styles.srInputText, { color: matchDateDisplay ? COLORS.white : COLORS.gray }]}>
              {matchDateDisplay || 'Selecionar data'}
            </Text>
          </Pressable>
          {showDatePicker && (
            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 12, marginTop: 8, overflow: 'hidden' }}>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                themeVariant="dark"
                minimumDate={new Date()}
                locale="pt-BR"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setPickerDate(selectedDate);
                    const d = selectedDate;
                    const day   = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year  = d.getFullYear();
                    setMatchDate(`${year}-${month}-${day}`);
                    setMatchDateDisplay(`${day}/${month}/${year}`);
                  }
                }}
              />
              <Pressable onPress={() => setShowDatePicker(false)}
                style={{ marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, backgroundColor: COLORS.blue, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', letterSpacing: 2 }}>OK</Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.srSectionLabel, { marginTop: 24 }]}>HORÁRIO DO JOGO</Text>
          <Pressable style={styles.srInputField} onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}>
            <Text style={styles.srInputIcon}>🕐</Text>
            <Text style={[styles.srInputText, { color: (matchHour || matchMinute) ? COLORS.white : COLORS.gray }]}>
              {matchHour || matchMinute ? `${matchHour || '00'}:${matchMinute || '00'}` : 'Selecionar horário'}
            </Text>
          </Pressable>
          {showTimePicker && (
            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 12, marginTop: 8, overflow: 'hidden' }}>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                themeVariant="dark"
                is24Hour={true}
                locale="pt-BR"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setPickerDate(selectedDate);
                    setMatchHour(String(selectedDate.getHours()).padStart(2, '0'));
                    setMatchMinute(String(selectedDate.getMinutes()).padStart(2, '0'));
                  }
                }}
              />
              <Pressable onPress={() => setShowTimePicker(false)}
                style={{ marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, backgroundColor: COLORS.blue, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', letterSpacing: 2 }}>OK</Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.srSectionLabel, { marginTop: 18 }]}>VALOR INDIVIDUAL</Text>
          <View style={styles.srPriceRow}>
            <Text style={styles.srPricePrefix}>R$</Text>
            <TextInput style={styles.srPriceInput} placeholder="0,00" placeholderTextColor={COLORS.gray}
              keyboardType="numeric" value={matchPrice} onChangeText={setMatchPrice} />
          </View>
        </ScrollView>
        <View style={[styles.srCTABar, { gap: 10 }]}>
          <Pressable style={[styles.srCTABtn, (!canCreate || creatingPartida) && styles.srCTABtnOff]}
            onPress={() => canCreate && criarPartida()} disabled={!canCreate || creatingPartida}>
            {creatingPartida
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={[styles.srCTABtnText, !canCreate && { color: '#444' }]}>CRIAR PARTIDA  →</Text>
            }
          </Pressable>
          <Pressable style={[styles.srCTABtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.blue }]}
            onPress={() => { setJoinCodeInput(''); setPhase('join-lobby'); }}>
            <Text style={[styles.srCTABtnText, { color: COLORS.blue }]}>🔗  ENTRAR COM CÓDIGO</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── LOBBY ──
  if (phase === 'lobby') {
    const live    = livePartida ?? {};
    const count   = ((live.participantes ?? []) as string[]).length;
    const isFull  = count >= 14;
    const canStart = isCreator && isFull;
    const shareMsg = `🏆 S.F.T.F.C. — Jogo em ${live.local ?? venue}\n📅 ${live.data ?? matchDate}  🕐 ${live.hora ?? ''}\n💰 R$ ${live.valor_individual ?? matchPrice} · ${count}/14 jogadores\n\nPara confirmar presença:\n1. Abra o app S.F.T.F.C.\n2. Vá em AGENDA\n3. Digite o código:  ${currentPartidaCodigo}`;
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.historyHeaderSub}>{live.local ?? venue}</Text>
            <Text style={[styles.historyHeaderTitle, { fontSize: 20 }]}>AGUARDANDO JOGADORES</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={resetAll}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.historyScroll, { paddingBottom: 180 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.srMatchSummary}>
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>🏟️</Text>
              <Text style={styles.srMatchSummaryText}>{live.local ?? venue}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>📅</Text>
              <Text style={styles.srMatchSummaryText}>{live.data ?? matchDate}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>🕐</Text>
              <Text style={styles.srMatchSummaryText}>{live.hora ?? ''}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>💰</Text>
              <Text style={[styles.srMatchSummaryText, { color: COLORS.green }]}>R$ {live.valor_individual ?? matchPrice}</Text>
            </View>
          </View>
          <View style={[styles.srCodeBox, { marginBottom: 16 }]}>
            <Text style={[styles.srCodeText, { fontSize: 30, letterSpacing: 6 }]}>{currentPartidaCodigo}</Text>
          </View>
          <View style={styles.srCountRow}>
            <Text style={styles.srCountIcon}>👥</Text>
            <Text style={styles.srCountLabel}>Jogadores confirmados</Text>
            <Text style={[styles.srCountNum, { color: isFull ? COLORS.green : COLORS.yellow }]}>{count}/14</Text>
          </View>
          <View style={styles.srGrid}>
            {participants.map((p, i) => (
              <View key={p.id} style={[styles.srPlayerBtn, styles.srPlayerBtnOn]}>
                <Text style={styles.srCheck}>✓</Text>
                <Text style={[styles.srPlayerName, styles.srPlayerNameOn]} numberOfLines={1}>
                  {(p.nome ?? 'JOGADOR').toUpperCase()}
                </Text>
                {i === 0 && <Text style={[styles.srCapTag, { color: COLORS.yellow }]}>👑</Text>}
              </View>
            ))}
            {Array.from({ length: Math.max(0, 14 - count) }).map((_, i) => (
              <View key={'vaga-' + i} style={[styles.srPlayerBtn, { opacity: 0.25 }]}>
                <Text style={styles.srPlayerName}>VAGA {count + i + 1}</Text>
              </View>
            ))}
          </View>
          {isFull && (
            <View style={[styles.voteNewBadge, { backgroundColor: COLORS.green, alignSelf: 'center', marginTop: 8 }]}>
              <Text style={styles.voteNewBadgeText}>🏆 PARTIDA COMPLETA!</Text>
            </View>
          )}
        </ScrollView>
        <View style={[styles.srCTABar, { gap: 10 }]}>
          <Pressable style={[styles.srCTABtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.blue }]}
            onPress={() => Share.share({ message: shareMsg, title: 'S.F.T.F.C. - Partida' })}>
            <Text style={[styles.srCTABtnText, { color: COLORS.blue }]}>📤  COMPARTILHAR LINK</Text>
          </Pressable>
          {canStart && (
            <Pressable style={styles.srCTABtn} onPress={() => { setManualPicks([]); setPhase('captain-mode'); }}>
              <Text style={styles.srCTABtnText}>⚽  ESCOLHER CAPITÃES</Text>
            </Pressable>
          )}
          {!canStart && isCreator && (
            <Text style={[styles.voteNewDesc, { textAlign: 'center', color: COLORS.gray }]}>
              Aguardando {14 - count} jogador{14 - count !== 1 ? 'es' : ''} para fechar a lista
            </Text>
          )}
          {!isCreator && !isFull && (
            <Text style={[styles.voteNewDesc, { textAlign: 'center', color: COLORS.gray }]}>
              Aguardando fechar os 14 jogadores…
            </Text>
          )}
          {!isCreator && isFull && (
            <Text style={[styles.voteNewDesc, { textAlign: 'center', color: COLORS.yellow }]}>
              Lista fechada! Aguardando o organizador iniciar o sorteio.
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── JOIN PREVIEW ──
  if (phase === 'join-preview') {
    const p = previewPartida;
    const previewCount = (p?.participantes ?? []).length;
    const isFull = previewCount >= 14;
    const alreadyIn = (p?.participantes ?? []).includes(usuario.id);
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
            <Text style={styles.historyHeaderTitle}>DETALHES DA PARTIDA</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={() => setPhase('schedule')}>
            <Text style={styles.logoutText}>← VOLTAR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.historyScroll, { paddingBottom: 160 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.srMatchSummary}>
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>🏟️</Text>
              <Text style={styles.srMatchSummaryText}>{p?.local ?? '-'}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>📅</Text>
              <Text style={styles.srMatchSummaryText}>{p?.data ?? '-'}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>🕐</Text>
              <Text style={styles.srMatchSummaryText}>{p?.hora ?? '-'}</Text>
            </View>
            <View style={styles.srMatchSummaryDivider} />
            <View style={styles.srMatchSummaryItem}>
              <Text style={styles.srMatchSummaryIcon}>💰</Text>
              <Text style={[styles.srMatchSummaryText, { color: COLORS.green }]}>R$ {p?.valor_individual ?? '-'}</Text>
            </View>
          </View>
          <View style={styles.srCountRow}>
            <Text style={styles.srCountIcon}>👥</Text>
            <Text style={styles.srCountLabel}>Jogadores confirmados</Text>
            <Text style={[styles.srCountNum, { color: isFull ? COLORS.red : COLORS.green }]}>{previewCount}/14</Text>
          </View>
          {alreadyIn && (
            <View style={[styles.voteNewBadge, { backgroundColor: COLORS.green, alignSelf: 'center', marginTop: 8 }]}>
              <Text style={styles.voteNewBadgeText}>✓ VOCÊ JÁ ESTÁ NA LISTA</Text>
            </View>
          )}
          {isFull && !alreadyIn && (
            <View style={[styles.voteNewBadge, { backgroundColor: COLORS.red, alignSelf: 'center', marginTop: 8 }]}>
              <Text style={styles.voteNewBadgeText}>PARTIDA CHEIA</Text>
            </View>
          )}
        </ScrollView>
        <View style={[styles.srCTABar, { gap: 10 }]}>
          {!isFull && !alreadyIn && (
            <Pressable
              style={[styles.srCTABtn, joiningMatch && styles.srCTABtnOff]}
              onPress={() => handleJoinByCode(joinCodeInput)}
              disabled={joiningMatch}>
              {joiningMatch
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.srCTABtnText}>✅  CONFIRMAR PRESENÇA</Text>
              }
            </Pressable>
          )}
          {alreadyIn && (
            <Pressable style={styles.srCTABtn} onPress={() => handleJoinByCode(joinCodeInput)}>
              <Text style={styles.srCTABtnText}>↩  VOLTAR AO LOBBY</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.srCTABtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }]}
            onPress={() => setPhase('schedule')}>
            <Text style={[styles.srCTABtnText, { color: COLORS.gray }]}>RECUSAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── JOIN LOBBY ──
  if (phase === 'join-lobby') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <StatusBar style="light" />
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />
        <Image source={require('./assets/logo.png')} style={{ width: 72, height: 72, marginBottom: 20 }} resizeMode="contain" />
        <Text style={[styles.clubName, { marginBottom: 4 }]}>ENTRAR NA PARTIDA</Text>
        <Text style={[styles.historyHeaderSub, { marginBottom: 32, textAlign: 'center' }]}>
          Digite o código enviado pelo organizador
        </Text>
        <TextInput style={styles.srCodeInput} placeholder="XXXXXXXX" placeholderTextColor={COLORS.gray}
          autoCapitalize="characters" maxLength={8} value={joinCodeInput}
          onChangeText={t => setJoinCodeInput(t.toUpperCase())} />
        <Pressable
          style={[styles.srCTABtn, { width: '100%', marginTop: 24 },
            (joinCodeInput.length < 6 || joiningMatch) && styles.srCTABtnOff]}
          onPress={() => { if (joinCodeInput.length >= 6 && !joiningMatch) fetchPreview(joinCodeInput); }}
          disabled={joinCodeInput.length < 6 || joiningMatch}>
          {joiningMatch
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={[styles.srCTABtnText, joinCodeInput.length < 6 && { color: '#444' }]}>VER PARTIDA  →</Text>
          }
        </Pressable>
        <Pressable style={{ marginTop: 24 }} onPress={() => setPhase('schedule')}>
          <Text style={styles.srModeBack}>← VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  // ── CAPTAIN MODE ──
  if (phase === 'captain-mode') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <StatusBar style="light" />
        <Image source={require('./assets/logo.png')} style={{ width: 88, height: 88, marginBottom: 20 }} resizeMode="contain" />
        <Text style={[styles.clubName, { marginBottom: 6 }]}>S.F.T.F.C.</Text>
        <View style={[styles.starRow, { marginBottom: 44 }]}>
          <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
          <Text style={styles.historyHeaderSub}>SORTEIO FUT 7 · {participants.length} jogadores</Text>
          <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
        </View>
        <Text style={styles.srModeTitle}>COMO ESCOLHER OS CAPITÃES?</Text>
        <Pressable style={({ pressed }) => [styles.srModeBtn, pressed && { opacity: 0.85 }]} onPress={randomCaptains}>
          <Text style={styles.srModeBtnIcon}>🎲</Text>
          <View>
            <Text style={styles.srModeBtnTitle}>SORTEAR</Text>
            <Text style={styles.srModeBtnSub}>Sorteio aleatório automático</Text>
          </View>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.srModeBtn, styles.srModeBtnAlt, pressed && { opacity: 0.85 }]}
          onPress={() => { setManualPicks([]); setPhase('manual-captain'); }}>
          <Text style={styles.srModeBtnIcon}>👑</Text>
          <View>
            <Text style={[styles.srModeBtnTitle, { color: COLORS.white }]}>ESCOLHER</Text>
            <Text style={styles.srModeBtnSub}>Selecionar manualmente</Text>
          </View>
        </Pressable>
        <Pressable style={{ marginTop: 24 }} onPress={() => setPhase('lobby')}>
          <Text style={styles.srModeBack}>← VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  // ── MANUAL CAPTAIN ──
  if (phase === 'manual-captain') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.historyHeaderBar}>
          <View>
            <Text style={styles.historyHeaderSub}>ESCOLHER CAPITÃES</Text>
            <Text style={styles.historyHeaderTitle}>{manualPicks.length}/2 SELECIONADOS</Text>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={() => setPhase('captain-mode')}>
            <Text style={styles.logoutText}>VOLTAR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.historyScroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.voteNewDesc, { marginBottom: 16 }]}>Toque em 2 jogadores para serem capitães</Text>
          <View style={styles.srGrid}>
            {participants.map(p => {
              const nome = p.nome ?? 'JOGADOR';
              const idx  = manualPicks.indexOf(nome);
              const sel  = idx !== -1;
              return (
                <Pressable key={p.id}
                  style={[styles.srPlayerBtn, idx === 0 && styles.srCap1Btn, idx === 1 && styles.srCap2Btn]}
                  onPress={() => {
                    if (sel) setManualPicks(prev => prev.filter(x => x !== nome));
                    else if (manualPicks.length < 2) setManualPicks(prev => [...prev, nome]);
                  }}>
                  <Text style={styles.srCheck}>{sel ? '👑' : ' '}</Text>
                  <Text style={[styles.srPlayerName, sel && styles.srPlayerNameOn, { flex: 1 }]}>{nome.toUpperCase()}</Text>
                  {idx === 0 && <Text style={[styles.srCapTag, { color: COLORS.blue }]}>C1</Text>}
                  {idx === 1 && <Text style={[styles.srCapTag, { color: COLORS.red  }]}>C2</Text>}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.srCTABar}>
          <Pressable style={[styles.srCTABtn, manualPicks.length !== 2 && styles.srCTABtnOff]} onPress={confirmManualCaptains}>
            <Text style={[styles.srCTABtnText, manualPicks.length !== 2 && { color: '#444' }]}>✓  CONFIRMAR CAPITÃES</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── COIN FLIP ──
  if (phase === 'coin-flip') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" />
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />
        <Image source={require('./assets/logo.png')} style={{ width: 88, height: 88, marginBottom: 16 }} resizeMode="contain" />
        <Text style={[styles.clubName, { marginBottom: 4 }]}>S.F.T.F.C.</Text>
        <View style={[styles.starRow, { marginBottom: 56 }]}>
          <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
          <Text style={styles.historyHeaderSub}>SORTEIO FUT 7</Text>
          <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
        </View>
        <Animated.View style={[styles.srCoinWrapper, { opacity: coinOpacity }]}>
          <Animated.Image source={require('./assets/logo.png')}
            style={[styles.srCoinImage, { transform: [{ perspective: 600 }, { rotateY }] }]}
            resizeMode="contain" />
        </Animated.View>
        <Text style={styles.srCoinText}>{coinLabel}</Text>
        <View style={[styles.starRow, { marginTop: 20 }]}>
          <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
          <Text style={styles.historyHeaderSub}>S.F.T.F.C.</Text>
          <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
        </View>
      </View>
    );
  }

  // ── SHARE CODE (captain 1 — branco) ──
  if (phase === 'share-code') {
    const waiting = liveSession?.status === 'aguardando';
    const shareMsg2 = 'S.F.T.F.C. — Sorteio dos times! Capitão Preto: ' + (liveSession?.capitao_preto ?? '') +
      '\nCódigo do sorteio: ' + sessionCode + '\nAbra o app → AGENDA → ENTRAR COM CÓDIGO';
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <StatusBar style="light" />
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />
        <Image source={require('./assets/logo.png')} style={{ width: 72, height: 72, marginBottom: 20 }} resizeMode="contain" />
        <Text style={[styles.clubName, { marginBottom: 4 }]}>SORTEIO AO VIVO</Text>
        <Text style={[styles.historyHeaderSub, { marginBottom: 24, textAlign: 'center' }]}>
          Você é o Capitão Branco · Envie o código para o Capitão Preto
        </Text>
        <View style={styles.srCodeBox}>
          <Text style={styles.srCodeText}>{sessionCode}</Text>
        </View>
        <Pressable style={[styles.srCTABtn, { marginTop: 16, backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.blue }]}
          onPress={() => Share.share({ message: shareMsg2, title: 'Sorteio S.F.T.F.C.' })}>
          <Text style={[styles.srCTABtnText, { color: COLORS.blue }]}>📤  COMPARTILHAR CÓDIGO</Text>
        </Pressable>
        <Text style={[styles.voteNewDesc, { textAlign: 'center', marginTop: 12, marginBottom: 24 }]}>
          {liveSession?.capitao_preto ?? ''}: AGENDA → ENTRAR COM CÓDIGO → digita o código acima
        </Text>
        {waiting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={COLORS.blue} />
            <Text style={styles.historyHeaderSub}>Aguardando Capitão Preto…</Text>
          </View>
        ) : (
          <Pressable style={[styles.srCTABtn, { width: '100%' }]} onPress={() => setPhase('team-building-live')}>
            <Text style={styles.srCTABtnText}>⚡  INICIAR SORTEIO</Text>
          </Pressable>
        )}
        <Pressable style={{ marginTop: 20 }} onPress={resetAll}>
          <Text style={styles.srModeBack}>← CANCELAR</Text>
        </Pressable>
      </View>
    );
  }

  // ── JOIN CODE (captain 2 — preto) ──
  if (phase === 'join-code') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <StatusBar style="light" />
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />
        <Image source={require('./assets/logo.png')} style={{ width: 72, height: 72, marginBottom: 20 }} resizeMode="contain" />
        <Text style={[styles.clubName, { marginBottom: 4 }]}>CAPITÃO PRETO</Text>
        <Text style={[styles.historyHeaderSub, { marginBottom: 32, textAlign: 'center' }]}>
          Digite o código do sorteio enviado pelo Capitão Branco
        </Text>
        <TextInput style={styles.srCodeInput} placeholder="XXXXXX" placeholderTextColor={COLORS.gray}
          autoCapitalize="characters" maxLength={6} value={joinCodeInput}
          onChangeText={t => setJoinCodeInput(t.toUpperCase())} />
        <Pressable
          style={[styles.srCTABtn, { width: '100%', marginTop: 24 },
            (joinCodeInput.length < 6 || joiningCode) && styles.srCTABtnOff]}
          onPress={async () => {
            if (joinCodeInput.length < 6 || joiningCode) return;
            setJoiningCode(true);
            const { data } = await supabase.from('sessoes_sorteio').select('*').eq('codigo', joinCodeInput).single();
            if (!data) { Alert.alert('Código não encontrado', 'Verifique o código.'); setJoiningCode(false); return; }
            await supabase.from('sessoes_sorteio').update({ status: 'ativo' }).eq('id', data.id);
            setSessionId(data.id); setSessionCode(data.codigo);
            setIsCapBranco(false); setLiveSession({ ...data, status: 'ativo' });
            await subscribeToSession(data.id);
            setJoiningCode(false); setPhase('team-building-live');
          }}
          disabled={joinCodeInput.length < 6 || joiningCode}>
          {joiningCode
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={[styles.srCTABtnText, joinCodeInput.length < 6 && { color: '#444' }]}>ENTRAR  →</Text>
          }
        </Pressable>
        <Pressable style={{ marginTop: 24 }} onPress={() => setPhase('lobby')}>
          <Text style={styles.srModeBack}>← VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  // ── TEAM BUILDING LIVE ──
  if (phase === 'team-building-live') {
    const sess       = liveSession ?? {};
    const liveBranco = (sess.time_branco  ?? []) as string[];
    const livePreto  = (sess.time_preto   ?? []) as string[];
    const livePool   = (sess.players_pool ?? []) as string[];
    const liveTurn   = (sess.turn ?? 0)   as number;
    const liveStatus = sess.status ?? 'ativo';
    const myTurn     = isCapBranco ? liveTurn === 0 : liveTurn === 1;
    const liveAvail  = livePool.filter((p: string) => !liveBranco.includes(p) && !livePreto.includes(p));
    const isDone     = liveAvail.length === 0 || liveStatus === 'concluido';

    async function livePickPlayer(name: string) {
      if (!sessionId || !myTurn) return;
      const newBranco = liveTurn === 0 ? [...liveBranco, name] : liveBranco;
      const newPreto  = liveTurn === 1 ? [...livePreto,  name] : livePreto;
      const newPool   = livePool.filter((p: string) => p !== name);
      const newTurn   = liveTurn === 0 ? 1 : 0;
      const avail2    = newPool.filter((p: string) => !newBranco.includes(p) && !newPreto.includes(p));
      const done      = avail2.length === 0;
      const { data } = await supabase.from('sessoes_sorteio').update({
        time_branco: newBranco, time_preto: newPreto,
        players_pool: newPool, turn: newTurn,
        status: done ? 'concluido' : 'ativo',
      }).eq('id', sessionId).select().single();
      if (data) setLiveSession(data);
    }

    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.srTeamHeader}>
          <Image source={require('./assets/logo.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.clubName}>S.F.T.F.C.</Text>
            <View style={styles.starRow}>
              <Text style={[styles.star, { color: COLORS.blue }]}>★</Text>
              <Text style={styles.historyHeaderSub}>SORTEIO AO VIVO</Text>
              <Text style={[styles.star, { color: COLORS.red }]}>★</Text>
            </View>
          </View>
          <Pressable style={styles.historyLogoutBtn} onPress={resetAll}>
            <Text style={styles.logoutText}>SAIR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.srTeamsRow}>
            <View style={[styles.srTeamCard, liveTurn === 0 && !isDone && styles.srTeamCardActive]}>
              <Text style={styles.srTeamLabel}>TIME</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.srTeamName}>BRANCO</Text>
                <View style={styles.srTeamBadge}><Text style={styles.srTeamBadgeText}>{liveBranco.length}</Text></View>
              </View>
              {liveBranco.map((p: string, i: number) => (
                <View key={p} style={styles.srTeamPlayerRow}>
                  {i === 0 && <Text style={{ fontSize: 9 }}>👑</Text>}
                  <Text style={styles.srTeamPlayerName} numberOfLines={1}>{p}{i === 0 ? ' CAP.' : ''}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.srTeamCard, styles.srTeamCardDark, liveTurn === 1 && !isDone && styles.srTeamCardActive]}>
              <Text style={styles.srTeamLabel}>TIME</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.srTeamName}>PRETO</Text>
                <View style={styles.srTeamBadge}><Text style={styles.srTeamBadgeText}>{livePreto.length}</Text></View>
              </View>
              {livePreto.map((p: string, i: number) => (
                <View key={p} style={styles.srTeamPlayerRow}>
                  {i === 0 && <Text style={{ fontSize: 9 }}>👑</Text>}
                  <Text style={styles.srTeamPlayerName} numberOfLines={1}>{p}{i === 0 ? ' CAP.' : ''}</Text>
                </View>
              ))}
            </View>
          </View>
          {!isDone && (
            <>
              <View style={styles.srTurnBar}>
                <Text style={styles.srTurnLabel}>VEZ DE ESCOLHER</Text>
                <View style={styles.srTurnBtn}>
                  <Text style={{ fontSize: 16 }}>👑</Text>
                  <Text style={styles.srTurnName}>
                    {myTurn ? 'SUA VEZ!' : 'CAP. ' + (liveTurn === 0 ? sess.capitao_branco : sess.capitao_preto)}
                  </Text>
                </View>
              </View>
              {myTurn ? (
                <>
                  <Text style={[styles.srCountLabel, { textAlign: 'center', flex: 0 }]}>ESCOLHA UM JOGADOR</Text>
                  <View style={styles.srGrid}>
                    {liveAvail.map((name: string) => (
                      <Pressable key={name} style={({ pressed }) => [styles.srAvailBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => livePickPlayer(name)}>
                        <Text style={styles.srAvailName}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
                  <ActivityIndicator color={COLORS.blue} />
                  <Text style={styles.historyHeaderSub}>Aguardando o outro capitão escolher…</Text>
                </View>
              )}
            </>
          )}
          {isDone && (
            <View style={{ alignItems: 'center', gap: 16, paddingVertical: 20 }}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
              <Text style={[styles.historyHeaderTitle, { textAlign: 'center' }]}>TIMES FORMADOS!</Text>
              <Pressable style={({ pressed }) => [styles.srCTABtn, { width: '100%' }, pressed && { opacity: 0.85 }]} onPress={resetAll}>
                <Text style={styles.srCTABtnText}>↺  NOVO SORTEIO</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ─── Barra de Navegação Inferior ─────────────────────────────────
function BottomTabBar({
  active,
  onTab,
}: {
  active: 'profile' | 'formation' | 'history' | 'voting' | 'sorteio';
  onTab: (tab: 'profile' | 'formation' | 'history' | 'voting' | 'sorteio') => void;
}) {
  return (
    <View style={styles.tabBar}>
      <Pressable style={styles.tabItem} onPress={() => onTab('profile')}>
        <Text style={styles.tabIcon}>👤</Text>
        <Text style={[styles.tabLabel, active === 'profile' && styles.tabLabelActive]}>
          PERFIL
        </Text>
        {active === 'profile' && <View style={styles.tabActiveDot} />}
      </Pressable>
      <Pressable style={styles.tabItem} onPress={() => onTab('formation')}>
        <Text style={styles.tabIcon}>⚽</Text>
        <Text style={[styles.tabLabel, active === 'formation' && styles.tabLabelActive]}>
          FORMAÇÃO
        </Text>
        {active === 'formation' && <View style={styles.tabActiveDot} />}
      </Pressable>
      <Pressable style={styles.tabItem} onPress={() => onTab('history')}>
        <Text style={styles.tabIcon}>📋</Text>
        <Text style={[styles.tabLabel, active === 'history' && styles.tabLabelActive]}>
          HISTÓRICO
        </Text>
        {active === 'history' && <View style={styles.tabActiveDot} />}
      </Pressable>
      <Pressable style={styles.tabItem} onPress={() => onTab('sorteio')}>
        <Text style={styles.tabIcon}>📅</Text>
        <Text style={[styles.tabLabel, active === 'sorteio' && styles.tabLabelActive]}>
          AGENDA
        </Text>
        {active === 'sorteio' && <View style={styles.tabActiveDot} />}
      </Pressable>
    </View>
  );
}

// ─── App Root ────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]       = useState<Session | null>(null);
  const [usuario, setUsuario]       = useState<Usuario | null>(null);
  const [loading, setLoading]       = useState(true);
  const [screen, setScreen]         = useState<'profile' | 'formation' | 'history' | 'voting' | 'sorteio'>('profile');
  const [joinMatchCode, setJoinMatchCode] = useState<string | null>(null);
  const [hasPendingVote, setHasPendingVote] = useState(false);

  async function checkPendingVote(uid: string) {
    const { data: partidas } = await supabase
      .from('partidas')
      .select('id, time_branco, time_preto')
      .not('resultado', 'is', null)
      .order('data', { ascending: false })
      .limit(5);
    if (!partidas) return;
    for (const p of partidas) {
      const isPlayer = p.time_branco?.includes(uid) || p.time_preto?.includes(uid);
      if (!isPlayer) continue;
      const { data: jaVotou } = await supabase
        .from('votacoes').select('id')
        .eq('partida_id', p.id).eq('votante_id', uid).limit(1);
      if (!jaVotou || jaVotou.length === 0) { setHasPendingVote(true); return; }
    }
    setHasPendingVote(false);
  }

  async function loadUsuario(userId: string) {
    const { data } = await supabase.from('usuarios').select('*').eq('id', userId).single();
    if (data) setUsuario(data as Usuario);
    checkPendingVote(userId);
    setLoading(false);
  }

  function processLink(url: string) {
    const match = url.match(/partida[/=]([A-Z0-9]{6,8})/i);
    if (match) {
      setJoinMatchCode(match[1].toUpperCase());
      setScreen('sorteio');
    }
  }

  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) processLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => processLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUsuario(s.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadUsuario(s.user.id);
      else { setUsuario(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.blue} size="large" />
        <Text style={[styles.historyHeaderSub, { marginTop: 16 }]}>S.F.T.F.C.</Text>
      </View>
    );
  }

  if (!session || !usuario) {
    return <LoginScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {screen === 'profile' && (
        <ProfileScreen
          usuario={usuario}
          onLogout={handleLogout}
          onUsuarioUpdate={setUsuario}
          hasPendingVote={hasPendingVote}
          onOpenVoting={() => setScreen('voting')}
        />
      )}
      {screen === 'formation' && (
        <FormationScreen usuario={usuario} onLogout={handleLogout} />
      )}
      {screen === 'history' && (
        <MatchHistoryScreen usuario={usuario} onLogout={handleLogout} />
      )}
      {screen === 'voting' && (
        <VotingScreen
          usuario={usuario}
          onLogout={handleLogout}
          onVoteComplete={() => { checkPendingVote(usuario.id); setScreen('profile'); }}
        />
      )}
      {screen === 'sorteio' && (
        <SorteioScreen
          usuario={usuario}
          onLogout={handleLogout}
          joinMatchCode={joinMatchCode}
          onJoinHandled={() => setJoinMatchCode(null)}
        />
      )}
      <BottomTabBar active={screen} onTab={setScreen} />
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  glowOuter: {
    position: 'absolute',
    top: -80,
    left: '50%',
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glowInner: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },

  logoWrapper: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },

  clubName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 36,
  },
  star: { fontSize: 16 },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    maxWidth: 40,
  },
  founded: {
    color: COLORS.gray,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  card: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 28,
  },
  fieldGroup: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  inputFocused: { borderColor: 'rgba(255,255,255,0.45)' },
  forgotWrapper: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { color: COLORS.gray, fontSize: 13 },
  btnLogin: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnLoginPressed: { opacity: 0.85 },
  btnLoginText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.gray, fontSize: 13 },
  btnRegister: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnRegisterPressed: { borderColor: 'rgba(255,255,255,0.5)' },
  btnRegisterText: {
    color: COLORS.grayLight,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  footer: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.5,
  },

  // ── Perfil ──
  profileScroll: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  profileHeader: {
    height: 220,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
    position: 'relative',
  },
  profileHeaderBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoutBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: COLORS.gray,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  avatarWrapper: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: COLORS.white,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: -105,
    zIndex: 10,
  },
  avatarLogo: {
    width: 210,
    height: 210,
  },
  numberBadge: {
    position: 'absolute',
    bottom: 100,
    right: '22%',
    backgroundColor: COLORS.red,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 11,
  },
  numberText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  playerInfo: {
    alignItems: 'center',
    marginTop: 120,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  playerName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 12,
  },
  positionBadge: {
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 12,
  },
  positionText: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starSmall: { fontSize: 14 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexBasis: '45%',
    flexGrow: 1,
  },
  statCardLarge: { flex: 1 },
  pendingVoteBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#3D0F0F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingVoteIcon: { fontSize: 28 },
  pendingVoteTitle: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pendingVoteSub: {
    color: COLORS.grayLight,
    fontSize: 12,
    marginTop: 2,
  },
  pendingVoteArrow: {
    color: COLORS.red,
    fontSize: 28,
    fontWeight: '300',
  },
  editProfileCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  editProfileTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  editProfileLabel: {
    color: COLORS.gray,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 10,
  },
  editProfileInput: {
    backgroundColor: COLORS.bgCard2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editProfileBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  editProfileToggleBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileToggleText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  statNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 40,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
    marginTop: 4,
  },
  statIcon: {
    fontSize: 22,
    marginTop: 8,
  },
  clubCard: {
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clubCardLogo: {
    width: 64,
    height: 64,
  },
  clubCardInfo: { flex: 1 },
  clubCardName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 4,
    marginBottom: 4,
  },
  clubCardSub: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 6,
  },
  clubStars: { flexDirection: 'row', gap: 4 },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlayText: { fontSize: 20 },
  menuBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMenu: {
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: 220,
    overflow: 'hidden',
  },
  photoMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  photoMenuIcon: { fontSize: 18 },
  photoMenuText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Histórico ──
  historyHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyHeaderSub: {
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 4,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyHeaderTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 4,
  },
  historyLogoutBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  historyScroll: {
    flexGrow: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 80,
    gap: 12,
  },

  // Season summary
  seasonCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  seasonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 16,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  seasonStat: {
    alignItems: 'center',
    flex: 1,
  },
  seasonNum: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  seasonStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 1,
    marginTop: 4,
  },
  seasonDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },

  // Match card
  matchCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matchCompetition: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.blue,
    letterSpacing: 2,
  },
  matchDate: {
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 1,
  },
  matchSep: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  matchMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  matchTeamLeft: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  matchTeamRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  matchTeamSFTFC: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  matchTeamOpponent: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
    textAlign: 'right',
  },
  matchVenueTag: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  matchScoreText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
    marginHorizontal: 10,
  },
  matchBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  matchGoalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchGoalIcon: { fontSize: 12 },
  matchGoalsText: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
  },

  // ── Player Card ──
  cardWrapper: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cardShield: {
    width: 170,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 85,
    borderBottomRightRadius: 85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 2,
  },
  cardRating: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 38,
  },
  cardPosition: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  cardTopRight: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  cardNation: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardClubText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardAvatarArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  cardAvatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  cardSilHead: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardSilBody: {
    width: 74,
    height: 28,
    borderTopLeftRadius: 37,
    borderTopRightRadius: 37,
    marginTop: 2,
  },
  cardBanner: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  cardBannerName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  cardStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'space-around',
  },
  cardStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  cardStatVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardStatLbl: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },

  // ── Formação ──
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formBadge: {
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  formBadgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  synergyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#141414',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  synergyBarActive: {
    backgroundColor: '#141414',
  },
  synergyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  synergyDotActive: {
    backgroundColor: COLORS.white,
  },
  synergyText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  synergyTextActive: {
    color: COLORS.white,
  },
  pitchContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitch: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0d1510',
  },
  pitchOutline: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pitchMidLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pitchMidCircle: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pitchBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },

  // ── Mini Card ──
  miniCard: {
    width: MINI_W,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: MINI_W / 2,
    borderBottomRightRadius: MINI_W / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 14,
  },
  miniCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 2,
  },
  miniRating: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  miniPos: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  miniSilArea: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  miniPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  miniSilHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  miniSilBody: {
    width: 32,
    height: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 1,
  },
  miniBanner: {
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 2,
  },
  miniName: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // ── Formation selector ──
  formSelScroll: {
    flexGrow: 0,
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formSelContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center' as const,
  },
  formSelBtn: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center' as const,
    minWidth: 68,
  },
  formSelBtnActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
  },
  formSelText: {
    color: COLORS.gray,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textAlign: 'center' as const,
  },
  formSelTextLine2: {
    marginTop: 1,
  },
  formSelTextActive: {
    color: '#111111',
  },

  // ── Mini card selection ring ──
  miniSelRing: {
    position: 'absolute' as const,
    top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFD700',
  },

  // ── Votação (novo design) ──
  voteNewPage: {
    flexGrow: 1,
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  voteNewBadge: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start' as const,
    marginBottom: 0,
  },
  voteNewBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
  },
  voteNewTitle: {
    fontSize: 44,
    fontWeight: '900' as const,
    color: COLORS.white,
    lineHeight: 50,
    letterSpacing: -1,
  },
  voteNewDesc: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 22,
  },
  voteNewStartBtn: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  voteNewStartText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },
  votePlayerCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  voteCardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  voteIndexBadge: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  voteIndexBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
  },
  voteVoteCount: {
    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  votePlayerInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  voteNumBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  voteNumText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900' as const,
  },
  voteNameBig: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  votePosText: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  voteCardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  voteStarLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.gray,
    letterSpacing: 3,
  },
  voteStarRowNew: {
    flexDirection: 'row' as const,
    gap: 8,
    justifyContent: 'center' as const,
  },
  voteStarBtn: { padding: 4 },
  voteStarIconNew: { fontSize: 40, color: '#333' },
  voteStarActive: { color: '#FFD700' },

  // ── Resultados carrossel ──
  voteResultCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    minHeight: 300,
    overflow: 'hidden' as const,
  },
  voteResultCardWorst: {
    borderColor: COLORS.blue,
    borderWidth: 1.5,
  },
  voteResultTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  voteResultScore: {
    fontSize: 48,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  voteResultBottom: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    gap: 4,
  },
  voteResultBottomLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
    marginBottom: 4,
  },
  voteStarsDisplay: {
    fontSize: 24,
    color: '#FFD700',
    letterSpacing: 4,
  },
  voteWorstStamp: {
    backgroundColor: COLORS.red,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    transform: [{ rotate: '10deg' }],
  },
  voteWorstStampText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900' as const,
    letterSpacing: 1,
  },
  voteWorstBallMark: {
    position: 'absolute' as const,
    bottom: 48,
    right: -28,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(80,80,80,0.22)',
  },

  // ── Sorteio ──
  srCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  srCountIcon: { fontSize: 14, color: COLORS.gray },
  srCountLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.grayLight,
    letterSpacing: 1,
  },
  srCountNum: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
  srGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  srPlayerBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  srPlayerBtnOn: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  srCheck: { fontSize: 12, color: COLORS.white },
  srPlayerName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray,
    letterSpacing: 1,
  },
  srPlayerNameOn: { color: COLORS.white },
  srCTABar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  srCTABtn: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  srCTABtnOff: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  srCTABtnText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  srModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 24,
    textAlign: 'center',
  },
  srModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    width: '100%',
    marginBottom: 12,
  },
  srModeBtnAlt: {
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  srModeBtnIcon: { fontSize: 26 },
  srModeBtnTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 2,
    marginBottom: 2,
  },
  srModeBtnSub: {
    fontSize: 12,
    color: '#888',
    letterSpacing: 0.5,
  },
  srModeBack: {
    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  srCap1Btn: {
    borderColor: COLORS.blue,
    backgroundColor: 'rgba(59,111,224,0.10)',
  },
  srCap2Btn: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(217,48,48,0.10)',
  },
  srCapTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  srCoinWrapper: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  srCoinImage: {
    width: 164,
    height: 164,
  },
  srCoinText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 4,
  },
  srTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  srTeamsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  srTeamCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 6,
  },
  srTeamCardDark: { backgroundColor: '#141414' },
  srTeamCardActive: { borderColor: 'rgba(255,255,255,0.45)' },
  srTeamLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
  },
  srTeamName: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
  },
  srTeamBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.bgCard2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srTeamBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.white,
  },
  srTeamPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0d0d0d',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  srTeamPlayerName: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
    flex: 1,
  },
  srTurnBar: {
    alignItems: 'center',
    gap: 8,
  },
  srTurnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
  },
  srTurnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    justifyContent: 'center',
  },
  srTurnName: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 3,
  },
  srAvailBtn: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  srAvailName: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  srSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 3,
    marginBottom: 16,
    textAlign: 'center',
  },
  srVenueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    marginBottom: 12,
  },
  srVenueBtnActive: {
    borderColor: COLORS.blue,
    borderWidth: 2,
    backgroundColor: 'rgba(59,111,224,0.14)',
  },
  srVenueIcon: { fontSize: 28 },
  srVenueLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.gray,
    letterSpacing: 2,
  },
  srVenueLabelActive: { color: COLORS.white },
  srInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  srInputIcon: { fontSize: 18 },
  srInputText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  srTimeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  srTimeInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 2,
    marginTop: 4,
  },
  srVenueCheck: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '900',
  },

  // ── Sorteio: preço e resumo ──
  srPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  srPricePrefix: {
    color: COLORS.gray,
    fontSize: 18,
    fontWeight: '800',
  },
  srPriceInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
  },
  srMatchSummary: {
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  srMatchSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  srMatchSummaryIcon: { fontSize: 16 },
  srMatchSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 1,
  },
  srMatchSummaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 4,
  },
  tabIcon: { fontSize: 20 },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 2,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
  tabActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.white,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(59,111,224,0.10)',
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  verifyBannerIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  verifyBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 2,
    marginBottom: 4,
  },
  verifyBannerText: {
    fontSize: 12,
    color: COLORS.grayLight,
    lineHeight: 18,
  },
  srTimeSep: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  srCodeBox: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 2,
    borderColor: COLORS.blue,
    borderRadius: 16,
    paddingHorizontal: 36,
    paddingVertical: 20,
    alignItems: 'center',
  },
  srCodeText: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.blue,
    letterSpacing: 12,
  },
  srCodeInput: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 10,
    textAlign: 'center',
    width: '100%',
  },

  // ── Position picker ──
  posPickerTrigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  posPickerGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  posPickerOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.bgCard2,
  },
  posPickerOptionSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue + '22',
  },
  posPickerOptionText: {
    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  posPickerOptionTextSelected: {
    color: COLORS.blue,
  },

  // ── VER ELENCO button ──
  elencoBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  elencoBtnIcon: { fontSize: 24 },
  elencoBtnTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 2,
  },
  elencoBtnSub: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },

  // ── Team members list ──
  elencoScroll: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  elencoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  elencoRankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.bgCard2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  elencoRankText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.gray,
  },
  elencoAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  elencoName: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  elencoPosBadge: {
    backgroundColor: COLORS.blue + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  elencoPosText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.blue,
    letterSpacing: 1,
  },
  elencoStats: { alignItems: 'flex-end' as const },
  elencoRating: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: COLORS.yellow,
  },
  elencoStatSub: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 2,
  },
  elencoChevron: {
    fontSize: 22,
    color: COLORS.gray,
    marginLeft: 2,
  },

  // ── Bench bar ──
  benchBar: {
    height: 96,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#0a0a0a',
    paddingTop: 4,
  },
  benchLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: COLORS.gray,
    letterSpacing: 2,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  benchScroll: {
    paddingHorizontal: 8,
    gap: 6,
    alignItems: 'center' as const,
  },
  benchItem: {
    opacity: 0.65,
  },
  benchItemActive: {
    opacity: 1,
  },

  // ── Card zoom overlay ──
  zoomOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  zoomDismissHint: {
    color: COLORS.gray,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center' as const,
    marginTop: 16,
    textTransform: 'uppercase' as const,
  },
});
