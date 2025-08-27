import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text, Grid } from "@react-three/drei";
import React, { Suspense, useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";


// 2D views (kept)
import CableLegend from "./CableLegend";
import ConnectivityView from "./ConnectivityView";
import PortsView from "./PortsView";


/* =========================
   Types
========================= */
type BladeItem = {
  id: string;
  label: string;
  color: string;
  dx?: number;
  dy?: number;
  dz?: number;
};


type RackItem = {
  id: string;
  name: string;
  x: number; // rack X position
  z: number; // rack Z position
  blades: BladeItem[];
};


type DragState = { rackId: string; bladeId: string; y: number } | null;


type PressState =
  | { rackId: string; bladeId: string; y: number; startedAt: number }
  | null;


// cables (for 2D & 3D)
type CableItem = {
  id: string;
  a: { bladeId: string; index: number };
  b: { bladeId: string; index: number };
  color?: string;          // optional: category/speed color
  thickness?: number;      // optional: visual thickness
};


type PendingPort = { rackId: string; bladeId: string; index: number } | null;


const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);


/* =========================
   Fixed palette
========================= */
const COLOR_OPTIONS: { key: string; name: string; value: string }[] = [
  { key: "violet", name: "EAS (violet)", value: "#6E64E8" },
  { key: "amber", name: "NRU (amber)", value: "#F0A31A" },
  { key: "red", name: "SDI (red)", value: "#D83A38" },
  { key: "blue", name: "CEE (blue)", value: "#3E63FF" },
  { key: "green", name: "vMSC (green)", value: "#25A45A" },
  { key: "test-magenta", name: "Test Magenta", value: "#D900C7" },
  { key: "test-yellow", name: "Test Yellow", value: "#D6D81B" },
  { key: "test-cyan", name: "Test Cyan", value: "#19D3E6" },
  { key: "test-lime", name: "Test Lime", value: "#9CFF00" },
  { key: "white", name: 'White (label "empty")', value: "#FFFFFF" },
];


const isWhite = (hex: string) =>
  hex.toLowerCase() === "#fff" || hex.toLowerCase() === "#ffffff";


/* =========================
   Initial data
========================= */
const INITIAL_BLADES: Omit<BladeItem, "id">[] = [
  { label: "EAS-UX4400", color: "#6E64E8" },
  { label: "EAS-UX4400", color: "#6E64E8" },
  { label: "NRU0301", color: "#F0A31A" },
  { label: "NRU0301", color: "#F0A31A" },
  { label: "SDI (RTE1)", color: "#D83A38" },
  { label: "SDI (RTE2)", color: "#D83A38" },
  { label: "CEE (compute 1)", color: "#3E63FF" },
  { label: "CEE (compute 2)", color: "#3E63FF" },
  { label: "CEE (compute 3)", color: "#3E63FF" },
  { label: "vMSC (compute 4)", color: "#25A45A" },
  { label: "vMSC (compute 5)", color: "#25A45A" },
  { label: "vMSC (compute 6)", color: "#25A45A" },
  { label: "vMSC (compute 7)", color: "#25A45A" },
  { label: "vMSC (compute 8)", color: "#25A45A" },
  { label: "vMSC (compute 9)", color: "#25A45A" },
  { label: "vMSC (spare compute 10)", color: "#25A45A" },
];


const INITIAL_RACKS: RackItem[] = [
  {
    id: uid(),
    name: "Rack 1",
    x: 0,
    z: 0,
    blades: INITIAL_BLADES.map((b) => ({ ...b, id: uid() })),
  },
];


/* =========================
   Geometry
========================= */
const RACK_W = 1.2;
const RACK_H = 4.8;
const RACK_D = 1.8;


const BLADE_W = 0.95;
const BLADE_H = 0.08;
const BLADE_T = 0.06;
const BLADE_RADIUS = 0.035;


// your right offset kept (blades slightly sticking out on the right)
const BLADE_RIGHT_OFFSET = RACK_W / 10 - 0.15;


const TOP_MARGIN = 0.25;
const V_SPACING = 0.17;


// world <-> slot helpers
const slotY = (i: number) =>
  RACK_H / 2 - TOP_MARGIN - i * V_SPACING - BLADE_H;
const indexFromY = (y: number, count: number) => {
  const val = (RACK_H / 2 - TOP_MARGIN - BLADE_H - y) / V_SPACING;
  const idx = Math.round(val);
  return Math.min(count - 1, Math.max(0, idx));
};


/* =========================
   Ports — left wall layout
========================= */
type PortShape = "circle" | "square";
type PortDef = {
  position: [number, number, number];
  shape: PortShape;
  color: string;
  ledColor: string;
};


// grid (local to the row)
const PORT_SPACING_X = -0.066; // columns go to the LEFT (will become Z after rotation)
const PORT_ROW_DY = 0.09;      // vertical spacing
const PORT_BASE_X = 0.02;      // margin before first column
const PORT_BASE_Z = BLADE_T / 2 + 0.002; // tiny relief


// sticking to the left wall
const PORT_SIZE = 0.06;
const PORT_HALF = PORT_SIZE / 2;
const FACE_LEFT_X = -RACK_W / 2;
const H_GAP = 0.001; // avoid z-fighting


function deriveTypeFromLabel(
  label: string
): "EAS" | "NRU" | "SDI" | "CEE" | "vMSC" | "DEFAULT" {
  const l = label.toLowerCase();
  if (l.startsWith("eas")) return "EAS";
  if (l.startsWith("nru")) return "NRU";
  if (l.startsWith("sdi")) return "SDI";
  if (l.startsWith("cee")) return "CEE";
  if (l.startsWith("vmsc")) return "vMSC";
  return "DEFAULT";
}


