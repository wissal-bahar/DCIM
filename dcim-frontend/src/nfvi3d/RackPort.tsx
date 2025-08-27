import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  position: [number, number, number];
  shape?: "circle" | "square";
  color?: string;
  ledColor?: string;
  onClick?: () => void;
};

export default function RackPort({
  position,
  shape = "circle",
  color = "#4ad295",
  ledColor = "green",
  onClick,
}: Props) {
  const group = useRef<THREE.Group>(null!);

  // LED pulse
  useFrame(() => {
    const led = group.current?.children?.[1] as THREE.Mesh | undefined;
    if (!led) return;
    const s = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    led.scale.set(s, s, s);
  });

  return (
    <group ref={group} position={position} onClick={onClick}>
      <mesh>
        {shape === "circle" ? (
          <sphereGeometry args={[0.03, 16, 16]} />
        ) : (
          <boxGeometry args={[0.06, 0.06, 0.06]} />
        )}
        <meshStandardMaterial color={color} />
      </mesh>

      {/* LED au-dessus */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.015, 10, 10]} />
        <meshStandardMaterial emissive={ledColor} color={ledColor} />
      </mesh>
    </group>
  );
}
