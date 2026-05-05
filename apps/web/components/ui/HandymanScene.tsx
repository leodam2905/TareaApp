"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Stars } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";

const TOOLS = [
  { emoji: "🔧", label: "Plumbing",       color: "#60A5FA", category: "PLUMBING" },
  { emoji: "⚡", label: "Electrical",     color: "#FCD34D", category: "ELECTRICAL" },
  { emoji: "🔨", label: "Carpentry",      color: "#FB923C", category: "CARPENTRY" },
  { emoji: "🎨", label: "Painting",       color: "#F472B6", category: "PAINTING" },
  { emoji: "❄️", label: "HVAC",           color: "#67E8F9", category: "HVAC" },
  { emoji: "🧹", label: "Cleaning",       color: "#86EFAC", category: "CLEANING" },
  { emoji: "🌿", label: "Landscaping",    color: "#4ADE80", category: "LANDSCAPING" },
  { emoji: "📦", label: "Moving",         color: "#C084FC", category: "MOVING" },
  { emoji: "🔌", label: "Appliances",     color: "#FCA5A5", category: "APPLIANCE_REPAIR" },
  { emoji: "🏠", label: "Roofing",        color: "#FDE68A", category: "ROOFING" },
  { emoji: "🪵", label: "Flooring",       color: "#D4A96A", category: "GENERAL" },
  { emoji: "🐜", label: "Pest Control",   color: "#6EE7B7", category: "GENERAL" },
];

function makeToolTexture(emoji: string, label: string, color: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  const r = 32;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.font = "96px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 - 22);

  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 62);

  return new THREE.CanvasTexture(canvas);
}

function ToolSprite({
  emoji, label, color, category, angle, index, onClick,
}: {
  emoji: string; label: string; color: string; category: string;
  angle: number; index: number; onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(() => makeToolTexture(emoji, label, color), [emoji, label, color]);
  const radius = 2.4;
  const baseX = Math.sin(angle) * radius;
  const baseZ = Math.cos(angle) * radius;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = Math.sin(t * 1.1 + index * 1.05) * 0.35;
    const target = hovered ? 1.2 : 1.0;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });

  return (
    <Billboard position={[baseX, 0, baseZ]}>
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <planeGeometry args={[0.75, 0.75]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.01} side={THREE.DoubleSide} />
      </mesh>
    </Billboard>
  );
}

function ToolCircle() {
  const groupRef = useRef<THREE.Group>(null);
  const router = useRouter();

  useFrame(({ clock }) => {
    if (groupRef.current)
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.25;
  });

  return (
    <group ref={groupRef} position={[2.5, 0, 0]}>
      {TOOLS.map((tool, i) => (
        <ToolSprite
          key={tool.label}
          {...tool}
          angle={(i / TOOLS.length) * Math.PI * 2}
          index={i}
          onClick={() => router.push(`/customer/browse?category=${tool.category}`)}
        />
      ))}
    </group>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const n = 140;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const palette = [
      new THREE.Color("#38BDF8"),
      new THREE.Color("#FCD34D"),
      new THREE.Color("#86EFAC"),
      new THREE.Color("#F472B6"),
    ];
    for (let i = 0; i < n; i++) {
      const r = 5 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.06;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} vertexColors transparent opacity={0.7} />
    </points>
  );
}

export default function HandymanScene() {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 8], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.5} />
      <pointLight position={[0, 5, 5]} intensity={2} color="#ffffff" />
      <ToolCircle />
      <Particles />
      <Stars radius={40} depth={30} count={800} factor={2} fade speed={0.5} />
    </Canvas>
  );
}
