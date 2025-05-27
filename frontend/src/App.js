import React, { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import './Estilos/global.css'; // Asegúrate que este archivo exista y tenga estilos globales si es necesario
import GoogleMaps from "./Pages/GoogleMaps";
import Registro from "./Pages/registro";
import InicioSesion from "./Pages/inicioSesion";
import SplashScreen from "./Components/SplashScreen";
import CuentaDeUsuario from "./Pages/cuentaDeUsuario";
import './Estilos/SplashScreen.module.css'; // Asegúrate que este archivo exista

// Importaciones de Firebase
import { getAuth, onAuthStateChanged } from "firebase/auth";
// Sería ideal que inicialices Firebase y exportes 'auth' desde tu archivo firebase-config.js
// import { auth } from './firebase-config'; // O la ruta correcta a tu config
// Si no, getAuth() usará la instancia de la app por defecto si Firebase ya fue inicializada.
const auth = getAuth();

const SPLASH_DISPLAY_TIME = 2000;
const FADE_OUT_DURATION = 1500;

const App = () => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false); // Estado para rastrear si el usuario está logueado
  const [authChecked, setAuthChecked] = useState(false); // Estado para rastrear si la verificación inicial de auth ha terminado

  useEffect(() => {
    // Lógica del Splash Screen
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, SPLASH_DISPLAY_TIME);

    const removeSplashTimer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DISPLAY_TIME + FADE_OUT_DURATION);

    // Listener para el estado de autenticación de Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Usuario está logueado
        setIsUserLoggedIn(true);
      } else {
        // Usuario no está logueado
        setIsUserLoggedIn(false);
      }
      setAuthChecked(true); // Marcar que la verificación de auth ha finalizado
    });

    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(removeSplashTimer);
      unsubscribe(); // Desuscribirse del listener de auth
    };
  }, []); // El array vacío asegura que esto se ejecute solo una vez al montar

  // Mostrar Splash Screen
  if (showSplash) {
    return (
      <div className={`splashContainer ${isFadingOut ? 'splashContainerHidden' : ''}`}>
        <SplashScreen />
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em' }}>
        Verificando sesión...
      </div>
    );
  }

  // Una vez que el splash ha terminado y el estado de auth ha sido verificado, renderizar las rutas
  return (
    <div className="Todo">
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas que redirigen a /mapa si el usuario ya está logueado */}
          <Route
            path="/"
            element={isUserLoggedIn ? <Navigate to="/mapa" replace /> : <InicioSesion />}
          />
          <Route
            path="/login"
            element={<InicioSesion />}
          />
          <Route
            path="/signup"
            element={<Registro />}
          />

          <Route
            path="/mapa"
            element={<GoogleMaps />}
           
          />
          <Route
            path="/account"
            element={!isUserLoggedIn ? <Navigate to="/login" replace /> : <CuentaDeUsuario />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;