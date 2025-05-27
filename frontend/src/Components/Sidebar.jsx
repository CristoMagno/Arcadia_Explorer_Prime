// frontend/src/Components/Sidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaBars, FaRoute, FaSignOutAlt, FaTrashAlt } from "react-icons/fa"; // FaListUl eliminada si no se usa más
import { BiLogIn } from "react-icons/bi";
import { IoPeopleOutline } from "react-icons/io5";
import { NavLink, useNavigate } from 'react-router-dom';
import '../Estilos/Sidebar.css'; // Asegúrate que la ruta sea correcta
import logoPng from '../Images/logopng.png'; // Asegúrate que la ruta sea correcta
import { MdOutlineDeveloperBoard } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaUserCircle } from "react-icons/fa";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";


const Sidebar = ({ 
onTogglePredefinedRoutes, 
  arePredefinedRoutesVisible 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenuIndex, setExpandedMenuIndex] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
   const auth = getAuth()

  const [showGpsMessage, setShowGpsMessage] = useState(false);
  const [gpsMessageText, setGpsMessageText] = useState('');
  const [gpsConnected, setGpsConnected] = useState(false);
  const [isAttemptingConnection, setIsAttemptingConnection] = useState(false);
  
  const [connectionAttemptTimeoutId, setConnectionAttemptTimeoutId] = useState(null); // Renombrado para claridad
  const wsRef = useRef(null);

  const clearConnectionAttemptTimeout = useCallback(() => {
    if (connectionAttemptTimeoutId) {
      clearTimeout(connectionAttemptTimeoutId);
      setConnectionAttemptTimeoutId(null);
    }
  }, [connectionAttemptTimeoutId]);

  useEffect(() => {
    if (!wsRef.current) {
        wsRef.current = new WebSocket('ws://localhost:8080');
        wsRef.current.onopen = () => console.log('Sidebar WebSocket connected');
        wsRef.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'gps_status') {
                    const { status, message: statusMessage } = message.payload;
                    if (status === 'waiting_for_valid_data') {
                        setIsAttemptingConnection(true); setGpsConnected(false);
                        setGpsMessageText(statusMessage || 'Esperando datos GPS válidos...');
                        setShowGpsMessage(true);
                    } else if (status === 'disconnected' || status === 'disconnected_error' || status === 'script_launch_error' || status === 'script_error') {
                        clearConnectionAttemptTimeout(); setIsAttemptingConnection(false); setGpsConnected(false);
                        setGpsMessageText(statusMessage || 'GPS desconectado o error.');
                        setShowGpsMessage(true); window.dispatchEvent(new CustomEvent('gps-connection-lost'));
                        setTimeout(() => setShowGpsMessage(false), 7000);
                    }
                } else if (message.type === 'gps_update' && message.payload.lat) {
                    clearConnectionAttemptTimeout();
                    if (!gpsConnected) { 
                        setGpsMessageText("GPS conectado y recibiendo datos."); setShowGpsMessage(true);
                        setTimeout(() => setShowGpsMessage(false), 5000);
                    }
                    setGpsConnected(true); setIsAttemptingConnection(false);
                    window.dispatchEvent(new CustomEvent('gps-data-active')); 
                }
            } catch (error) { console.error('Error processing WebSocket message in Sidebar:', error); }
        };
        wsRef.current.onclose = () => console.log('Sidebar WebSocket disconnected');
        wsRef.current.onerror = (error) => {
            console.error('Sidebar WebSocket error:', error); setGpsMessageText("Error de conexión con el servidor GPS.");
            setShowGpsMessage(true); setIsAttemptingConnection(false); setGpsConnected(false);
            clearConnectionAttemptTimeout(); setTimeout(() => setShowGpsMessage(false), 7000);
        };
    }
    return () => clearConnectionAttemptTimeout();
  }, [gpsConnected, clearConnectionAttemptTimeout]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, [auth]);

  const toggle = () => {
    if (isOpen) setExpandedMenuIndex(null);
    setIsOpen(!isOpen);
  };

  const toggleSubMenu = (index) => {
    if (!isOpen) { setIsOpen(true); setExpandedMenuIndex(index); } 
    else { setExpandedMenuIndex(prevIndex => (prevIndex === index ? null : index)); }
  };
  
  const disconnectGps = useCallback(() => { // Definida aquí para que handleLogout y handleExternalGpsClick la usen
    clearConnectionAttemptTimeout();
    // setGpsMessageText("Desconectando GPS..."); // Opcional, el backend suele responder
    // setShowGpsMessage(true);
    fetch('http://localhost:3001/api/disconnect-gps')
      .then(response => response.json())
      .then(data => {
        setGpsMessageText(data.message || "Solicitud de desconexión GPS enviada.");
        setShowGpsMessage(true); // Mostrar mensaje de respuesta
         // El estado de gpsConnected debería actualizarse via WebSocket status message
      })
      .catch(error => {
        setGpsMessageText("Error al desconectar GPS. Forzando estado local.");
        setShowGpsMessage(true);
      })
      .finally(() => {
         // No cambiar gpsConnected aquí directamente, esperar mensaje de WS
        setIsAttemptingConnection(false); // Sí resetear esto
        setTimeout(() => setShowGpsMessage(false), 5000);
      });
  }, [clearConnectionAttemptTimeout]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (gpsConnected || isAttemptingConnection) { // Si el GPS estaba activo o intentando conectar
        disconnectGps(); 
      }
      navigate('/login');
    } catch (error) { console.error("Error al cerrar sesión:", error); }
  };
  
  const handleExternalGpsClick = useCallback(() => {
    clearConnectionAttemptTimeout(); 
    if (gpsConnected) { disconnectGps(); return; }
    if (isAttemptingConnection) { return; } // Ya está intentando

    setIsAttemptingConnection(true); setGpsConnected(false); 
    setGpsMessageText("Iniciando conexión GPS..."); setShowGpsMessage(true);

    const timeoutId = setTimeout(() => {
      if (isAttemptingConnection && !gpsConnected) { 
        setGpsMessageText("Error: Tiempo de espera agotado. Verifica el dispositivo GPS.");
        setShowGpsMessage(true); setIsAttemptingConnection(false); 
        setTimeout(() => setShowGpsMessage(false), 7000);
      }
    }, 25000); 
    setConnectionAttemptTimeoutId(timeoutId);

    fetch('http://localhost:3001/api/connect-gps')
      .then(response => response.ok ? response.json() : response.json().then(err => { throw new Error(err.message || `Error: ${response.status}`) }))
      .then(data => { if (!data.success) throw new Error(data.message || "Fallo al iniciar GPS desde servidor.");})
      .catch(error => {
        clearConnectionAttemptTimeout();
        setGpsMessageText(error.message || "Error de red/servidor al conectar GPS.");
        setShowGpsMessage(true); setIsAttemptingConnection(false);
        setTimeout(() => setShowGpsMessage(false), 7000);
      });
  }, [gpsConnected, isAttemptingConnection, clearConnectionAttemptTimeout, disconnectGps]);


  const getGpsButtonText = () => {
    if (isAttemptingConnection) return 'Conectando GPS...';
    if (gpsConnected) return 'Desconectar GPS Externo';
    return 'Conectar GPS Externo';
  };

  const getGpsButtonIcon = () => {
    if (isAttemptingConnection) return <AiOutlineLoading3Quarters className="rotating-icon" />;
    return <MdOutlineDeveloperBoard />;
  };

  const menuItems = [
     ...(currentUser 
      ? [{
          name: 'Mi Cuenta', 
          path: '/account', 
          icon: <FaUserCircle />,
        }]
      : [{
          name: 'Cuenta', 
          icon: <FaUserCircle />,
           submenu: [{ icon: <BiLogIn />, name: 'Iniciar Sesión', path: '/login' }]
        }]
    ),
    {
      name: getGpsButtonText(),
      icon: getGpsButtonIcon(),
      action: handleExternalGpsClick,
      className: gpsConnected ? 'connected' : (isAttemptingConnection ? 'connecting' : '')
    },
    {
      name: arePredefinedRoutesVisible ? 'Ocultar Rutas del Mapa' : 'Mostrar Rutas en Mapa',
      icon: arePredefinedRoutesVisible ? <FaTrashAlt /> : <FaRoute />,
      action: onTogglePredefinedRoutes, // Esta es la nueva prop y acción
    },
  ];

  if (currentUser) {
    menuItems.push({
      name: 'Cerrar Sesión',
      icon: <FaSignOutAlt />,
      action: handleLogout,
      path: '/login' 
    });
  }

  const renderMenuItem = (item, index) => {
    const isExpanded = expandedMenuIndex === index;
    const linkClass = `link ${item.submenu && isExpanded ? 'expanded' : ''} ${item.className || ''}`;
    const isDisabled = item.name === getGpsButtonText() && isAttemptingConnection && !gpsConnected;

    if (item.action) {
      return (
        <div key={item.name + index} 
             className={`${linkClass} ${isDisabled ? 'disabled' : ''}`} 
             onClick={!isDisabled ? item.action : undefined} 
             style={{cursor: isDisabled ? 'not-allowed' : 'pointer'}}>
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </div>
      );
    } else if (item.path) { // This will handle "Mi Cuenta" and "Iniciar Sesión" (if not in submenu)
      return (
        <NavLink 
            to={item.path} 
            key={item.name + index} 
            className={({ isActive }) => isActive ? `${linkClass} active` : linkClass}
        >
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </NavLink>
      );
    }
    else if (item.submenu && item.submenu.length > 0) { // Handle "Cuenta" with "Iniciar Sesión" submenu
      const isExpanded = expandedMenuIndex === index;
      return (
        <div key={item.name + index}>
          <div className={`link ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedMenuIndex(prevIndex => (prevIndex === index ? null : index))} style={{cursor: 'pointer'}}>
            <div className="icon">{item.icon}</div>
            <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
          </div>
          <div className={`submenu_container ${isExpanded ? 'open' : ''}`}>
            {isExpanded && item.submenu.map((subitem, subindex) => (
              <NavLink 
                to={subitem.path} 
                key={subitem.name + subindex} 
                className={({ isActive }) => isActive ? "link sublink active" : "link sublink"}
              >
                <div className="icon">{subitem.icon}</div>
                <div className="submenu_text">{subitem.name}</div>
              </NavLink>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <> 
      <div className={`sidebar ${isOpen ? "open" : ""}`} style={{ width: isOpen ? "var(--sidebar-width)" : "60px" }}>
        <div className="top">
          <h1 style={{ display: isOpen ? "flex" : "none" }} className="logo">
            <img src={logoPng} alt="Logo" className="logoPng" />
          </h1>
          <div className="bars" onClick={toggle}>
            <FaBars />
          </div>
        </div>
        {menuItems.map(renderMenuItem)}
        {showGpsMessage && (
          <div className={`gps-status-message ${gpsConnected ? 'success' : (isAttemptingConnection ? 'connecting' : 'error')}`}>
            {gpsMessageText}
          </div>
        )}
      </div>
      <div className="mobile-menu-toggle" onClick={toggle}>
        <img alt="logopng" src={logoPng} className='logoPng'/>
      </div>
    </>
  );
};

export default Sidebar;