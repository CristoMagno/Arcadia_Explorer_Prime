import React from 'react';
import styles from '../Estilos/inicioSesion.module.css'; // Asegúrate de que la ruta sea correcta

const ConfirmationDialog = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles['dialog-overlay']}>
      <div className={styles['dialog-content']}>
        <p>{message}</p>
        <div className={styles['dialog-buttons']}>
          <button onClick={onConfirm} className={styles['confirm-button']}>Sí, continuar</button>
          <button onClick={onCancel} className={styles['cancel-button']}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;