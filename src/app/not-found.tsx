import Link from "next/link";

export default function NotFound() {
  return <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: "3rem", color: "var(--oxblood-light)" }}>♠</div><h1 style={{ fontFamily: "var(--font-display)", fontSize: "3rem", margin: "10px 0" }}>No table here.</h1><Link href="/" style={{ color: "var(--signal)" }}>Return to The Booth</Link></div></main>;
}
