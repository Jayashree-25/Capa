import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

export const Modal = ({ 
  isOpen, 
  onClose, 
  children,
  disableClose = false,
  closeValidation = () => true,
  ariaLabel = "Modal dialog"
}) => {
  const handleClose = useCallback(() => {
    if (disableClose) {
      console.log('Modal close blocked by disableClose');
      return;
    }

    if (!closeValidation()) {
      console.log('Modal close blocked by validation');
      return;
    }

    onClose();
  }, [disableClose, closeValidation, onClose]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // Focus the modal when opened
  useEffect(() => {
    if (isOpen) {
      const modalElement = document.querySelector('.modal-container');
      modalElement?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="modal-container relative bg-white p-6 rounded-xl border border-gray-200 shadow-xl w-full max-w-md outline-none"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {!disableClose && (
          <button
            onClick={handleClose}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none text-lg leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  disableClose: PropTypes.bool,
  closeValidation: PropTypes.func,
  ariaLabel: PropTypes.string
};
