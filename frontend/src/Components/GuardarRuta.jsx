import React, { useState, useEffect } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../Pages/firebase-config";
import { getAuth } from "firebase/auth";
import "./GuardarRuta.css";
import SuccessBanner from "./SuccessBanner"; // Importa el componente

export default function GuardarRuta({
  isOpen,
  onClose,
  lugarCoordenadas,
  nombreLugar,
}) {
  const [nombreRuta, setNombreRuta] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [mensaje, setMensaje] = useState(""); // Estado para mostrar mensaje

  useEffect(() => {
    if (nombreLugar) {
      setNombreRuta(nombreLugar);
    }
  }, [nombreLugar]);

  const handleGuardar = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      window.location.href = "/signup";
      return;
    }

    if (!lugarCoordenadas) {
      setMensaje("No se proporcionaron coordenadas del destino.");
      return;
    }

    try {
      await addDoc(collection(db, "rutas"), {
        userId: user.uid,
        nombreRuta,
        descripcion,
        coordenadas: lugarCoordenadas,
        createdAt: new Date(),
      });

      setMensaje("¡Ruta guardada exitosamente!");
      setTimeout(() => {
        setMensaje(""); // Limpia el mensaje después de unos segundos
        onClose(); // Cierra el modal
      }, 3000);
    } catch (error) {
      console.error("Error al guardar la ruta:", error);
      setMensaje("Hubo un error al guardar la ruta. Inténtalo de nuevo.");
      setTimeout(() => setMensaje(""), 4000); // Limpia el mensaje después de unos segundos
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Guardar Ruta Personalizada</h2>
        <input
          type="text"
          placeholder="Nombre de la ruta"
          value={nombreRuta}
          onChange={(e) => setNombreRuta(e.target.value)}
        />
        <textarea
          placeholder="Descripción o nota de la ruta"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        ></textarea>
        <div className="modal-buttons">
          <button onClick={handleGuardar}>Guardar</button>
          <button onClick={onClose}>Cancelar</button>
        </div>
        {mensaje && <SuccessBanner message={mensaje} />} {/* Banner debajo */}
      </div>
    </div>
  );
}
