import React from "react";

const SWATCH = (color: string) => ({
  width: 18,
  height: 8,
  borderRadius: 999,
  background: color,
  display: "inline-block",
  marginRight: 8,
});

export default function CableLegend() {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,                 // ⬅️  était right:16
        bottom: 16,
        width: 320,
        background: "rgba(10,14,24,0.92)",
        color: "white",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 14,
        backdropFilter: "blur(6px)",
        fontFamily: "ui-sans-serif, system-ui, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background:
              "radial-gradient(circle at 30% 30%, #66ccff, #3e63ff 60%, #172a66 100%)",
            marginRight: 10,
            boxShadow: "0 0 18px rgba(102,204,255,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
        <div>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Cable Legend</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Cliquez sur 2 ports pour tracer un câble • Backspace = annuler le dernier
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 8,
          columnGap: 8,
          fontSize: 13,
        }}
      >
        <span style={SWATCH("#3E63FF")} /> <span>10G</span>
        <span style={SWATCH("#F0A31A")} /> <span>25G</span>
        <span style={SWATCH("#D83A38")} /> <span>40G</span>
        <span style={SWATCH("#25A45A")} /> <span>100G</span>
        <span style={SWATCH("#66ccff")} /> <span>Standard / Unknown</span>
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px dashed rgba(255,255,255,0.12)",
          fontSize: 12.5,
          lineHeight: 1.35,
          opacity: 0.9,
        }}
      >
        Astuces : les ports sont sur la paroi gauche du rack. Les câbles sont
        courbés pour éviter les collisions visuelles.
      </div>
    </div>
  );
}
