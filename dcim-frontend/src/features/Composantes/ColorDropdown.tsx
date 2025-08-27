import { useState, useRef, useEffect } from "react";
import "./ColorDropdown.css";

interface Props {
    selectedColor: string;
    onChange: (color: string) => void;
}

const colorPalette = [
    "#ffffff", "#d1d5db", "#9ca3af", "#6b7280", "#374151", "#111827",
    "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#8b5cf6", "#ec4899"
];

export default function ColorDropdown({ selectedColor, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fermer si on clique en dehors
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="color-dropdown" ref={dropdownRef}>
            <div
                className="color-preview"
                style={{ backgroundColor: selectedColor || "#ccc" }}
                onClick={() => setOpen(!open)}
            />
            {open && (
                <div className="color-grid">
                    {colorPalette.map((color) => (
                        <div
                            key={color}
                            className={`color-square ${selectedColor === color ? "selected" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                                onChange(color);
                                setOpen(false);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