function getPortsForBladeType(
  bladeType: ReturnType<typeof deriveTypeFromLabel>
): PortDef[] {
  let portCount = 48;
  let portsPerRow = 24;
  let shape: PortShape = "square";
  let singleRow = false;
  let invert = false;
  let ledLogic = (i: number) => "green";


  switch (bladeType) {
    case "EAS":
    case "vMSC":
      portCount = 6;
      portsPerRow = 6;
      singleRow = true;
      invert = true;
      return Array.from({ length: portCount }).map((_, i) => {
        const row = singleRow ? 0 : Math.floor(i / portsPerRow);
        const col = invert ? portsPerRow - 1 - (i % portsPerRow) : i % portsPerRow;
        const isEven = i % 2 === 0;
        return {
          position: [
            PORT_BASE_X + col * PORT_SPACING_X,
            row * -PORT_ROW_DY,
            PORT_BASE_Z,
          ],
          shape: isEven ? "square" : "circle",
          color: "gray",
          ledColor: isEven ? "green" : "yellow",
        } as PortDef;
      });


    case "NRU":
      portCount = 24;
      portsPerRow = 24;
      shape = "circle";
      ledLogic = (i) => (i % 2 === 0 ? "yellow" : "green");
      break;


    case "SDI":
      portCount = 48;
      portsPerRow = 24;
      shape = "square";
      ledLogic = (i) => (i === 0 ? "red" : "green");
      break;


    case "CEE":
      portCount = 16;
      portsPerRow = 16;
      shape = "circle";
      ledLogic = (i) => (i % 3 === 0 ? "red" : "yellow");
      break;


    default:
      portCount = 48;
      portsPerRow = 24;
      shape = "square";
      ledLogic = (i) => "green";
  }


  return Array.from({ length: portCount }).map((_, i) => {
    const row = Math.floor(i / portsPerRow);
    const col = invert ? portsPerRow - 1 - (i % portsPerRow) : i % portsPerRow;
    return {
      position: [
        PORT_BASE_X + col * PORT_SPACING_X,
        row * -PORT_ROW_DY,
        PORT_BASE_Z,
      ],
      shape,
      color: "gray",
      ledColor: ledLogic(i),
    } as PortDef;
  });
}


function RackPort({
  position,
  shape = "circle",
  color = "#4ad295",
  ledColor = "lime",
  onClick,
}: {
  position: [number, number, number];
  shape?: PortShape;
  color?: string;
  ledColor?: string;
  onClick?: () => void;
}) {
  const group = useRef<THREE.Group>(null!);


  // LED pulse
  useFrame(() => {
    const led = group.current?.children?.[1] as THREE.Mesh | undefined;
    if (!led) return;
    const s = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    (led as any).scale.set(s, s, s);
  });


  return (
    <group ref={group} position={position} onClick={onClick}>
      <mesh>
        {shape === "circle" ? (
          <sphereGeometry args={[PORT_HALF, 16, 16]} />
        ) : (
          <boxGeometry args={[PORT_SIZE, PORT_SIZE, PORT_SIZE]} />
        )}
        <meshStandardMaterial color={color} />
      </mesh>


      {/* LED above */}
      <mesh position={[0, PORT_HALF + 0.02, 0]}>
        <sphereGeometry args={[PORT_HALF * 0.5, 10, 10]} />
        <meshStandardMaterial emissive={ledColor} color={ledColor} />
      </mesh>
    </group>
  );
}


/* =========================
   Meshes
========================= */
function RackChassis({ selected }: { selected?: boolean }) {
  const metal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: selected ? "#222a3d" : "#1c2230",
        roughness: 0.6,
        metalness: 0.15,
        clearcoat: 0.3,
        clearcoatRoughness: 0.6,
      }),
    [selected]
  );


  return (
    <group>
      <RoundedBox
        args={[RACK_W, RACK_H, RACK_D]}
        radius={0.03}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <primitive object={metal} attach="material" />
      </RoundedBox>


      {/* subtle lines */}
      <mesh position={[0, RACK_H * 0.22, RACK_D * 0.49]} receiveShadow>
        <boxGeometry args={[RACK_W * 0.96, 0.002, 0.002]} />
        <meshStandardMaterial color="#2a3243" />
      </mesh>
      <mesh position={[0, -RACK_H * 0.18, RACK_D * 0.49]} receiveShadow>
        <boxGeometry args={[RACK_W * 0.96, 0.002, 0.002]} />
        <meshStandardMaterial color="#2a3243" />
      </mesh>
      <mesh position={[RACK_W * 0.18, 0, RACK_D * 0.49]} receiveShadow>
        <boxGeometry args={[0.002, RACK_H * 0.9, 0.002]} />
        <meshStandardMaterial color="#2a3243" />
      </mesh>
      <mesh position={[-RACK_W * 0.2, 0, RACK_D * 0.49]} receiveShadow>
        <boxGeometry args={[0.002, RACK_H * 0.9, 0.002]} />
        <meshStandardMaterial color="#2a3243" />
      </mesh>
    </group>
  );
}


