// src/Components/ErrorBanner.js
import React from 'react';
import styles from '../Estilos/errorBanner.module.css'; 
const WarningIcon = () => (
   <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
     
    >
      <path
        fill="currentColor"
        d="M4 20v-6a8 8 0 1 1 16 0v6h1v2H3v-2zm2-6h2a4 4 0 0 1 4-4V8a6 6 0 0 0-6 6m5-12h2v3h-2zm8.778 2.808l1.414 1.414l-2.12 2.121l-1.415-1.414zM2.808 6.222l1.414-1.414l2.121 2.12L4.93 8.344z"
      ></path>
    </svg>
);

const ErrorBanner = ({ message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className={styles.errorBanner}>
      <WarningIcon className={styles.WarningIcon}/>
      <span className={styles.errorMessage}>{message}</span>
    </div>
  );
};

export default ErrorBanner;