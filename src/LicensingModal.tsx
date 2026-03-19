import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './LicensingModal.css';
import thSignature from './assets/th_signature_blue.png';
import dashboardWordmark from './assets/dashboard-wordmark.png';

interface LicensingModalProps {
    onClose: () => void;
}

export default function LicensingModal({ onClose }: LicensingModalProps) {
    const [countdown, setCountdown] = useState(5);
    const [canClose, setCanClose] = useState(false);
    const [licenseKey, setLicenseKey] = useState('');

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setCanClose(true);
        }
    }, [countdown]);

    const handlePersonalUse = () => {
        if (canClose) {
            onClose();
        }
    };

    const handleActivateKey = () => {
        // TODO: Implement license key activation
        console.log('Activating license key:', licenseKey);
    };

    return createPortal(
        <div className="licensing-modal-overlay">
            <div className="licensing-modal-content">
                <div className="licensing-header">
                    <img src={dashboardWordmark} alt="Companion Dashboard" className="licensing-wordmark" />
                </div>
                <p className="licensing-message">
                    This app is free for personal use. If you're using this for commercial purposes, please purchase a license and enter the key below.
                </p>

                <input
                    type="text"
                    className="licensing-key-input"
                    placeholder="Enter license key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                />

                <div className="licensing-buttons">
                    <button
                        className="licensing-button activate-button"
                        onClick={handleActivateKey}
                    >
                        ACTIVATE KEY
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
