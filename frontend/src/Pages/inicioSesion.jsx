import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import styles from "../Estilos/inicioSesion.module.css";
import logo from "../Images/logo.jpeg";
import logopng from "../Images/logopng.png";
import logoGoogle from "../Images/g-logo.png";
import { db } from "./firebase-config";
import ConfirmationDialog from "../Components/ConfirmationDialog";
import ErrorBanner from "../Components/errorbanner";
import SuccessBanner from "../Components/SuccessBanner";
import { IoEye } from "react-icons/io5";
import { IoEyeOffSharp } from "react-icons/io5";

const auth = getAuth();
const provider = new GoogleAuthProvider();

export default function InicioSesion() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [successKey, setSuccessKey] = useState(0);

  const [viewMode, setViewMode] = useState("login");
  const [resetEmail, setResetEmail] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let errorTimer;
    if (errorMessage) {
      errorTimer = setTimeout(() => setErrorMessage(""), 3000);
    }
    return () => clearTimeout(errorTimer);
    // ANÁLISIS SEMÁNTICO: Las dependencias [errorMessage, errorKey] aseguran que este efecto,
    // encargado de limpiar el mensaje de error después de un tiempo, se ejecute
    // correctamente cuando el mensaje de error cambie o su key (para forzar el reinicio) se actualice.
    // Esto mantiene una semántica de "mensaje temporal".
  }, [errorMessage, errorKey]);

  useEffect(() => {
    let successTimer;
    if (successMessage) {
      successTimer = setTimeout(() => setSuccessMessage(""), 3000);
    }
    return () => clearTimeout(successTimer);
  }, [successMessage, successKey]);

  const showError = (message) => {
    setErrorMessage(message);
    setErrorKey((prevKey) => prevKey + 1);
    setSuccessMessage("");
  };

  const showSuccess = (message, redirectPath, delay = 2000) => {
    setSuccessMessage(message);
    setSuccessKey((prevKey) => prevKey + 1);
    setErrorMessage("");
    if (redirectPath) {
      setTimeout(() => {
        navigate(redirectPath);
      }, delay);
    }
  };

  // OPTIMIZACIÓN: `useCallback` memoriza la función `handleInputChange`.
  // Esto evita que la función se cree de nuevo en cada renderizado si no cambian sus dependencias (ninguna en este caso).
  // Es útil si esta función se pasa como prop a componentes hijos optimizados.
  const handleInputChange = useCallback((e) => {
    const { id, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [id]: value,
    }));
  }, []);

  const handleResetEmailChange = useCallback((e) => {
    setResetEmail(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const { email, password } = formData;

      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          const userRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(userRef);
          let displayName = user.email;

          if (docSnap.exists()) {
            const userData = docSnap.data();
            displayName = userData.firstName || user.email;
          } else {
            await setDoc(userRef, {
              email: user.email,
              firstName: user.displayName ? user.displayName.split(" ")[0] : "",
              lastName: user.displayName ? user.displayName.split(" ")[1] : "",
              gender: "no especificado",
              createdAt: new Date(),
            });
            displayName = user.displayName ? user.displayName.split(" ")[0] : user.email;
          }
          showSuccess(`¡Bienvenido, ${displayName}!`, "/mapa");
        })
        .catch((error) => {
          let friendlyMessage = "Error al iniciar sesión. Inténtalo de nuevo.";
          // ANÁLISIS SEMÁNTICO: El switch case analiza el `error.code` de Firebase
          // para determinar la naturaleza del error y proporcionar un mensaje más específico y
          // comprensible al usuario. Esto es una interpretación semántica del código de error.
          switch (error.code) {
            case "auth/user-not-found":
            case "auth/invalid-user-token":
              friendlyMessage = "Usuario no encontrado. Verifica tu correo.";
              break;
            case "auth/wrong-password":
              friendlyMessage = "Contraseña incorrecta. Inténtalo de nuevo.";
              break;
            case "auth/invalid-email":
              friendlyMessage = "El correo electrónico no es válido.";
              break;
            case "auth/too-many-requests":
              friendlyMessage = "Demasiados intentos fallidos. Intenta más tarde.";
              break;
            case "auth/invalid-credential":
              friendlyMessage = "Credenciales inválidas. Verifica tu correo y contraseña.";
              break;
            default:
              friendlyMessage = "Error al iniciar sesión. Por favor, inténtalo de nuevo.";
          }
          showError(friendlyMessage);
        });
    },
    [formData, navigate]
  );

  const handleGoogleSignIn = useCallback(() => {
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        const userRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userRef);
        let displayName = user.displayName || user.email;

        if (!docSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            firstName: user.displayName ? user.displayName.split(" ")[0] : "",
            lastName: user.displayName ? user.displayName.split(" ")[1] : "",
            gender: "no especificado",
            createdAt: new Date(),
          });
          displayName = user.displayName ? user.displayName.split(" ")[0] : user.email;
        } else {
          const userData = docSnap.data();
          displayName = userData.firstName || user.displayName || user.email;
        }
        showSuccess(`¡Bienvenido, ${displayName}!`, "/mapa");
      })
      .catch((error) => {
        let friendlyMessage = "Error con Google. Inténtalo de nuevo.";
        if (error.code === "auth/popup-closed-by-user") {
          friendlyMessage = "Cancelaste el inicio de sesión con Google.";
        } else if (error.code === "auth/cancelled-popup-request") {
          friendlyMessage = "Se canceló la solicitud de inicio con Google.";
        } else if (error.code === "auth/account-exists-with-different-credential") {
          friendlyMessage = "Ya existe una cuenta con este correo, pero con un método de inicio de sesión diferente.";
        }
        showError(friendlyMessage);
      });
  }, [navigate]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prevState) => !prevState);
  }, []);

  const handleContinueWithoutLogin = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const handleConfirmContinue = useCallback(() => {
    setShowConfirmation(false);
    signOut(auth);
    navigate("/mapa");
  }, [navigate]);

  const handleCancelContinue = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  const handleForgotPasswordClick = () => {
    setViewMode("forgotPassword");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleBackToLoginClick = () => {
    setViewMode("login");
    setResetEmail("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSendResetEmail = useCallback((e) => {
    e.preventDefault();
    // ANÁLISIS SEMÁNTICO: Se verifica que `resetEmail` no esté vacío antes de intentar
    // enviar el correo. Esta es una validación semántica simple para asegurar que la operación tiene sentido.
    if (!resetEmail) {
      showError("Por favor, ingresa tu correo electrónico.");
      return;
    }
    sendPasswordResetEmail(auth, resetEmail)
      .then(() => {
        showSuccess("Correo de restablecimiento enviado. Revisa tu bandeja de entrada (y spam).", null, 5000);
        setViewMode("login");
      })
      .catch((error) => {
        if (error.code === "auth/user-not-found") {
          showError("No se encontró un usuario con ese correo electrónico.");
        } else if (error.code === "auth/invalid-email") {
          showError("El formato del correo electrónico no es válido.");
        } else {
          showError("Error al enviar el correo. Inténtalo de nuevo.");
        }
      });
  }, [resetEmail, auth]);

  // GENERACIÓN DE CÓDIGO INTERMEDIO: El JSX que sigue (elementos div, form, input, button, Link)
  // no es JavaScript estándar. Herramientas como Babel lo traducen a llamadas
  // `React.createElement(...)`. Esta traducción es análoga a la generación de código intermedio
  // en un compilador, donde una sintaxis de alto nivel se convierte a una forma más manejable
  // por el runtime (en este caso, React).
  return (
    <div className={styles["login-container"]}>
      {errorMessage && <ErrorBanner key={`err-${errorKey}`} message={errorMessage} />}
      {successMessage && <SuccessBanner key={`succ-${successKey}`} message={successMessage} />}
      <div className={styles["login-wrapper"]}>
        <div className={styles["login-image-panel"]}>
          <img
            src={logo}
            alt="Imagen de login"
            className={styles["login-image"]}
            loading="lazy"
          />
        </div>
        <div className={styles["login-form-panel"]}>
          {/* OPTIMIZACIÓN: El renderizado condicional (viewMode === 'login' o 'forgotPassword')
              asegura que solo se renderice el formulario necesario. Esto reduce la cantidad
              de nodos en el DOM y el trabajo que React tiene que hacer para las actualizaciones. */}
          {viewMode === "login" && (
            <>
              <div>
                <h2 className={styles["login-title-container"]}>
                  <img
                    src={logopng}
                    alt="Logo"
                    className={styles["login-logo"]}
                    loading="lazy"
                  />
                  <span>Iniciar sesión</span>
                </h2>
              </div>
              <p>Ingresa tus credenciales para acceder.</p>
              <form onSubmit={handleSubmit}>
                <div className={styles["form-group"]}>
                  <label htmlFor="email">Correo Electrónico</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="ej. juan.perez@gmail.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles["form-group"]}>
                  <label htmlFor="password">Contraseña</label>
                  <div className={styles["password-input"]}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      placeholder="Ingresa tu contraseña"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className={styles["toggle-password"]}
                    >
                      {showPassword ? <IoEye size={24} /> : <IoEyeOffSharp size={24} />}
                    </button>
                  </div>
                </div>
                <div className={styles["forgot-password-link"]}>
                  <button type="button" onClick={handleForgotPasswordClick} className={styles["link-button"]}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <button type="submit" className={styles["login-button"]}>
                  Iniciar sesión
                </button>
                <div className={styles["login-link"]}>
                  <p>
                    ¿No tienes cuenta? <Link to="/signup">Regístrate</Link>
                  </p>
                </div>
              </form>
              <button
                type="button"
                className={styles["google-button"]}
                onClick={handleGoogleSignIn}
              >
                <img
                  src={logoGoogle}
                  alt="Google"
                  className={styles["google-icon"]}
                />
                Continuar con Google
              </button>
              <button
                onClick={handleContinueWithoutLogin}
                className={styles["continue-button"]}
              >
                Continuar sin iniciar sesión
              </button>
            </>
          )}

          {viewMode === "forgotPassword" && (
            <>
              <div>
                <h2 className={styles["login-title-container"]}>
                  <img
                    src={logopng}
                    alt="Logo"
                    className={styles["login-logo"]}
                    loading="lazy"
                  />
                  <span>Restablecer Contraseña</span>
                </h2>
              </div>
              <p>Ingresa tu correo electrónico para recibir un enlace de restablecimiento.</p>
              <form onSubmit={handleSendResetEmail}>
                <div className={styles["form-group"]}>
                  <label htmlFor="resetEmail">Correo Electrónico</label>
                  <input
                    type="email"
                    id="resetEmail"
                    placeholder="ej. juan.perez@gmail.com"
                    value={resetEmail}
                    onChange={handleResetEmailChange}
                    required
                  />
                </div>
                <button type="submit" className={styles["login-button"]}>
                  Enviar Correo de Restablecimiento
                </button>
              </form>
              <div className={styles["login-link"]} style={{ marginTop: '15px' }}>
                <button type="button" onClick={handleBackToLoginClick} className={styles["link-button"]}>
                  Volver a Iniciar Sesión
                </button>
              </div>
            </>
          )}

          <ConfirmationDialog
            isOpen={showConfirmation}
            message="¿Estás seguro de que deseas continuar sin iniciar sesión? Perderás el acceso a funciones personalizadas."
            onConfirm={handleConfirmContinue}
            onCancel={handleCancelContinue}
          />
        </div>
      </div>
    </div>
  );
  // GENERACIÓN DE CÓDIGO OBJETO: Aunque no es visible aquí, el motor JavaScript del navegador
  // toma el código JavaScript final (producto de la transpilación y empaquetado) y lo ejecuta.
  // Para optimizar la ejecución, los motores modernos realizan compilación Just-In-Time (JIT),
  // convirtiendo partes del JavaScript en código máquina específico para la CPU del usuario.
  // Este código máquina es el "código objeto" en este contexto.
}