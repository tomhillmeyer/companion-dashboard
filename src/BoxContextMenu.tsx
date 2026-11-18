import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './BoxContextMenu.css';

interface BoxContextMenuProps {
    x: number;
    y: number;
    variant: 'box' | 'canvas';
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    onNewBox: () => void;
    onCut: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const shortcut = (key: string) => `${isMac ? '⌘' : 'Ctrl+'}${key}`;

const MenuItem = ({
    label,
    hint,
    onClick,
    disabled = false,
}: {
    label: string;
    hint?: string;
    onClick: () => void;
    disabled?: boolean;
}) => (
    <button
        type="button"
        className="box-context-menu-item"
        onClick={onClick}
        disabled={disabled}
    >
        <span>{label}</span>
        {hint && <span className="box-context-menu-shortcut">{hint}</span>}
    </button>
);

export default function BoxContextMenu({
    x,
    y,
    variant,
    canCut,
    canCopy,
    canPaste,
    onNewBox,
    onCut,
    onCopy,
    onPaste,
    onClose,
}: BoxContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: x, top: y });

    // Keep the menu inside the viewport.
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const rect = menu.getBoundingClientRect();
        const margin = 8;
        setPosition({
            left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
            top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
        });
    }, [x, y]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('resize', onClose);
        window.addEventListener('blur', onClose);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('scroll', onClose, true);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('blur', onClose);
        };
    }, [onClose]);

    const runAndClose = (action: () => void) => () => {
        action();
        onClose();
    };

    return createPortal(
        <div
            ref={menuRef}
            className="box-context-menu"
            style={{ left: position.left, top: position.top }}
            onContextMenu={(event) => event.preventDefault()}
        >
            <MenuItem label="New Box" onClick={runAndClose(onNewBox)} />

            {variant === 'box' && (
                <>
                    <div className="box-context-menu-separator" />
                    <MenuItem label="Cut" hint={shortcut('X')} onClick={runAndClose(onCut)} disabled={!canCut} />
                    <MenuItem label="Copy" hint={shortcut('C')} onClick={runAndClose(onCopy)} disabled={!canCopy} />
                </>
            )}

            {canPaste && (
                <>
                    <div className="box-context-menu-separator" />
                    <MenuItem label="Paste" hint={shortcut('V')} onClick={runAndClose(onPaste)} />
                </>
            )}
        </div>,
        document.body
    );
}