function Blade({
  id,
  x,
  y,
  z = 0,
  color,
  label,
  selected,
  onClick,
  onPointerDown, // start press (not drag immediately)
}: {
  id: string;
  x: number;
  y: number;
  z?: number;
  color: string;
  label: string;
  selected?: boolean;
  onClick?: (id: string) => void;
  onPointerDown?: (e: any, id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const scale = selected ? 1.06 : hovered ? 1.03 : 1.0;


  // black text on white blade
  const isWhiteBlade =
    isWhite(color) || label.trim().toLowerCase() === "empty";
  const textZ = BLADE_T / 2 + 0.004;


  return (
    <group
      position={[x, y, z]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e, id);
      }}
    >
      <RoundedBox
        args={[BLADE_W, BLADE_H, BLADE_T]}
        radius={BLADE_RADIUS}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.45}
          emissive={selected ? "#ffffff" : "#000000"}
          emissiveIntensity={selected ? 0.15 : 0}
        />
      </RoundedBox>


      {/* cylinder tip on the right */}
      <mesh
        position={[BLADE_W / 2 + 0.055, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      >
        <cylinderGeometry
          args={[BLADE_H * 0.45, BLADE_H * 0.45, 0.11, 24]}
        />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} />
      </mesh>


      <Text
        position={[0, 0, textZ]}
        fontSize={0.055}
        color={isWhiteBlade ? "#000000" : "#ffffff"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={isWhiteBlade ? 0 : 0.006}
        outlineBlur={0}
        outlineColor="#000000"
        maxWidth={BLADE_W * 0.92}
      >
        {label}
      </Text>
    </group>
  );
}


/* =========================
   Cable rendering (3D) — Courbure adaptative + emissive
========================= */
function CableCurve({
  a,
  b,
  color = "#7aa2ff",
  thickness = 0.01,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  color?: string;
  thickness?: number;
}) {
  // Distance
  const dist = a.distanceTo(b);


  // Courbure proportionnelle avec plancher pour éviter les câbles collés et sombres
  const bow = Math.min(0.35, Math.max(0.1, dist * 0.08)); // min 0.1


  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = new THREE.Vector3(-1, 0, 0); // tirage vers l'extérieur (côté gauche)
  const ctrlA = a.clone().lerp(mid, 0.4).addScaledVector(dir, bow);
  const ctrlB = b.clone().lerp(mid, 0.4).addScaledVector(dir, bow);


  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([a, ctrlA, ctrlB, b]),
    [a, b, bow] // dépend de la courbure
  );


  const tubeGeom = useMemo(
    () => new THREE.TubeGeometry(curve, 64, thickness, 8, false),
    [curve, thickness]
  );


  return (
    <mesh geometry={tubeGeom}>
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        metalness={0.2}
        emissive={color}          // << garde la couleur vive même à l’ombre
        emissiveIntensity={0.25}  // glow léger
      />
    </mesh>
  );
}


