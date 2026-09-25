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
      setError(caught instanceof Error ? caught.message : "创建牌桌失败");
      setBusy(false);
    }
  }

  function join() {
    const room = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
    if (room.length !== 8) return setError("请输入 8 位房间码");
    router.push(`/r/${room}`);
  }

  return (
    <main className={styles.lobby}>
      <div className={styles.atmosphere} />
      <header className={styles.header}>
        <div className={styles.mark}><span>♠</span> The Booth</div>
        <p>最多五人的私人德州扑克</p>
      </header>
      <section className={styles.stage}>
        <div className={styles.pitch}>
          <span className={styles.eyebrow}>今晚，这桌归你</span>
          <h1>开一桌，<br />直接玩。</h1>
          <p>创建私人牌桌，把链接发给朋友，就能开始标准无限注德州扑克。无需注册，无需下载，打开浏览器直接玩。</p>
          <div className={styles.features}><span>2–5 人</span><span>可添加机器人</span><span>娱乐筹码</span></div>
        </div>
        <div className={styles.entry}>
          <label className={styles.label} htmlFor="display-name">你的昵称</label>
          <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="朋友们怎么叫你？" autoComplete="nickname" />
          <span className={styles.label}>选择头像</span>
          <div className={styles.avatars}>
            {Array.from({ length: 12 }, (_, index) => (
              <button key={index} type="button" onClick={() => setAvatar(index)} aria-label={`选择头像 ${index + 1}`} aria-pressed={avatar === index}>
                <Avatar index={index} selected={avatar === index} />
              </button>
            ))}
          </div>
          <button className={`${styles.primary} ${busy ? styles.busy : ""}`} type="button" onClick={create} disabled={busy || name.trim().length < 2} aria-busy={busy}>{busy ? "正在开桌…" : "创建私人牌桌"}</button>
          <div className={styles.joinRow}><span>已有房间？</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="房间码" maxLength={8} /><button type="button" onClick={join}>加入</button></div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>
      <footer className={styles.footer}><span>♣ 标准规则</span><span>♦ 手牌仅自己可见</span><span>♥ 浏览器直接玩</span></footer>
    </main>
  );
}
