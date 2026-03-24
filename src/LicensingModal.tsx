import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './LicensingModal.css';
import thSignature from './assets/th_signature_blue.png';
import dashboardWordmark from './assets/dashboard-wordmark.png';
import { validateLicense, storeLicense } from './utils/licenseManager';

interface LicensingModalProps {
    onClose: () => void;
    skipCountdown?: boolean; // If true, "Personal Use" button is immediately available
}

export default function LicensingModal({ onClose, skipCountdown = false }: LicensingModalProps) {
    const [countdown, setCountdown] = useState(skipCountdown ? 0 : 5);
    const [canClose, setCanClose] = useState(skipCountdown);
    const [licenseKey, setLicenseKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        // Skip countdown entirely if skipCountdown is true
        if (skipCountdown) {
            setCanClose(true);
            return;
        }

        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setCanClose(true);
        }
    }, [countdown, skipCountdown]);

    const handlePersonalUse = () => {
        if (canClose) {
            onClose();
        }
    };

    const handleActivateKey = async () => {
        if (isValidating) return;

        setErrorMessage('');
        setIsValidating(true);

        try {
            const result = await validateLicense(licenseKey);

            if (result.success) {
                // Store the validated license key
                storeLicense(licenseKey);
                // Dispatch event to notify other components
                window.dispatchEvent(new CustomEvent('licenseUpdated'));
                // Close the modal
                onClose();
            } else {
                // Show error message
                setErrorMessage(result.error || 'License validation failed. Please try again.');
            }
        } catch (error) {
            console.error('Unexpected error during license validation:', error);
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setIsValidating(false);
        }
    };

    const handlePurchaseLicense = (e: React.MouseEvent) => {
        e.preventDefault();
        const purchaseUrl = 'https://creativelandapps.gumroad.com/l/dashboard-v1-pro';
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        if (isElectron && (window as any).electronAPI?.openExternal) {
            // Open in default browser, not Electron window
            (window as any).electronAPI.openExternal(purchaseUrl);
        } else {
            // Fallback for web mode
            window.open(purchaseUrl, '_blank');
        }
    };

    return createPortal(
        <div className="licensing-modal-overlay">
            <div className="licensing-modal-content">
                <div className="licensing-header">
                    <img src={dashboardWordmark} alt="Companion Dashboard" className="licensing-wordmark" />
                </div>
                <p className="licensing-message">
                    This app is free for personal use. If you're using this for commercial purposes, please{' '}
                    <a href="#" onClick={handlePurchaseLicense} className="licensing-purchase-link">
                        purchase a pro license
                    </a>{' '}
                    and enter the key below.
                </p>

                <input
                    type="text"
                    className="licensing-key-input"
                    placeholder="Enter license key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    disabled={isValidating}
                />

                {errorMessage && (
                    <p className="licensing-error">{errorMessage}</p>
                )}

                <div className="licensing-buttons">
                    <button
                        className="licensing-button activate-button"
                        onClick={handleActivateKey}
                        disabled={isValidating || !licenseKey.trim()}
                    >
                        {isValidating ? 'VALIDATING...' : 'ACTIVATE KEY'}
                    </button>
                    <button
                        className={`licensing-button personal-button ${canClose ? 'ready' : 'waiting'}`}
                        onClick={handlePersonalUse}
                        disabled={!canClose}
                    >
                        {canClose ? 'PERSONAL USE' : countdown}
                    </button>
                </div>

                <div className="licensing-footer">
                    <p className="licensing-thanks">
                        Thank you for supporting Companion Dashboard!
                    </p>
                    <div className="licensing-signature">
                        <img src={thSignature} alt="TH Signature" />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