/* =========================
   Single Rack 3D (separate component to respect Hooks rules)
========================= */
function RackGroup({
  rack,
  selectedRackId,
  setSelectedRackId,
  selectedBladeId,
  setSelectedBladeId,
  isolate,
  setIsolate,
  press,
  drag,
  beginPress,
  updateGesture,
  endGesture,
  onPortClick,
}: {
  rack: RackItem;
  selectedRackId: string | null;
  setSelectedRackId: (id: string | null) => void;
  selectedBladeId: string | null;
  setSelectedBladeId: (id: string | null) => void;
  isolate: boolean;
  setIsolate: (v: boolean) => void;
  press: PressState;
  drag: DragState;
  beginPress: (rackId: string, bladeId: string, rackLocalY: number) => void;
  updateGesture: (rackLocalY: number) => void;
  endGesture: () => void;
  onPortClick: (payload: { rackId: string; bladeId: string; index: number }) => void;
}) {
  const rackRef = useRef<THREE.Group>(null);


  const show = !isolate || selectedRackId === rack.id;


  const minY =
    rack.blades.length > 0 ? slotY(rack.blades.length - 1) : -RACK_H / 2 + 0.4;
  const maxY = rack.blades.length > 0 ? slotY(0) : RACK_H / 2 - 0.4;


  const isThisRackDragging = !!(drag && drag.rackId === rack.id);
  const previewIndex =
    isThisRackDragging && drag
      ? indexFromY(THREE.MathUtils.clamp(drag.y, minY, maxY), rack.blades.length)
      : null;


  const toRackLocalY = (worldPoint: THREE.Vector3) => {
    if (!rackRef.current) return 0;
    const p = worldPoint.clone();
    rackRef.current.worldToLocal(p);
    return p.y;
  };


  // left-wall ports coordinates
  const SIDE_X = FACE_LEFT_X - (PORT_HALF + H_GAP);
  const SIDE_Z_NEAR = RACK_D / 20 - 0.8; // near the front edge


  return (
    <group
      ref={rackRef}
      position={[rack.x, RACK_H / 2, rack.z]}
      visible={show}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedRackId(rack.id);
        setSelectedBladeId(null);
        setIsolate(true);
      }}
    >
      <RackChassis selected={selectedRackId === rack.id} />


      {/* rack name on the top front */}
      <Text
        position={[0, RACK_H / 2 + 0.12, RACK_D * 0.49]}
        fontSize={0.085}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        textAlign="center"
        outlineWidth={0.004}
        outlineColor="#000000"
        maxWidth={RACK_W * 0.95}
      >
        {rack.name}
      </Text>


      {/* blades stack — at z=0.93 like your previous layout */}
      <group position={[0, 0, 0.93]}>
        {rack.blades.map((b, i) => {
          const isDraggingThisBlade =
            drag && drag.rackId === rack.id && drag.bladeId === b.id;
          if (isDraggingThisBlade) return null;


          const y = slotY(i) + (b.dy ?? 0);
          const x = BLADE_RIGHT_OFFSET + (b.dx ?? 0);
          const z = b.dz ?? 0;


          return (
            <Blade
              key={b.id}
              id={b.id}
              x={x}
              y={y}
              z={z}
              color={b.color}
              label={b.label}
              selected={selectedBladeId === b.id}
              onClick={(id) => {
                setSelectedRackId(rack.id);
                setSelectedBladeId(id);
                setIsolate(true);
              }}
              onPointerDown={(e) => {
                const localY = toRackLocalY(e.point);
                beginPress(rack.id, b.id, localY);
              }}
            />
          );
        })}


        {/* placeholder target during drag */}
        {isThisRackDragging &&
          previewIndex !== null &&
          rack.blades.length > 0 && (
            <mesh position={[BLADE_RIGHT_OFFSET, slotY(previewIndex), 0.12]}>
              <boxGeometry args={[BLADE_W * 1.06, 0.006, 0.02]} />
              <meshBasicMaterial color={"#7aa2ff"} transparent opacity={0.85} />
            </mesh>
          )}


        {/* floating blade while dragging */}
        {isThisRackDragging &&
          (() => {
            const dragged = rack.blades.find((bb) => bb.id === drag!.bladeId);
            if (!dragged) return null;
            const x = BLADE_RIGHT_OFFSET + (dragged.dx ?? 0);
            const clampedY = THREE.MathUtils.clamp(drag!.y, minY, maxY);
            return (
              <Blade
                id={dragged.id}
                x={x}
                y={clampedY}
                z={0.2}
                color={dragged.color}
                label={dragged.label}
                selected
              />
            );
          })()}
      </group>


      {/* ports on the LEFT wall: one row per blade */}
      {rack.blades.map((b, i) => {
        const y = slotY(i) + (b.dy ?? 0);
        const bladeType = deriveTypeFromLabel(b.label);
        const ports = getPortsForBladeType(bladeType);
        return (
          <group
            key={`sideports-${b.id}`}
            position={[SIDE_X, y, SIDE_Z_NEAR]}
            rotation={[0, Math.PI / 2, 0]} // turn local X into world Z so the row lies on the face
          >
            {ports.map((p, idx) => (
              <RackPort
                key={idx}
                position={p.position}
                shape={p.shape}
                color="gray"
                ledColor={p.ledColor}
                onClick={(e) => {
                  e?.stopPropagation?.();
                  onPortClick({ rackId: rack.id, bladeId: b.id, index: idx });
                }}
              />
            ))}
          </group>
        );
      })}


      {/* big invisible plane in front to capture drag gestures */}
      <mesh
        position={[0, 0, RACK_D / 2 + 0.02]}
        onPointerMove={(e) => {
          if (press || drag) {
            const localY = toRackLocalY(e.point);
            const clamped = THREE.MathUtils.clamp(localY, minY, maxY);
            updateGesture(clamped);
          }
        }}
        onPointerUp={() => {
          if (press || drag) endGesture();
        }}
      >
        <planeGeometry args={[RACK_W * 1.3, RACK_H * 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}


/* =========================
   Scene (racks + cables)
========================= */
function Scene({
  racks,
  selectedRackId,
  setSelectedRackId,
  selectedBladeId,
  setSelectedBladeId,
  isolate,
  setIsolate,
  press,
  drag,
  beginPress,
  updateGesture,
  endGesture,
  cables,
  onPortClick,
}: {
  racks: RackItem[];
  selectedRackId: string | null;
  setSelectedRackId: (id: string | null) => void;
  selectedBladeId: string | null;
  setSelectedBladeId: (id: string | null) => void;
  isolate: boolean;
  setIsolate: (v: boolean) => void;
  press: PressState;
  drag: DragState;
  beginPress: (rackId: string, bladeId: string, rackLocalY: number) => void;
  updateGesture: (rackLocalY: number) => void;
  endGesture: () => void;
  cables: CableItem[];
  onPortClick: (payload: { rackId: string; bladeId: string; index: number }) => void;
}) {
  // Helpers to compute world position of a given blade port, consistent with RackGroup transforms
  const FACE_LEFT_X = -RACK_W / 2;
  const PORT_SIZE = 0.06;
  const PORT_HALF = PORT_SIZE / 2;
  const H_GAP = 0.001;
  const SIDE_X = FACE_LEFT_X - (PORT_HALF + H_GAP);
  const SIDE_Z_NEAR = RACK_D / 20 - 0.8;


  const portWorldPosition = (ref: { bladeId: string; index: number }) => {
    // find rack + blade + blade index (row)
    let targetRack: RackItem | undefined;
    let bladeIdx = -1;
    for (const r of racks) {
      const idx = r.blades.findIndex((b) => b.id === ref.bladeId);
      if (idx >= 0) {
        targetRack = r;
        bladeIdx = idx;
        break;
      }
    }
    if (!targetRack) return new THREE.Vector3(0, 0, 0);


    const blade = targetRack.blades[bladeIdx];
    const bladeType = deriveTypeFromLabel(blade.label);
    const ports = getPortsForBladeType(bladeType);
    const p = ports[ref.index] ?? ports[0];


    // Rack group position
    const rackPos = new THREE.Vector3(targetRack.x, RACK_H / 2, targetRack.z);


    // Ports row group transform (on left wall)
    const rowPos = new THREE.Vector3(SIDE_X, slotY(bladeIdx) + (blade.dy ?? 0), SIDE_Z_NEAR);


    // Child offset (p.position). After rotY(pi/2): (x,y,z)->(z,y,-x)
    const offsetLocal = new THREE.Vector3(p.position[0], p.position[1], p.position[2]);
    const rotated = new THREE.Vector3(
      offsetLocal.z,
      offsetLocal.y,
      -offsetLocal.x
    );


    // Sum transforms: rack + row + rotated offset
    return rackPos.clone().add(rowPos).add(rotated);
  };


  return (
    <>
      <hemisphereLight intensity={0.5} groundColor={"#0b0f18"} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />


      <Grid
        position={[0, -0.001, 0]}
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.6}
        sectionSize={2}
        sectionThickness={1}
        fadeDistance={20}
        fadeStrength={1}
      />


      {racks.map((rack) => (
        <RackGroup
          key={rack.id}
          rack={rack}
          selectedRackId={selectedRackId}
          setSelectedRackId={setSelectedRackId}
          selectedBladeId={selectedBladeId}
          setSelectedBladeId={setSelectedBladeId}
          isolate={isolate}
          setIsolate={setIsolate}
          press={press}
          drag={drag}
          beginPress={beginPress}
          updateGesture={updateGesture}
          endGesture={endGesture}
          onPortClick={onPortClick}
        />
      ))}


      {/* Render cables on top */}
      {cables.map((c) => {
        const A = portWorldPosition(c.a);
        const B = portWorldPosition(c.b);
        return (
          <CableCurve
            key={c.id}
            a={A}
            b={B}
            color={c.color ?? "#7aa2ff"}
            thickness={c.thickness ?? 0.012}
          />
        );
      })}
    </>
  );
}


