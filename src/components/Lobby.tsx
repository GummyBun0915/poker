"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import styles from "./Lobby.module.css";

export function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(1);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, avatar }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(data.joinUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the table");
      setBusy(false);
    }
  }

  function join() {
    const room = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
    if (room.length !== 8) return setError("Enter the eight-character room code");
    router.push(`/r/${room}`);
  }

  return (
    <main className={styles.lobby}>
      <div className={styles.atmosphere} />
      <header className={styles.header}>
        <div className={styles.mark}><span>♠</span> The Booth</div>
        <p>Private Texas Hold&apos;em for five</p>
      </header>
      <section className={styles.stage}>
        <div className={styles.pitch}>
          <span className={styles.eyebrow}>The room is yours</span>
          <h1>Deal the night<br />a better hand.</h1>
          <p>Create a private table, send one link, and play proper no-limit Hold&apos;em. No accounts. No downloads. Just the game.</p>
          <div className={styles.features}><span>2–5 players</span><span>Optional bots</span><span>Play money</span></div>
        </div>
        <div className={styles.entry}>
          <label className={styles.label} htmlFor="display-name">Your table name</label>
          <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="How should the table know you?" autoComplete="nickname" />
          <span className={styles.label}>Choose your seat</span>
          <div className={styles.avatars}>
            {Array.from({ length: 12 }, (_, index) => (
              <button key={index} type="button" onClick={() => setAvatar(index)} aria-label={`Choose avatar ${index + 1}`} aria-pressed={avatar === index}>
                <Avatar index={index} selected={avatar === index} />
              </button>
            ))}
          </div>
          <button className={`${styles.primary} ${busy ? styles.busy : ""}`} type="button" onClick={create} disabled={busy || name.trim().length < 2} aria-busy={busy}>{busy ? "Opening the room…" : "Create private table"}</button>
          <div className={styles.joinRow}><span>Already invited?</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={8} /><button type="button" onClick={join}>Join</button></div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>
      <footer className={styles.footer}><span>♣ Proper rules</span><span>♦ Secure private hands</span><span>♥ Built for the browser</span></footer>
    </main>
  );
}
