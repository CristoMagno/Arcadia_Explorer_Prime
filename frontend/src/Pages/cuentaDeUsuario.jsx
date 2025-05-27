import React, { useState, useEffect } from "react";
import {
  getAuth,
  onAuthStateChanged,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import styles from "../Estilos/cuentaDeUsuario.module.css";
import { db } from "./firebase-config";
import { IoArrowBack } from "react-icons/io5";

const CuentaDeUsuario = () => {
  const auth = getAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [rutas, setRutas] = useState([]); // 🔥 Lista de rutas guardadas
  const [firestoreData, setFirestoreData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    photoURL: "",
  });

  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [photoURL, setPhotoURL] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [, setDisplayNameState] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const resetMessages = () => {
    setError("");
    setSuccessMessage("");
  };

  useEffect(() => {
    // Suscribirse a los cambios de autenticación del usuario
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true); // Activar loading mientras se carga la información

      if (currentUser) {
        setUser(currentUser);
        setPhotoURL(currentUser.photoURL || "");

        // Referencia al documento Firestore del usuario
        const userDocRef = doc(db, "usuarios", currentUser.uid);

        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();

            // Actualizar datos del perfil
            setFirestoreData(userData);
            setFirstName(userData.firstName || "");
            setLastName(userData.lastName || "");
            setGender(userData.gender || "");
            setPhotoURL(userData.photoURL || "");

            // Construir displayName usando Firestore o fallback a auth
            const displayName =
              `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
              currentUser.displayName ||
              "";
            setDisplayNameState(displayName);
          } else {
            // Fallback si no hay documento Firestore (usar auth)
            const nameParts = currentUser.displayName?.split(" ") || [""];
            setFirstName(nameParts[0] || "");
            setLastName(nameParts.slice(1).join(" ") || "");
            setGender("");
            setDisplayNameState(currentUser.displayName || "");
          }
        } catch (firestoreError) {
          console.error("Error al cargar perfil Firestore:", firestoreError);
          setError(
            "Error al cargar datos adicionales del perfil. Usando datos de autenticación como respaldo."
          );

          // Fallback a auth data si Firestore falla
          const nameParts = currentUser.displayName?.split(" ") || [""];
          setFirstName(nameParts[0] || "");
          setLastName(nameParts.slice(1).join(" ") || "");
          setDisplayNameState(currentUser.displayName || "");
        }

        // Obtener rutas del usuario desde Firestore
        try {
          const rutasRef = collection(db, "rutas");
          const q = query(rutasRef, where("userId", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);

          // Mapear datos de rutas a un array con id y contenido
          const rutasData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRutas(rutasData);
        } catch (error) {
          console.error("Error al obtener rutas:", error);
          setError("Error al cargar rutas guardadas.");
        }
      } else {
        // Si no hay usuario autenticado, redirigir al login
        navigate("/login");
      }

      setLoading(false); // Desactivar loading una vez cargado todo
    });

    return () => {
      // Limpiar la suscripción al desmontar el componente
      unsubscribe();
    };

    // Dependencias para re-ejecutar el efecto cuando auth o navigate cambien
  }, [auth, navigate]);

  const handleProfileSaveChanges = async (e) => {
    e.preventDefault();
    if (!user) return;

    resetMessages();
    setIsSaving(true);

    const newDisplayNameForAuth = `${firstName} ${lastName}`.trim();

    try {
      // Actualizar perfil de autenticación solo si hay cambios reales
      const updates = {};
      if (auth.currentUser.displayName !== newDisplayNameForAuth) {
        updates.displayName = newDisplayNameForAuth;
      }
      if (auth.currentUser.photoURL !== photoURL) {
        updates.photoURL = photoURL;
      }

      if (Object.keys(updates).length > 0) {
        await updateProfile(auth.currentUser, updates);
      }

      // Preparar datos a guardar en Firestore
      const userDocRef = doc(db, "usuarios", user.uid);
      const updatedFirestoreData = {
        firstName,
        lastName,
        gender,
        photoURL,
        email: user.email,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userDocRef, updatedFirestoreData, { merge: true });

      // Actualizar estados locales para reflejar cambios
      setUser((prev) => ({
        ...prev,
        ...updates,
      }));

      setFirestoreData((prev) => ({
        ...prev,
        ...updatedFirestoreData,
      }));

      setDisplayNameState(newDisplayNameForAuth);
      setSuccessMessage("Perfil actualizado con éxito.");
    } catch (err) {
      setError(
        err.message || "No se pudo actualizar el perfil. Inténtalo de nuevo."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;
    resetMessages();

    // ANÁLISIS SEMÁNTICO: Estas comprobaciones (longitud de contraseña, coincidencia de contraseñas,
    // contraseña actual no vacía) son validaciones semánticas para asegurar que los datos
    // ingresados por el usuario cumplen con las reglas de negocio antes de procesarlos.
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Las nuevas contraseñas no coinciden.");
      return;
    }
    if (!currentPassword) {
      setError("Por favor, ingresa tu contraseña actual.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      setSuccessMessage("Contraseña actualizada con éxito.");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      // ANÁLISIS SEMÁNTICO: El manejo de errores específico basado en `err.code`
      // permite dar retroalimentación más precisa al usuario, lo cual es una forma
      // de validación semántica post-operación.
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("La contraseña actual es incorrecta.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Intenta más tarde.");
      } else {
        setError(err.message || "No se pudo actualizar la contraseña.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // OPTIMIZACIÓN: La carga condicional (mostrar "Cargando..." mientras `loading` es true)
  // mejora la experiencia del usuario al evitar mostrar una UI incompleta o vacía.
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        Cargando datos del usuario...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // GENERACIÓN DE CÓDIGO INTERMEDIO: El JSX que sigue es una sintaxis similar a HTML que no es
  // entendida directamente por los navegadores. Herramientas como Babel lo transforman
  // (transpilan) a llamadas de función `React.createElement()`, que es una especie de
  // código intermedio antes de que React genere la representación final en el DOM.
  return (
    <div className={styles.pageContainer}>
      <div className={styles.accountWrapper}>
        <header className={styles.accountHeader}>
          <h1>Mi Cuenta</h1>
        </header>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {successMessage && (
          <p className={styles.successMessage}>{successMessage}</p>
        )}

        <button
          type="button"
          className={`${styles.button} ${styles.mapButton}`}
          style={{ marginBottom: "20px" }}
          onClick={() => navigate("/mapa")}
        >
          <IoArrowBack size={30} />
        </button>

        {/* OPTIMIZACIÓN: El renderizado condicional (className={isChangingPassword ? styles.hiddenSection : ''})
            oculta o muestra secciones del formulario. Esto es una optimización porque el DOM no se
            manipula innecesariamente para elementos que no necesitan ser visibles. */}
        <form
          onSubmit={handleProfileSaveChanges}
          className={isChangingPassword ? styles.hiddenSection : ""}
        >
          <section className={styles.userDetailsSection}>
            <h2>Información del Perfil</h2>

            <div className={styles.profilePicturePreview}>
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Foto de perfil"
                  className={styles.profilePicture}
                />
              ) : (
                <div className={styles.profilePicturePlaceholder}>Sin foto</div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Email (no editable)</label>
              <input
                type="email"
                id="email"
                value={user.email || ""}
                className={styles.formInput}
                disabled
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="firstName">Nombre(s)</label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="lastName">Apellidos</label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="photoURL">
                URL de Foto de Perfil (.png, .jpg, etc)
              </label>
              <input
                type="url"
                id="photoURL"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className={styles.formInput}
                placeholder="https://example.com/image.png"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Género</label>
              <div className={styles.radioGroup}>
                {["Masculino", "Femenino", "Otro"].map((option) => (
                  <label
                    key={option}
                    className={`${styles.radioOption} ${
                      gender === option.toLowerCase()
                        ? styles.radioOptionChecked
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={option.toLowerCase()}
                      checked={gender === option.toLowerCase()}
                      onChange={(e) => setGender(e.target.value)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <p className={styles.uidText}>
              <strong>UID:</strong> {user.uid}
            </p>
          </section>

          <div className={styles.actionButtons}>
            <button
              type="submit"
              className={`${styles.button} ${styles.saveButton}`}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>

        {!isChangingPassword && (
          <div className={styles.actionButtons} style={{ marginTop: "20px" }}>
            <button
              type="button"
              className={`${styles.button} ${styles.changePasswordToggleButton}`}
              onClick={() => {
                setIsChangingPassword(true);
                resetMessages();
              }}
            >
              Cambiar Contraseña
            </button>
          </div>
        )}

        {isChangingPassword && (
          <form onSubmit={handlePasswordUpdate} style={{ marginTop: "20px" }}>
            <section className={styles.passwordChangeSection}>
              <h2>Cambiar Contraseña</h2>
              <div className={styles.formGroup}>
                <label htmlFor="currentPassword">Contraseña Actual</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="newPassword">Nueva Contraseña</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.formInput}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="confirmNewPassword">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.actionButtons}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.saveButton}`}
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword
                    ? "Actualizando..."
                    : "Actualizar Contraseña"}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.cancelButton}`}
                  style={{ marginLeft: "10px" }}
                  onClick={() => {
                    setIsChangingPassword(false);
                    resetMessages();
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                  }}
                  disabled={isUpdatingPassword}
                >
                  Cancelar
                </button>
              </div>
            </section>
          </form>
        )}

        <section
          className={`${styles.savedRoutesSection} ${
            isChangingPassword ? styles.hiddenSection : ""
          }`}
        >
          <h2>Rutas Guardadas</h2>
          <div className={styles.routesScrollContainer}>
            {rutas.length === 0 ? (
              <p>Actualmente no tienes rutas guardadas.</p>
            ) : (
              rutas.map((ruta) => (
                <div key={ruta.id} className={styles.routeCard}>
                  <h3>{ruta.nombreRuta}</h3>
                  <p>{ruta.descripcion || "Sin descripción."}</p>
                  <center>
                    <button
                      className={styles.showRouteButton}
                      onClick={() => {
                        if (
                          ruta.coordenadas &&
                          ruta.coordenadas.lat &&
                          ruta.coordenadas.lng
                        ) {
                          // Redirigir a GoogleMaps con las coordenadas del destino como parámetros de la URL
                          navigate(
                            `/mapa?lat=${ruta.coordenadas.lat}&lng=${ruta.coordenadas.lng}`
                          );
                        } else {
                          alert("La ruta no tiene coordenadas válidas.");
                        }
                      }}
                    >
                      Ver esta ruta
                    </button>
                  </center>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
  // GENERACIÓN DE CÓDIGO OBJETO: Aunque no lo vemos directamente aquí, el código JavaScript final
  // (después de la transpilación de JSX y el empaquetado) es interpretado y ejecutado por el motor
  // JavaScript del navegador. Este motor puede realizar compilación Just-In-Time (JIT) para convertir
  // el JavaScript en código máquina nativo para una ejecución más rápida. Ese código máquina es
  // análogo al "código objeto".
};

export default CuentaDeUsuario;