/* =========================
   Racks panel (CRUD + isolate)
========================= */
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "white",
  marginTop: 6,
  marginBottom: 12,
};


function RacksPanel({
  racks,
  selectedRackId,
  setSelectedRackId,
  onAddRack,
  onDuplicateRack,
  onUpdateRack,
  onDeleteRack,
  isolate,
  setIsolate,
}: {
  racks: RackItem[];
  selectedRackId: string | null;
  setSelectedRackId: (id: string | null) => void;
  onAddRack: () => void;
  onDuplicateRack: (id: string) => void;
  onUpdateRack: (id: string, patch: Partial<RackItem>) => void;
  onDeleteRack: (id: string) => void;
  isolate: boolean;
  setIsolate: (v: boolean) => void;
}) {
  const selected = racks.find((r) => r.id === selectedRackId) || null;
  const [name, setName] = useState(selected?.name ?? "");
  const [x, setX] = useState(selected?.x.toString() ?? "0");
  const [z, setZ] = useState(selected?.z.toString() ?? "0");


  useEffect(() => {
    setName(selected?.name ?? "");
    setX(selected?.x?.toString() ?? "0");
    setZ(selected?.z?.toString() ?? "0");
  }, [selectedRackId, racks]);


  const save = () => {
    if (!selected) return;
    onUpdateRack(selected.id, {
      name: name || selected.name,
      x: Number(x),
      z: Number(z),
    });
  };


  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Racks</h3>
        <button
          onClick={onAddRack}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
            background: "linear-gradient(135deg,#2f5bff,#7aa2ff)",
            color: "white",
          }}
        >
          + Add rack
        </button>
        <button
          onClick={() => selectedRackId && onDuplicateRack(selectedRackId)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: selectedRackId ? "pointer" : "not-allowed",
            opacity: selectedRackId ? 1 : 0.5,
          }}
          title="Duplicate selected rack"
          disabled={!selectedRackId}
        >
          Duplicate
        </button>
        <button
          onClick={() => setIsolate((v) => !v)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: isolate ? "#394255" : "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            marginLeft: "auto",
          }}
          title={isolate ? "Show all (Esc)" : "Isolate selected rack"}
        >
          {isolate ? "Show all" : "Isolate"}
        </button>
      </div>


      {/* rack list */}
      <div style={{ marginBottom: 8 }}>
        {racks.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelectedRackId(r.id)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              marginBottom: 6,
              cursor: "pointer",
              background: selectedRackId === r.id ? "rgba(255,255,255,0.08)" : "transparent",
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}{" "}
              <span style={{ opacity: 0.7 }}>
                (x:{r.x.toFixed(2)}, z:{r.z.toFixed(2)})
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateRack(r.id);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
              }}
            >
              Duplicate
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRack(r.id);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "#d83a38",
                color: "white",
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>


      {/* selected rack form */}
      {selected && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: 10,
          }}
        >
          <label>Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label>Position X</label>
              <input style={inputStyle} value={x} onChange={(e) => setX(e.target.value)} />
            </div>
            <div>
              <label>Position Z</label>
              <input style={inputStyle} value={z} onChange={(e) => setZ(e.target.value)} />
            </div>
          </div>
          <button
            onClick={save}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              fontWeight: 700,
            }}
          >
            Save rack
          </button>
        </div>
      )}
    </div>
  );
}


