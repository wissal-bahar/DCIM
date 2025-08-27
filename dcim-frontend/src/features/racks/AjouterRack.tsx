import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AjouterRack.css";

export default function AjouterRack() {
    const navigate = useNavigate();

    const [rack, setRack] = useState({
        nom: "",
        status: "",
        localisation: "",
        nbUnites: 42,
        description: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setRack({ ...rack, [name]: value });
    };

    const handleSubmit = async () => {
        try {
            const response = await fetch("http://localhost:3000/racks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(rack),
            });

            if (response.ok) {
                alert("Rack ajouté avec succès !");
                navigate("/racks");
            } else {
                alert("Erreur lors de l'ajout du rack");
            }
        } catch (error) {
            console.error("Erreur réseau", error);
            alert("Erreur réseau lors de l'ajout");
        }
    };

    return (
        <div className="ajouter-rack-container">
            <h2>Ajouter un rack</h2>
            <div className="formulaire-rack">
                <div className="form-colonne">
                    <input
                        type="text"
                        name="nom"
                        placeholder="Nom ..."
                        value={rack.nom}
                        onChange={handleChange}
                        className="ajouter-input"
                    />

                    <select
                        name="status"
                        value={rack.status}
                        onChange={(e) => setRack({ ...rack, status: e.target.value })}
                        className="ajouter-input"
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
                        className="ajouter-input"
                    />

                    <input
                        type="number"
                        name="nbUnites"
                        placeholder="Nombre d'unités ..."
                        value={rack.nbUnites}
                        onChange={handleChange}
                        className="ajouter-input"
                    />
                </div>

                {/*  Ajout du wrapper ici */}
                <div className="form-colonne">
                    <textarea
                        name="description"
                        placeholder="Description ..."
                        value={rack.description}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <div className="boutons">
                <button className="annuler" onClick={() => navigate("/racks")}>
                    Annuler
                </button>
                <button className="ajouter" onClick={handleSubmit}>
                    Ajouter
                </button>
            </div>
        </div>
    );
}
