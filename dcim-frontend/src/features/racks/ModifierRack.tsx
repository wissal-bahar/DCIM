import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ModifierRack.css";

export default function ModifierRack() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [rack, setRack] = useState({
        nom: "",
        status: "",
        localisation: "",
        nbUnites: 42,
        description: "",
    });

    useEffect(() => {
        const fetchRack = async () => {
            try {
                const response = await fetch(`http://localhost:3000/racks/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setRack(data);
                } else {
                    alert("Erreur lors du chargement du rack");
                }
            } catch (error) {
                console.error("Erreur réseau :", error);
            }
        };

        fetchRack();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setRack({ ...rack, [name]: value });
    };

    const handleSubmit = async () => {
        try {
            const response = await fetch(`http://localhost:3000/racks/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(rack),
            });

            if (response.ok) {
                navigate("/racks");
            } else {
                alert("Erreur lors de la modification du rack");
            }
        } catch (error) {
            console.error("Erreur réseau :", error);
        }
    };

    return (
        <div className="modifier-rack-container">
            <h2>Modifier le rack</h2>
            <div className="formulaire-rack">
                <div className="form-colonne">
                    <input
                        type="text"
                        name="nom"
                        placeholder="Nom ..."
                        value={rack.nom}
                        onChange={handleChange}
                        className="modifier-input"
                    />
                    <select
                        name="status"
                        value={rack.status}
                        onChange={handleChange}
                        className="modifier-input"
                    >
                        <option value="">-- Sélectionnez un statut --</option>
                        <option value="prototype">Prototype</option>
                        <option value="en_marche">En marche</option>
                        <option value="en_arret">En arrêt</option>
                    </select>
                    <input
                        type="text"
                        name="localisation"
                        placeholder="Localisation ..."
                        value={rack.localisation}
                        onChange={handleChange}
                        className="modifier-input"
                    />
                    <input
                        type="number"
                        name="nbUnites"
                        placeholder="Nombre d'unités ..."
                        value={rack.nbUnites}
                        onChange={handleChange}
                        className="modifier-input"
                    />
                </div>
                <textarea
                    name="description"
                    placeholder="Description ..."
                    value={rack.description}
                    onChange={handleChange}
                />
            </div>
            <div className="boutons">
                <button className="annuler" onClick={() => navigate("/racks")}>Annuler</button>
                <button className="ajouter" onClick={handleSubmit}>Enregistrer</button>
            </div>
        </div>
    );
}
