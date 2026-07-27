"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@/lib/poker/view";
import type { RoomCommand } from "@/lib/server/rooms";
import { playSound } from "@/lib/client/sound";
import { Avatar } from "./Avatar";
import { PokerTable } from "./PokerTable";
import styles from "./TableRoom.module.css";

const EffectsCanvas = dynamic(() => import("./EffectsCanvas").then((module) => module.EffectsCanvas), { ssr: false });

export function TableRoom({ code }: { code: string }) {
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(1);
  const [joining, setJoining] = useState(false);
  const [live, setLive] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [pending, setPending] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [chat, setChat] = useState("");
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const previous = useRef<{ hand?: string; board: number; winner: string } | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data.snapshot);
    return data.snapshot as RoomSnapshot;
  }, [code]);

  useEffect(() => {
    refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not open this room")).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!state?.viewerId) return;
    let disposed = false;
    let retry = 1000;
    let reconnectTimer = 0;
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws?code=${code}`);
      socket.current = ws;
      ws.onopen = () => { setLive(true); setFallback(false); retry = 1000; };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "snapshot") setState(message.snapshot);
        if (message.type === "ack") setPending(false);
        if (message.type === "error") { setError(message.message); setPending(false); }
      };
      ws.onclose = () => { setLive(false); setFallback(true); if (!disposed) { reconnectTimer = window.setTimeout(connect, retry); retry = Math.min(30_000, retry * 2); } };
      ws.onerror = () => ws.close();
    };
    connect();
    const heartbeat = window.setInterval(() => { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "ping" })); }, 15_000);
    return () => { disposed = true; clearInterval(heartbeat); clearTimeout(reconnectTimer); socket.current?.close(); };
  }, [code, state?.viewerId]);

  useEffect(() => {
    if (live || !state?.viewerId) return;
    const poll = window.setInterval(() => { void refresh().catch(() => undefined); }, 1400);
    return () => clearInterval(poll);
  }, [live, refresh, state?.viewerId]);

  useEffect(() => {
    if (!state?.legal) return;
    setRaiseTo(Math.max(state.legal.minRaiseTo, Math.min(state.legal.maxRaiseTo, state.legal.minRaiseTo)));
  }, [state?.legal?.minRaiseTo, state?.legal?.maxRaiseTo, state?.legal]);

  useEffect(() => {
    if (!state?.viewerId) return;
    const target = state.hand?.deadlineAt ?? state.hand?.nextHandAt;
    if (!target) return;
    const delay = Math.max(60, target - Date.now() + 90);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/rooms/${code}/advance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: state.version }) });
        const data = await response.json();
        if (response.ok) setState(data.snapshot);
      } catch { /* reconnect/polling will recover */ }
    }, delay);
    return () => clearTimeout(timer);
  }, [code, state?.hand?.actorId, state?.hand?.deadlineAt, state?.hand?.nextHandAt, state?.viewerId, state?.version]);

  useEffect(() => {
    if (!state || !sound) return;
    const winner = state.hand?.winners.map((item) => item.playerId).join(",") ?? "";
    const current = { hand: state.hand?.id, board: state.hand?.board.length ?? 0, winner };
    const old = previous.current;
    if (old && current.winner && current.winner !== old.winner) playSound("win");
    else if (old && current.hand && current.hand !== old.hand) playSound("card");
    else if (old && current.board > old.board) playSound("card");
    else if (old && state.hand?.actorId === state.viewerId) playSound("turn");
    previous.current = current;
  }, [sound, state]);

  async function join() {
    setJoining(true); setError("");
    try {
      const response = await fetch(`/api/rooms/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, avatar }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data.snapshot);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not join"); }
    finally { setJoining(false); }
  }

  async function command(command: RoomCommand) {
    if (pending || !state) return;
    if ((command.type === "poker" || command.type === "start") && "vibrate" in navigator) navigator.vibrate(command.type === "start" ? [18, 28, 18] : 10);
    setPending(true); setError(""); if (sound) playSound("chip");
    const commandId = crypto.randomUUID();
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: "command", commandId, expectedVersion: state.version, command }));
      window.setTimeout(() => setPending(false), 2500);
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${code}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commandId, expectedVersion: state.version, command }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data.snapshot);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Action failed"); }
    finally { setPending(false); }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function toggleSound() {
    setSound((enabled) => {
      if (!enabled) playSound("turn");
      return !enabled;
    });
  }

  useEffect(() => {
    if (!state?.legal || pending || drawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || /INPUT|TEXTAREA/.test((event.target as HTMLElement)?.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "f") void command({ type: "poker", action: { type: "fold" } });
      if (key === "c") void command({ type: "poker", action: state.legal!.canCheck ? { type: "check" } : { type: "call" } });
      if (key === "r" && state.legal!.canRaise) void command({ type: "poker", action: { type: "raise", amount: raiseTo } });
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  });

  if (loading) return <main className={styles.loading}><div className={styles.loader}>Shuffling the deck</div></main>;
  if (!state) return <main className={styles.loading}><div className={styles.missing}><span>♠</span><h1>The table is gone.</h1><p>{error || "This room expired or never existed."}</p><Link href="/">Open a new room</Link></div></main>;
  if (!state.viewerId) return (
    <main className={styles.joinPage}>
      <div className={styles.joinBackdrop} />
      <section className={styles.joinCard}>
        <span className={styles.kicker}>You&apos;re invited to</span><h1>The Booth</h1><p>Room {code}</p>
        <label htmlFor="join-name">Your name</label><input id="join-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="Display name" />
        <div className={styles.joinAvatars}>{Array.from({ length: 12 }, (_, index) => <button key={index} onClick={() => setAvatar(index)} aria-pressed={avatar === index}><Avatar index={index} selected={avatar === index} /></button>)}</div>
        <button className={styles.joinButton} onClick={join} disabled={joining || name.trim().length < 2}>{joining ? "Taking your seat…" : "Take a seat"}</button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );

  const viewer = state.players.find((player) => player.id === state.viewerId)!;
  const host = state.hostId === state.viewerId;
  const betweenHands = !state.hand || state.hand.street === "complete";
  const eligible = state.players.filter((player) => !player.sittingOut && player.stack > 0).length;
  const winner = state.players.find((player) => player.id === state.hand?.winners[0]?.playerId);
  const winnerSeat = winner ? (winner.seat - viewer.seat + 5) % 5 : 0;

  return (
    <main className={styles.room}>
      <div className={styles.backdrop} />
      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark}><span>♠</span> The Booth</Link>
        <div className={styles.roomMeta}><span className={live ? styles.online : styles.reconnecting}>{live ? "Live" : fallback ? "HTTP sync" : "Connecting"}</span><button className={copied ? styles.copied : ""} onClick={() => void copyInvite()} aria-live="polite">{copied ? "Invite copied ✓" : `Room ${code} · Copy invite`}</button></div>
        <div className={styles.headerActions}><button aria-label="Toggle sound" onClick={toggleSound}>{sound ? "Sound on" : "Sound off"}</button><button onClick={() => command({ type: "sitOut", value: !viewer.sittingOut })}>{viewer.sittingOut ? "Sit in" : "Sit out"}</button><button onClick={() => setDrawer((value) => !value)}>Table log</button></div>
      </header>
      <PokerTable state={state} />
      <div className={`${styles.controls} ${pending ? styles.processing : ""}`} aria-busy={pending}>
        {state.legal ? <>
          <button className={styles.fold} disabled={pending} onClick={() => command({ type: "poker", action: { type: "fold" } })}>Fold <kbd>F</kbd></button>
          <button className={styles.call} disabled={pending} onClick={() => command({ type: "poker", action: state.legal!.canCheck ? { type: "check" } : { type: "call" } })}>{state.legal.canCheck ? "Check" : `Call ${state.legal.toCall}`} <kbd>C</kbd></button>
          {state.legal.canRaise ? <div className={styles.raise}><div><span>Raise to</span><strong>{raiseTo.toLocaleString()}</strong></div><input aria-label="Raise amount" type="range" min={state.legal.minRaiseTo} max={state.legal.maxRaiseTo} step={state.settings.bigBlind} value={raiseTo} onChange={(event) => setRaiseTo(Number(event.target.value))} /><div className={styles.presets}><button onClick={() => setRaiseTo(Math.min(state.legal!.maxRaiseTo, Math.max(state.legal!.minRaiseTo, Math.round(state.pot * .5 / state.settings.bigBlind) * state.settings.bigBlind)))}>½ pot</button><button onClick={() => setRaiseTo(Math.min(state.legal!.maxRaiseTo, Math.max(state.legal!.minRaiseTo, state.pot)))}>Pot</button><button onClick={() => setRaiseTo(state.legal!.maxRaiseTo)}>All-in</button>{viewer.timeBankMs > 0 ? <button onClick={() => command({ type: "timeBank" })}>+{viewer.timeBankMs / 1000}s</button> : null}<button className={styles.raiseButton} disabled={pending} onClick={() => command({ type: "poker", action: { type: "raise", amount: raiseTo } })}>Raise</button></div></div> : null}
        </> : <div className={styles.waitingControls}>
          {host && betweenHands && eligible >= 2 ? <button className={styles.deal} disabled={pending} onClick={() => command({ type: "start" })}>Deal the next hand</button> : null}
          {host && betweenHands && state.seatsOpen > 0 ? <div className={styles.botButtons}><span>Add a player</span>{(["tight", "balanced", "aggressive"] as const).map((style) => <button key={style} onClick={() => command({ type: "addBot", style })}>{style}</button>)}</div> : null}
          {!host && betweenHands ? <span>Waiting for the host to deal</span> : null}
          {!betweenHands ? <span>{state.hand?.actorId === viewer.id ? "Your move" : `${state.players.find((player) => player.id === state.hand?.actorId)?.name ?? "Table"} is thinking`}</span> : null}
          {viewer.stack < state.settings.buyIn && betweenHands ? <button onClick={() => command({ type: "rebuy" })}>Rebuy to {state.settings.buyIn.toLocaleString()}</button> : null}
        </div>}
      </div>
      <div className={styles.reactions}>{["👏", "🔥", "😮", "♠", "♥"].map((reaction) => <button key={reaction} onClick={() => command({ type: "reaction", text: reaction })}>{reaction}</button>)}</div>
      {state.chat.filter((item) => item.reaction).slice(-1).map((item) => <div key={item.id} className={styles.reactionBurst}>{item.text}<small>{item.name}</small></div>)}
      <button className={`${styles.drawerScrim} ${drawer ? styles.drawerScrimOpen : ""}`} aria-label="Close table log" tabIndex={drawer ? 0 : -1} onClick={() => setDrawer(false)} />
      <aside className={`${styles.drawer} ${drawer ? styles.drawerOpen : ""}`}>
        <div className={styles.drawerHeader}><div><span>Table log</span><strong>{state.players.length}/5 seated</strong></div><button onClick={() => setDrawer(false)}>Close</button></div>
        <div className={styles.tabs}><span>Conversation</span></div>
        <div className={styles.feed}>{state.chat.filter((item) => !item.reaction).length ? state.chat.filter((item) => !item.reaction).map((item) => <p key={item.id}><b>{item.name}</b>{item.text}</p>) : <div className={styles.empty}>The room is quiet. Break the ice.</div>}</div>
        <form onSubmit={(event) => { event.preventDefault(); if (chat.trim()) { void command({ type: "chat", text: chat }); setChat(""); } }}><input value={chat} onChange={(event) => setChat(event.target.value)} maxLength={180} placeholder="Say something to the table" /><button>Send</button></form>
        <div className={styles.history}><span>Recent hands</span>{state.history.map((entry) => <p key={entry.id}>{entry.text}<b>{entry.pot?.toLocaleString()}</b></p>)}</div>
        <div className={styles.roster}><span>Seats</span>{state.players.map((player) => <p key={player.id}><span><Avatar index={player.avatar} size="sm" />{player.name}{player.isBot ? ` · ${player.botStyle}` : ""}</span>{host && player.id !== viewer.id ? <span className={styles.seatActions}>{!player.isBot ? <button onClick={() => command({ type: "transferHost", playerId: player.id })}>Make host</button> : null}<button onClick={() => command(player.isBot ? { type: "removeBot", playerId: player.id } : { type: "kick", playerId: player.id })}>{player.isBot ? "Remove" : "Kick"}</button></span> : null}</p>)}</div>
        {host ? <button className={styles.pauseButton} onClick={() => command({ type: "pause", value: !state.paused })}>{state.paused ? "Resume automatic deals" : "Pause after this hand"}</button> : null}
      </aside>
      {error ? <div className={styles.toast} role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div> : null}
      <EffectsCanvas handId={state.hand?.id ?? ""} boardCount={state.hand?.board.length ?? 0} pot={state.pot} winnerKey={state.hand?.winners.map((item) => `${state.hand?.id}-${item.playerId}`).join(":") ?? ""} winnerSeat={winnerSeat} />
    </main>
  );
}
