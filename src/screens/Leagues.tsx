import { AdSlot } from '../components/AdSlot';
import { RewardedButton } from '../components/RewardedButton';
import { maybeInterstitial } from '../engine/ads';
import { Avatar } from '../components/Avatar';
import { useEffect, useRef, useState } from 'react';
import { DEMOTE, LEAGUE_PRIZE_XP, LEAGUE_SIZE, LEAGUES, leagueStandings, PROMOTE } from '../engine/game';
import { weekStart } from '../engine/time';
import { useStore } from '../state/store';

function timeLeft(wid: string): string {
  const end = weekStart(wid).getTime() + 7 * 86_400_000;
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d} kun ${h} soat` : `${h} soat`;
}

export function Leagues() {
  const { state, update } = useStore();
  const [, force] = useState(0);
  const badges = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = badges.current?.querySelector<HTMLElement>('.cur');
    if (el && badges.current) badges.current.scrollLeft = el.offsetLeft - badges.current.clientWidth / 2 + el.clientWidth / 2;
  }, []);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // Turnir sahifasi reklamasi: Android'da interstitial (har 2-kirishda, ≥3 daqiqa oraliq), saytda AdSense.
  useEffect(() => {
    void maybeInterstitial();
  }, []);
  const lg = state.league;
  const rows = leagueStandings(lg, new Date(), state.name, state.avatar);
  const res = lg.lastResult && !lg.lastResult.seen ? lg.lastResult : null;

  return (
    <div className="page">
      <div className="league-badges" ref={badges}>
        {LEAGUES.map((l, i) => (
          <div key={l.name} className={`lbadge ${i === lg.tier ? 'cur' : i > lg.tier ? 'locked' : ''}`} style={{ ['--c' as string]: l.color }} title={`${i + 1}. ${l.name} liga`}>
            <span>{i > lg.tier ? '🔒' : l.icon}</span>
            <small>{l.name}</small>
          </div>
        ))}
      </div>
      <h1 className="page-title center">
        {LEAGUES[lg.tier].icon} {LEAGUES[lg.tier].name} liga
      </h1>
      <p className="muted center league-sub">
        {lg.tier + 1}-daraja / {LEAGUES.length} · 🇫🇷 {LEAGUES[lg.tier].city} shahri · ⏳ {timeLeft(lg.weekId)} qoldi
      </p>
      <div className="league-stats">
        <div>
          <b>{lg.weeklyXp}</b>
          <small>Bu hafta XP</small>
        </div>
        <div>
          <b>{rows.findIndex((r) => r.isMe) + 1}</b>
          <small>O'rningiz</small>
        </div>
        <div>
          <b>Top {PROMOTE}</b>
          <small>{lg.tier + 1 < LEAGUES.length ? `${LEAGUES[lg.tier + 1].name} ligaga` : 'Chempionlikda qoling'}</small>
        </div>
      </div>
      <details className="league-how">
        <summary>❓ Turnir qanday ishlaydi?</summary>
        <ul>
          <li>Har hafta siz {LEAGUE_SIZE} kishilik guruhda bellashasiz. Hafta dushanbadan yakshanbagacha.</li>
          <li>
            <b>XP</b> — darslar, mashqlar va Vivi bilan suhbatda to'playdigan ochkolaringiz. Qancha ko'p o'qisangiz, shuncha ko'p XP.
          </li>
          <li>
            Hafta oxirida <b>eng yaxshi {PROMOTE} kishi</b> keyingi ligaga ko'tariladi, <b>oxirgi {DEMOTE} kishi</b> pastga tushadi.
          </li>
          <li>
            Ligalar: {LEAGUES.map((l) => l.name).join(' → ')}. Har bir liga — Fransiyaning bir shahri, oxirgisi Parij 🗼.
          </li>
          <li>
            Mukofot: 🥇 +{LEAGUE_PRIZE_XP[1]} XP, 🥈 +{LEAGUE_PRIZE_XP[2]} XP, 🥉 +{LEAGUE_PRIZE_XP[3]} XP.
          </li>
        </ul>
      </details>
      <RewardedButton kind="xp" compact />
      {lg.weeklyXp === 0 && <div className="league-hint">Bitta dars tugatib turnirga qo'shiling — XP to'plang!</div>}
      <ol className="board">
        {rows.map((r, i) => {
          const rank = i + 1;
          const zone = rank <= PROMOTE ? 'up' : rank > LEAGUE_SIZE - DEMOTE && lg.tier > 0 ? 'down' : '';
          return (
            <li key={r.id} className={`brow ${r.isMe ? 'me' : ''} ${zone}`}>
              {rank === PROMOTE + 1 && <div className="zone-line up">▲ KO'TARILISH ZONASI</div>}
              {rank === LEAGUE_SIZE - DEMOTE + 1 && lg.tier > 0 && <div className="zone-line down">▼ TUSHISH ZONASI</div>}
              <span className={`brank r${rank}`}>{rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</span>
              <span className="bavatar"><Avatar value={r.avatar} size={30} /></span>
              <span className="bname">{r.isMe ? `${r.name} (siz)` : r.name}</span>
              <span className="bxp">{r.xp} XP</span>
            </li>
          );
        })}
      </ol>
      {res && (
        <div className="modal-back">
          <div className="sheet">
            <div className="big-emoji">{res.toTier > res.fromTier ? '🎉' : res.toTier < res.fromTier ? '😔' : '💪'}</div>
            <h3>O'tgan hafta: {res.rank}-o'rin</h3>
            <p className="muted">
              {res.toTier > res.fromTier
                ? `Tabriklaymiz! Siz ${LEAGUES[res.toTier].name} ligaga ko'tarildingiz. Chemodanni yig'ing!${res.rank <= 3 ? ` Mukofot: +${LEAGUE_PRIZE_XP[res.rank]} XP.` : ''}`
                : res.toTier < res.fromTier
                  ? `Siz ${LEAGUES[res.toTier].name} ligaga tushdingiz. Bu hafta qaytib chiqing!`
                  : `${LEAGUES[res.toTier].name} ligada qoldingiz.`}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => update((s) => ({ ...s, league: { ...s.league, lastResult: s.league.lastResult && { ...s.league.lastResult, seen: true } } }))}
            >
              Davom etish
            </button>
          </div>
        </div>
      )}
      <AdSlot />
    </div>
  );
}
