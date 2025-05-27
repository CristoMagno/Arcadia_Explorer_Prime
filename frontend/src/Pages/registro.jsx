import React, { useState, useCallback, memo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "../Estilos/registro.module.css";
import logo from "../Images/logo.jpeg";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebase-config";
import logopng from "../Images/logopng.png";
import ErrorBanner from "../Components/errorbanner";
import SuccessBanner from "../Components/SuccessBanner";
import { IoEye } from "react-icons/io5";
import { IoEyeOffSharp } from "react-icons/io5";

const auth = getAuth(app);

// OPTIMIZACIÓN: `memo` es un Higher Order Component (HOC) que memoriza el componente `InputField`.
// React omitirá el re-renderizado del componente si sus props no han cambiado.
// Esto es una optimización de rendimiento, especialmente útil en listas largas o componentes complejos.
const InputField = memo(
  ({ label, id, name, type, placeholder, value, onChange, required }) => (
    <div className={styles["input-group"]}>
      <label htmlFor={id}>{label}</label>
      <input
        type={type}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  )
);
InputField.displayName = "InputField"; // Buena práctica para debugging con React DevTools

// OPTIMIZACIÓN: Similar a InputField, PasswordField está memorizado con `memo`.
const PasswordField = memo(
  ({
    label,
    id,
    name,
    placeholder,
    value,
    onChange,
    required,
    showPassword,
    onTogglePassword,
  }) => (
    <div className={styles["form-group"]}>
      <label htmlFor={id}>{label}</label>
      <div className={styles["password-input"]}>
        <input
          type={showPassword ? "text" : "password"}
          id={id}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
         <button
                type="button"
                onClick={onTogglePassword}
                className={styles["toggle-password"]}
              >
                {showPassword ? <IoEye size={24}/> : <IoEyeOffSharp size={24}/>}
              </button>
      </div>
    </div>
  )
);
PasswordField.displayName = "PasswordField";

// OPTIMIZACIÓN: RadioGroup también está memorizado con `memo`.
const RadioGroup = memo(
  ({ label, name, options, selectedValue, onChange, required }) => (
    <div className={styles["form-group"]}>
      <label>{label}</label>
      <div className={styles["radio-group"]}>
        {options.map((option) => (
          <label
            key={option}
            className={`${styles["radio-option"]} ${
              selectedValue === option.toLowerCase()
                ? styles["radio-option--checked"]
                : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.toLowerCase()}
              checked={selectedValue === option.toLowerCase()}
              onChange={onChange}
              required={required}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  )
);
RadioGroup.displayName = "RadioGroup";

export default function Registro() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [successKey, setSuccessKey] = useState(0);

  useEffect(() => {
    let errorTimer;
    if (errorMessage) {
      errorTimer = setTimeout(() => setErrorMessage(""), 2000);
    }
    return () => clearTimeout(errorTimer);
  }, [errorMessage, errorKey]);

  useEffect(() => {
    let successTimer;
    if (successMessage) {
      successTimer = setTimeout(() => setSuccessMessage(""), 2000);
    }
    return () => clearTimeout(successTimer);
  }, [successMessage, successKey]);

  const showError = (message) => {
    setErrorMessage(message);
    setErrorKey(prevKey => prevKey + 1);
    setSuccessMessage("");
  };

  const showSuccess = (message, redirectPath) => {
    setSuccessMessage(message);
    setSuccessKey(prevKey => prevKey + 1);
    setErrorMessage("");
    setTimeout(() => {
      navigate(redirectPath);
    }, 2000);
  };

  // OPTIMIZACIÓN: `useCallback` memoriza la función `handleInputChange`.
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // OPTIMIZACIÓN: `useCallback` memoriza la función `togglePasswordVisibility`.
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const { email, password, firstName, lastName, gender } = formData;

      // ANÁLISIS SEMÁNTICO: Estas validaciones (contraseña no vacía, longitud mínima,
      // campos obligatorios) verifican que los datos ingresados por el usuario cumplan
      // con las reglas de negocio (semántica) antes de proceder con el registro.
      // Si no se cumplen, se muestra un error y la operación se detiene.
      if (!password || password.trim() === "") {
        showError("La contraseña no puede estar vacía.");
        return;
      }
      if (password.length < 6) {
        showError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (!firstName.trim() || !lastName.trim() || !gender.trim() || !email.trim()) {
        showError("Todos los campos son obligatorios.");
        return;
      }

      createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          await setDoc(doc(db, "usuarios", user.uid), {
            firstName,
            lastName,
            gender,
            email,
            createdAt: new Date(),
          });
          showSuccess("¡Registro exitoso! Redirigiendo...", "/inicioSesion");
        })
        .catch((error) => {
          let friendlyMessage = "Error al registrarse. Inténtalo de nuevo.";
          // ANÁLISIS SEMÁNTICO: Similar al inicio de sesión, el switch case analiza el `error.code`
          // de Firebase para interpretar el significado del error y dar retroalimentación precisa.
          switch (error.code) {
            case "auth/email-already-in-use":
              friendlyMessage = "Este correo electrónico ya está en uso.";
              break;
            case "auth/invalid-email":
              friendlyMessage = "El formato del correo electrónico no es válido.";
              break;
            case "auth/weak-password":
              friendlyMessage = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
              break;
            case "auth/operation-not-allowed":
              friendlyMessage = "El registro por correo y contraseña no está habilitado.";
              break;
            default:
              friendlyMessage = "Ocurrió un error al registrarse. Por favor, inténtalo de nuevo.";
          }
          showError(friendlyMessage);
        });
    },
    [formData, navigate] // `auth` y `db` también son dependencias si se definen dentro o pueden cambiar.
                           // `showError` y `showSuccess` si no están memorizadas y se definen en el componente.
  );

  // GENERACIÓN DE CÓDIGO INTERMEDIO: El JSX que se utiliza a continuación para definir la interfaz de usuario
  // (formularios, campos de entrada, botones) es una extensión de la sintaxis de JavaScript.
  // No es interpretado directamente por los navegadores. Herramientas como Babel
  // lo transforman en llamadas a `React.createElement()`. Este paso de transformación
  // es análogo a la generación de código intermedio en un proceso de compilación.
  return (
    <div className={styles["signup-container"]}>
      {errorMessage && <ErrorBanner key={errorKey} message={errorMessage} />}
      {successMessage && <SuccessBanner key={successKey} message={successMessage} />}
      <div className={styles["signup-wrapper"]}>
        <div className={styles["signup-image-panel"]}>
          <img
            src={logo}
            alt="Registro"
            className={styles["signup-image"]}
            loading="lazy"
          />
        </div>
        <div className={styles["signup-form-panel"]}>
          <div>
            <h2 className={styles["login-title-container"]}>
              <img
                src={logopng}
                alt="Logo"
                className={styles["login-logo"]}
                loading="lazy"
              />
              <span>Crear Cuenta</span>
            </h2>
          </div>
          <p>Ingresa tus datos personales para crear tu cuenta.</p>
          <form onSubmit={handleSubmit}>
            <div className={styles["name-inputs"]}>
              <InputField
                label="Nombre"
                id="firstName"
                name="firstName"
                type="text"
                placeholder="ej. Juan"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
              <InputField
                label="Apellido"
                id="lastName"
                name="lastName"
                type="text"
                placeholder="ej. Pérez"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>
            <RadioGroup
              label="Género"
              name="gender"
              options={["Masculino", "Femenino", "Otro"]}
              selectedValue={formData.gender}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Correo Electrónico"
              id="email"
              name="email"
              type="email"
              placeholder="ej. juan.perez@gmail.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <PasswordField
              label="Contraseña"
              id="password"
              name="password"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={handleInputChange}
              required
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
            />
            <button type="submit" className={styles["submit-button"]}>
              Registrarse
            </button>
            <div className={styles["login-link"]}>
              <p>
                ¿Ya tienes una cuenta?{" "}
                <Link to="/inicioSesion">Inicia sesión</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
  // GENERACIÓN DE CÓDIGO OBJETO: El código JavaScript resultante (después de la transpilación de JSX,
  // la lógica de los componentes y el empaquetado por herramientas como Webpack) es lo que finalmente
  // se envía al navegador. El motor JavaScript del navegador (como V8 en Chrome) interpreta y ejecuta
  // este código. Para mejorar el rendimiento, estos motores a menudo realizan una compilación
  // Just-In-Time (JIT), convirtiendo el JavaScript en código máquina nativo para la CPU.
  // Este código máquina es el equivalente al "código objeto" en este contexto de desarrollo web.
}