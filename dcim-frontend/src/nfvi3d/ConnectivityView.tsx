import React from "react";

type LinkedPortsPair = [{ key: string }, { key: string }];

export default function ConnectivityView({ linkedPorts = [] as LinkedPortsPair[] }) {
  const list = linkedPorts.filter(p => Array.isArray(p) && p.length === 2);
  return (
    <div style={{
      padding: 20, height: "100%", overflowY: "auto",
      background: "rgba(18,18,18,0.8)", backdropFilter: "blur(8px)",
      color: "#fff", borderRadius: 10, margin: 20
    }}>
      <h2 style={{ textAlign: "center", marginBottom: 20, color: "#00d1b2" }}>
        📡 Cable Connectivity Map
      </h2>
      {list.length === 0 ? (
        <p style={{ textAlign: "center", fontStyle: "italic", color: "#888" }}>
          No connections available.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {list.map((pair, i) => {
            const start = pair[0]?.key ?? "N/A";
            const end   = pair[1]?.key ?? "N/A";
            const type  = guessType(start, end);
            return (
              <div key={i} style={{
                background: "#1f1f1f", borderRadius: 8, padding: 15,
                boxShadow: "0 2px 5px rgba(0,0,0,0.5)"
              }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>#{i+1}</div>
                <div style={{ marginBottom: 10 }}>
                  <div>🔌 <b>From:</b> {start}</div>
                  <div>🔌 <b>To:</b> {end}</div>
                </div>
                <div style={{ fontWeight: 700, color: "cyan" }}>🔗 {type}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// même esprit que ton 1er essai
function guessType(_a: string, _b: string) {
  const speeds = ["100G","40G","25G","10G"];
  const colors = { "100G":"Magenta", "40G":"Purple", "25G":"Blue", "10G":"Orange" };
  const s = speeds[Math.floor(Math.random()*speeds.length)] as keyof typeof colors;
  return `${s} - ${colors[s]}`;
}
