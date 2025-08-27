import "../assets/styles/RackTable.css";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface Rack {
    id: number;
    nom: string;
    status: "prototype" | "en_marche" | "en_arret";
}

function getBadgeClass(status: string) {
    switch (status) {
        case "prototype":
            return "badge badge-prototype";
        case "en_marche":
            return "badge badge-actif";
        case "en_arret":
            return "badge badge-inactif";
        default:
            return "badge";
    }
}

export default function RackTable() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [racks, setRacks] = useState<Rack[]>([]);


    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem("dcim_token") || "";
                const res = await fetch(`/api/racks`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Erreur API ${res.status}`);
                }
                const data = await res.json();
                setRacks(data);
            } catch (err) {
                console.error("Erreur lors du chargement des racks", err);
                setRacks([]); // évite le crash sur .map
            }
        };
        load();
    }, []);



    const handleDelete = async (id: number) => {
        const confirmed = window.confirm("Voulez-vous vraiment supprimer ce rack ?");
        if (!confirmed) return;

        try {
            const response = await fetch(`http://localhost:3000/racks/${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setRacks(prev => prev.filter(rack => rack.id !== id));
            } else {
                alert("Erreur lors de la suppression du rack");
            }
        } catch (err) {
            console.error("Erreur réseau :", err);
            alert("Erreur lors de la suppression du rack");
        }
    };

    const totalRacks = racks.length;
    const racksActifs = racks.filter((r) => r.status === "en_marche").length;

    const filteredRacks = racks.filter((rack) =>
        rack.nom.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="rack-table-container">
            {/* Header : Titre + recherche */}
            <div className="rack-header">
                <h2 className="rack-title">Welcome to your DCIM Dashboard</h2>
                <input
                    type="text"
                    placeholder="Search Rack..."
                    className="rack-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Cartes info */}
            <div className="rack-cards">
                <div className="rack-card active">
                    <span className="card-icon">✅</span>
                    <p>{racksActifs}</p>
                    <span>Rack(s) Actif</span>
                </div>
                <div className="rack-card total">
                    <span className="card-icon">📦</span>
                    <p>{totalRacks}</p>
                    <span>Nombre total de Rack(s)</span>
                </div>
            </div>

            {/* Tableau + bouton ajouter */}
            <div className="rack-table-header">
                <h2>Liste des Racks</h2>
                <button
                    className="ajouter-btn"
                    onClick={() => navigate("/ajouter-rack")}
                >
                    + Ajouter Rack
                </button>
            </div>

            <table className="rack-table">
                <thead>
                <tr>
                    <th>#</th>
                    <th>Nom du Rack</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {filteredRacks.map((rack, index) => (
                    <tr key={rack.id} onDoubleClick={() => navigate(`/rack/${rack.id}`)} className="rack-row">
                        <td>{index + 1}</td>
                        <td
                            className="clickable-name"
                            onClick={() => navigate(`/rack/${rack.id}`)}
                        >
                            {rack.nom}
                        </td>

                        <td>
                                <span className={getBadgeClass(rack.status)}>
                                    {rack.status}
                                </span>
                        </td>
                        <td className="actions">
                            <button
                                className="btn supprimer"
                                onClick={() => handleDelete(rack.id)}
                            >
                                Effacer
                            </button>
                            <button
                                className="btn modifier"
                                onClick={() => navigate(`/rack/${rack.id}/modifier`)}
                            >
                                Modifier
                            </button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