/* =========================
   Blades panel (CRUD + up/down)
========================= */
function BladePanel({
  blades,
  selectedBladeId,
  setSelectedBladeId,
  onAdd,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  blades: BladeItem[];
  selectedBladeId: string | null;
  setSelectedBladeId: (id: string | null) => void;
  onAdd: (b: Omit<BladeItem, "id">) => void;
  onUpdate: (id: string, patch: Partial<BladeItem>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [label, setLabel] = useState<string>("");
  const [color, setColor] = useState<string>(COLOR_OPTIONS[4].value);


  useEffect(() => {
    const sel = blades.find((b) => b.id === selectedBladeId) || null;
    setLabel(sel?.label ?? "");
    setColor(sel?.color ?? COLOR_OPTIONS[4].value);
  }, [selectedBladeId, blades]);


  const sel = blades.find((b) => b.id === selectedBladeId) || null;
  const isEdit = !!sel;


  const save = () => {
    if (isEdit) {
      onUpdate(sel!.id, { label: label || "Unnamed", color });
    } else {
      const defaultLabel = isWhite(color) && !label.trim() ? "empty" : "New blade";
      onAdd({ label: label || defaultLabel, color });
    }
  };


  const remove = () => {
    if (sel) {
      onDelete(sel.id);
      setSelectedBladeId(null);
    }
  };


  const boundary = React.useMemo(() => {
    const map = new Map<string, { first: boolean; last: boolean }>();
    blades.forEach((b, i) => {
      map.set(b.id, { first: i === 0, last: i === blades.length - 1 });
    });
    return map;
  }, [blades]);


  const swatchStyle = (hex: string, active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    background: hex,
    border: isWhite(hex) ? "1px solid rgba(0,0,0,0.5)" : "1px solid rgba(255,255,255,0.25)",
    boxShadow: active ? "0 0 0 3px rgba(127, 170, 255, 0.9)" : "none",
    cursor: "pointer",
  });


  const buttonGhost: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
  };


  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>
        {isEdit ? "Edit selected blade" : "Add a blade"}
      </h3>


      <label>Label</label>
      <input
        style={inputStyle}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder='e.g. CEE (compute 4) — or "empty" for white'
      />


      <label>Color (palette)</label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 32px)",
          gap: 10,
          margin: "8px 0 12px",
        }}
      >
        {COLOR_OPTIONS.map((c) => {
          const active = color.toLowerCase() === c.value.toLowerCase();
          return (
            <div
              key={c.key}
              title={c.name}
              style={swatchStyle(c.value, active)}
              onClick={(e) => {
                e.stopPropagation();
                setColor(c.value);
                if (isWhite(c.value) && !label.trim()) setLabel("empty");
              }}
            />
          );
        })}
      </div>


      <div style={{ marginTop: 4 }}>
        <button
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            background: "linear-gradient(135deg,#2f5bff,#7aa2ff)",
            color: "white",
            marginRight: 8,
          }}
          onClick={save}
        >
          {isEdit ? "Save" : "Add"}
        </button>


        {isEdit && (
          <>
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                background: "rgba(255,255,255,0.08)",
                color: "white",
                marginRight: 8,
              }}
              onClick={() => {}}
            >
              Cancel
            </button>
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                background: "#d83a38",
                color: "white",
              }}
              onClick={remove}
            >
              Delete
            </button>
          </>
        )}
      </div>


      <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "14px 0" }} />


      <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
        <b>Manual order</b>: ↑ / ↓ (or drag directly in 3D by holding).
      </div>


      {blades.map((b) => {
        const bounds = boundary.get(b.id)!;
        return (
          <div
            key={b.id}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto auto",
              gap: 8,
              alignItems: "center",
              padding: "6px 8px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 6,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: b.color,
                display: "inline-block",
              }}
            />
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.label}
            </div>
            <button
              style={{
                ...buttonGhost,
                cursor: bounds.first ? "not-allowed" : "pointer",
                opacity: bounds.first ? 0.45 : 1,
              }}
              onClick={() => onMoveUp(b.id)}
              disabled={bounds.first}
              title={bounds.first ? "Already at top" : "Move up"}
            >
              ↑
            </button>
            <button
              style={{
                ...buttonGhost,
                cursor: bounds.last ? "not-allowed" : "pointer",
                opacity: bounds.last ? 0.45 : 1,
              }}
              onClick={() => onMoveDown(b.id)}
              disabled={bounds.last}
              title={bounds.last ? "Already at bottom" : "Move down"}
            >
              ↓
            </button>
          </div>
        );
      })}
    </div>
  );
}


/* =========================
   ========  App  ==========
========================= */


// --- Helpers dynamiques pour les câbles (couleur & priorité) ---
function getBladeTypeById(racks: RackItem[], bladeId: string) {
  const blade = racks.flatMap(r => r.blades).find(b => b.id === bladeId);
  return blade ? deriveTypeFromLabel(blade.label) : "DEFAULT";
}


function colorForType(t: ReturnType<typeof deriveTypeFromLabel>) {
  switch (t) {
    case "CEE":  return "#3E63FF";
    case "EAS":  return "#6E64E8";
    case "NRU":  return "#F0A31A";
    case "SDI":  return "#D83A38";
    case "vMSC": return "#25A45A";
    default:     return "#66ccff";
  }
}


const TYPE_PRIORITY: Record<ReturnType<typeof deriveTypeFromLabel>, number> = {
  SDI: 5,
  CEE: 4,
  NRU: 3,
  EAS: 2,
  vMSC: 1,
  DEFAULT: 0,
};


function pickCableColorFromEndpoints(
  racks: RackItem[],
  a: { bladeId: string },
  b: { bladeId: string }
) {
  const ta = getBladeTypeById(racks, a.bladeId);
  const tb = getBladeTypeById(racks, b.bladeId);
  const winner = TYPE_PRIORITY[ta] >= TYPE_PRIORITY[tb] ? ta : tb;
  return colorForType(winner);
}


