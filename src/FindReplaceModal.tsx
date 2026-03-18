import { useState, useEffect, useRef } from 'react';
import type { BoxData } from './types';

interface FindReplaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    boxes: BoxData[];
    selectedBoxIds: string[];
    onReplace: (findText: string, replaceText: string, targetBoxIds: string[]) => void;
}

export default function FindReplaceModal({
    isOpen,
    onClose,
    boxes,
    selectedBoxIds,
    onReplace
}: FindReplaceModalProps) {
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const findInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && findInputRef.current) {
            findInputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
            if (isOpen && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleReplaceAll();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, findText, replaceText, selectedBoxIds]);

    const handleReplaceAll = () => {
        if (!findText) return;

        // If boxes are selected, use those; otherwise use all boxes
        const targetBoxIds = selectedBoxIds.length > 0
            ? selectedBoxIds
            : boxes.map(box => box.id);

        onReplace(findText, replaceText, targetBoxIds);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10001,
                pointerEvents: isOpen ? 'all' : 'none'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#262626',
                    padding: '16px',
                    width: '280px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    fontFamily: '"Work Sans", system-ui, sans-serif'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ marginBottom: '10px' }}>
                    <label style={{
                        display: 'block',
                        color: '#888',
                        fontSize: '10px',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Find
                    </label>
                    <input
                        ref={findInputRef}
                        type="text"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{
                        display: 'block',
                        color: '#888',
                        fontSize: '10px',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Replace
                    </label>
                    <input
                        type="text"
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                <div style={{
                    fontSize: '10px',
                    color: '#888',
                    marginBottom: '6px',
                    textTransform: 'uppercase'
                }}>
                    {selectedBoxIds.length > 0
                        ? `${selectedBoxIds.length} box${selectedBoxIds.length > 1 ? 'es' : ''}`
                        : 'All Boxes'
                    }
                </div>

                <button
                    onClick={handleReplaceAll}
                    disabled={!findText}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: findText ? '#61BAFA' : '#3a3a3a',
                        border: 'none',
                        borderRadius: '4px',
                        color: findText ? '#1a1a1a' : '#666',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: findText ? 'pointer' : 'not-allowed',
                        transition: 'background-color 0.2s',
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                    }}
                >
                    Find and Replace
                </button>
            </div>
        </div>
    );
}
