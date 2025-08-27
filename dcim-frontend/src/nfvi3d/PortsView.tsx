import React from "react";

type LinkedPortsPair = [{ key: string }, { key: string }];

export default function PortsView({ linkedPorts = [] as LinkedPortsPair[] }) {
  const list = linkedPorts.filter(p => Array.isArray(p) && p.length === 2);
  return (
    <div style={{ padding: 20, color: "#eee" }}>
      <h2>Ports Connectivity Overview</h2>
      {list.length === 0 ? (
        <p>No connections found.</p>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse", marginTop: 20 }}>
          <thead>
            <tr>
              <th style={th}>Connection #</th>
              <th style={th}>From</th>
              <th style={th}>To</th>
              <th style={th}>Cable Type</th>
            </tr>
          </thead>
          <tbody>
            {list.map((pair, i) => {
              const start = pair[0]?.key ?? "N/A";
              const end   = pair[1]?.key ?? "N/A";
              const type  = guessType(start, end);
              return (
                <tr key={i}>
                  <td style={td}>{i+1}</td>
                  <td style={td}>{start}</td>
                  <td style={td}>{end}</td>
                  <td style={td}>{type}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
const th = { background:"#111", color:"#eee", padding:"10px", border:"1px solid #444" };
const td = { background:"#222", color:"#eee", padding:"10px", border:"1px solid #444" };

function guessType(_a:string,_b:string){
  const speeds = ["100G","40G","25G","10G"];
  const colors = { "100G":"Magenta", "40G":"Purple", "25G":"Blue", "10G":"Orange" };
  const s = speeds[Math.floor(Math.random()*speeds.length)] as keyof typeof colors;
  return `${s} - ${colors[s]}`;
}