export default function App() {
  const [racks, setRacks] = useState<RackItem[]>(INITIAL_RACKS);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(
    INITIAL_RACKS[0].id
  );
  const [selectedBladeId, setSelectedBladeId] = useState<string | null>(null);
  const [isolate, setIsolate] = useState(false);


  // tabs
  const [activeView, setActiveView] =
    useState<"rack" | "connectivity" | "ports">("rack");


  // 3D gestures
  const [press, setPress] = useState<PressState>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const pressTimer = useRef<number | null>(null);


  // cables
  const [cables, setCables] = useState<CableItem[]>([]);
  const [pending, setPending] = useState<PendingPort>(null);


  const LONG_PRESS_MS = 200;
  const MOVE_THRESHOLD_Y = 0.03;


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelTimers();
        setPress(null);
        setDrag(null);
        setIsolate(false);
        setSelectedRackId(null);
        setSelectedBladeId(null);
        setPending(null);
        document.body.style.cursor = "default";
      }
      // Quick undo last cable: Backspace
      if (e.key === "Backspace" && cables.length > 0) {
        setCables((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cables.length]);


  const cancelTimers = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };


  function toPortKey(ref: { bladeId: string; index: number }) {
    const blade = racks.flatMap((r) => r.blades).find((b) => b.id === ref.bladeId);
    const label = blade?.label ?? "Unknown";
    return `${label}-port${ref.index + 1}`;
  }


  /* ---------- placement helpers ---------- */
  const RACK_STEP = RACK_W + 0.7;
  function nextFreeX(all: RackItem[]) {
    if (all.length === 0) return 0;
    const maxX = Math.max(...all.map((r) => r.x));
    return maxX + RACK_STEP;
  }


  /* ---- RACKS CRUD ---- */
  const addRack = () => {
    const newId = uid();
    setRacks((prev) => [
      ...prev,
      {
        id: newId,
        name: `Rack ${prev.length + 1}`,
        x: nextFreeX(prev),
        z: 0,
        blades: [],
      },
    ]);
    setSelectedRackId(newId);
    setSelectedBladeId(null);
    setIsolate(true);
  };


  const duplicateRack = (id: string) => {
    setRacks((prev) => {
      const src = prev.find((r) => r.id === id);
      if (!src) return prev;
      const newId = uid();
      const copy: RackItem = {
        id: newId,
        name: `${src.name} (copy)`,
        x: nextFreeX(prev), // always place on a free slot to the right
        z: src.z,
        blades: src.blades.map((b) => ({
          id: uid(),
          label: b.label,
          color: b.color,
          dx: b.dx,
          dy: b.dy,
          dz: b.dz,
        })),
      };
      setSelectedRackId(newId);
      setSelectedBladeId(null);
      setIsolate(true);
      return [...prev, copy];
    });
  };


  const updateRack = (id: string, patch: Partial<RackItem>) => {
    setRacks((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };


  const deleteRack = (id: string) => {
    setRacks((prev) => prev.filter((r) => r.id !== id));
    if (selectedRackId === id) {
      const remaining = racks.filter((r) => r.id !== id);
      setSelectedRackId(remaining[0]?.id ?? null);
      setSelectedBladeId(null);
      setIsolate(false);
    }
    // Remove cables pointing to blades of that rack
    const bladesToRemove = new Set(
      racks.find((r) => r.id === id)?.blades.map((b) => b.id) ?? []
    );
    setCables((prev) =>
      prev.filter((c) => !bladesToRemove.has(c.a.bladeId) && !bladesToRemove.has(c.b.bladeId))
    );
  };


  /* ---- BLADES CRUD ---- */
  const updateRacksWith = (
    rackId: string,
    updater: (blades: BladeItem[]) => BladeItem[]
  ) =>
    setRacks((prev) =>
      prev.map((r) => (r.id === rackId ? { ...r, blades: updater(r.blades) } : r))
    );


  const addBlade = (rackId: string, b: Omit<BladeItem, "id">) =>
    updateRacksWith(rackId, (blades) => [...blades, { ...b, id: uid() }]);


  const updateBlade = (rackId: string, id: string, patch: Partial<BladeItem>) =>
    updateRacksWith(rackId, (blades) =>
      blades.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );


  const deleteBlade = (rackId: string, id: string) => {
    updateRacksWith(rackId, (blades) => blades.filter((x) => x.id !== id));
    if (selectedBladeId === id) setSelectedBladeId(null);
    setCables((prev) => prev.filter((c) => c.a.bladeId !== id && c.b.bladeId !== id));
  };


  const moveBlade = (rackId: string, id: string, dir: "up" | "down") =>
    updateRacksWith(rackId, (blades) => {
      const idx = blades.findIndex((b) => b.id === id);
      if (idx < 0) return blades;
      const j = dir === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= blades.length) return blades;
      const copy = blades.slice();
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });


  // ---- 3D gestures: press/drag ----
  const beginPress = (rackId: string, bladeId: string, rackLocalY: number) => {
    setSelectedRackId(rackId);
    setSelectedBladeId(bladeId);
    setIsolate(true);


    cancelTimers();
    setPress({ rackId, bladeId, y: rackLocalY, startedAt: performance.now() });


    pressTimer.current = window.setTimeout(() => {
      setDrag((cur) => cur ?? { rackId, bladeId, y: rackLocalY });
      setPress(null);
      document.body.style.cursor = "grabbing";
    }, LONG_PRESS_MS);
  };


  const updateGesture = (rackLocalY: number) => {
    if (drag) {
      setDrag({ ...drag, y: rackLocalY });
      return;
    }
    if (press) {
      if (Math.abs(rackLocalY - press.y) > MOVE_THRESHOLD_Y) {
        cancelTimers();
        setDrag({ rackId: press.rackId, bladeId: press.bladeId, y: rackLocalY });
        setPress(null);
        document.body.style.cursor = "grabbing";
      } else {
        setPress({ ...press, y: rackLocalY });
      }
    }
  };


  const endGesture = () => {
    if (drag) {
      const d = drag;
      const r = racks.find((rr) => rr.id === d.rackId);
      if (r) {
        const from = r.blades.findIndex((b) => b.id === d.bladeId);
        if (from >= 0) {
          const to = indexFromY(d.y, r.blades.length);
          if (to !== from) {
            updateRacksWith(d.rackId, (blades) => {
              const copy = blades.slice();
              const [item] = copy.splice(from, 1);
              copy.splice(to, 0, item);
              return copy;
            });
          }
        }
      }
      setDrag(null);
      document.body.style.cursor = "default";
      return;
    }
    if (press) {
      cancelTimers();
      setPress(null);
      document.body.style.cursor = "default";
    }
  };


  /* ---------- Cable interactions ---------- */
  const handlePortClick = ({ rackId, bladeId, index }: { rackId: string; bladeId: string; index: number }) => {
    // First endpoint
    if (!pending) {
      setPending({ rackId, bladeId, index });
      return;
    }
    // If clicking the exact same port, toggle/cancel selection
    if (pending.bladeId === bladeId && pending.index === index) {
      setPending(null);
      return;
    }


    // Couleur dynamique selon les types de blades reliés
    const dynamicColor = pickCableColorFromEndpoints(
      racks,
      { bladeId: pending.bladeId },
      { bladeId }
    );


    // Create cable
    const newCable: CableItem = {
      id: uid(),
      a: { bladeId: pending.bladeId, index: pending.index },
      b: { bladeId, index },
      color: dynamicColor,
      thickness: 0.012,
    };
    setCables((prev) => [...prev, newCable]);
    setPending(null);
  };


  // Optional: visualize pending endpoint in UI top bar
  const pendingLabel = (() => {
    if (!pending) return null;
    const blade =
      racks.flatMap((r) => r.blades).find((b) => b.id === pending.bladeId) || null;
    const name = blade?.label ?? "Unknown";
    return `${name} · port ${pending.index + 1}`;
  })();


  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Topbar / Tabs */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "#001d4a",
          color: "#fff",
          borderBottom: "1px solid #333",
        }}
      >
        <div style={{ fontWeight: 700 }}>
          NFVI Infrastructure
          {pendingLabel && (
            <span style={{ marginLeft: 12, fontWeight: 500, opacity: 0.8 }}>
              | Linking… <span style={{ color: "#66ccff" }}>{pendingLabel}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["rack", "connectivity", "ports"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                background: "none",
                color: activeView === v ? "#66ccff" : "#ccc",
                border: "none",
                padding: "6px 10px",
                borderBottom: activeView === v ? "2px solid #66ccff" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>


      <div style={{ position: "relative", width: "100%", height: "calc(100vh - 48px)" }}>
        {/* === RACK VIEW === */}
        {activeView === "rack" && (
          <>
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [5.6, 3.6, 8.2], fov: 40, near: 0.1, far: 200 }}
              onPointerMissed={() => {
                cancelTimers();
                if (drag || press) {
                  setDrag(null);
                  setPress(null);
                  document.body.style.cursor = "default";
                  return;
                }
                setIsolate(false);
                setSelectedRackId(null);
                setSelectedBladeId(null);
              }}
            >
              <color attach="background" args={["#0b1020"]} />
              <fog attach="fog" args={["#0b1020", 16, 40]} />
              <Suspense fallback={null}>
                <Scene
                  racks={racks}
                  selectedRackId={selectedRackId}
                  setSelectedRackId={setSelectedRackId}
                  selectedBladeId={selectedBladeId}
                  setSelectedBladeId={setSelectedBladeId}
                  isolate={isolate}
                  setIsolate={setIsolate}
                  press={press}
                  drag={drag}
                  beginPress={beginPress}
                  updateGesture={updateGesture}
                  endGesture={endGesture}
                  cables={cables}
                  onPortClick={handlePortClick}
                />
              </Suspense>
              <OrbitControls
                makeDefault
                enabled={!drag}
                enableDamping
                dampingFactor={0.08}
                minDistance={4}
                maxDistance={40}
                maxPolarAngle={Math.PI * 0.49}
              />
            </Canvas>


            {/* Right overlay: racks + blades */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 420,
                background: "rgba(12,16,28,0.9)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                color: "white",
                fontFamily: "ui-sans-serif, system-ui, Segoe UI, Roboto, Arial",
                backdropFilter: "blur(6px)",
                maxHeight: "calc(100% - 32px)",
                overflow: "auto",
              }}
            >
              <RacksPanel
                racks={racks}
                selectedRackId={selectedRackId}
                setSelectedRackId={setSelectedRackId}
                onAddRack={addRack}
                onDuplicateRack={duplicateRack}
                onUpdateRack={updateRack}
                onDeleteRack={deleteRack}
                isolate={isolate}
                setIsolate={setIsolate}
              />


              <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "12px 0" }} />


              {(() => {
                const selRack = racks.find((r) => r.id === selectedRackId) || null;
                return selRack ? (
                  <BladePanel
                    blades={selRack.blades}
                    selectedBladeId={selectedBladeId}
                    setSelectedBladeId={setSelectedBladeId}
                    onAdd={(b) => addBlade(selRack.id, b)}
                    onUpdate={(id, patch) => updateBlade(selRack.id, id, patch)}
                    onDelete={(id) => deleteBlade(selRack.id, id)}
                    onMoveUp={(id) => moveBlade(selRack.id, id, "up")}
                    onMoveDown={(id) => moveBlade(selRack.id, id, "down")}
                  />
                ) : (
                  <div style={{ opacity: 0.8 }}>No rack selected.</div>
                );
              })()}
            </div>


            {/* Légende (à gauche dans CableLegend.tsx) */}
            <CableLegend />
          </>
        )}


        {/* === CONNECTIVITY VIEW === */}
        {activeView === "connectivity" && (
          <ConnectivityView
            linkedPorts={cables.map((c) => [
              { key: toPortKey(c.a) },
              { key: toPortKey(c.b) },
            ])}
          />
        )}


        {/* === PORTS VIEW === */}
        {activeView === "ports" && (
          <PortsView
            linkedPorts={cables.map((c) => [
              { key: toPortKey(c.a) },
              { key: toPortKey(c.b) },
            ])}
          />
        )}
      </div>
    </div>
  );
}


