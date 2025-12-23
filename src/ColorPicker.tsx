import { useState, useRef, useEffect } from 'react';
import { RgbaColorPicker } from 'react-colorful';
import './ColorPicker.css';

interface ColorPickerProps {
    value: string; // Can be hex (#ffffff) or rgba(255,255,255,1)
    onChange: (color: string) => void;
    className?: string;
}

// Convert hex to rgba object
const hexToRgba = (hex: string, alpha: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: alpha
    } : { r: 0, g: 0, b: 0, a: 1 };
};

// Convert rgba string to rgba object
const rgbaStringToRgba = (rgbaString: string) => {
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
            a: match[4] ? parseFloat(match[4]) : 1
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
};

// Convert rgba object to rgba string
const rgbaToString = (rgba: { r: number; g: number; b: number; a: number }) => {
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
};

// Convert rgba object to hex (ignoring alpha)
const rgbaToHex = (rgba: { r: number; g: number; b: number; a: number }) => {
    return `#${[rgba.r, rgba.g, rgba.b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
};

export default function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [color, setColor] = useState(() => {
        if (!value || typeof value !== 'string') {
            return { r: 0, g: 0, b: 0, a: 1 };
        }
        if (value.startsWith('#')) {
            return hexToRgba(value, 1);
        } else if (value.startsWith('rgba') || value.startsWith('rgb')) {
            return rgbaStringToRgba(value);
        } else {
            return { r: 0, g: 0, b: 0, a: 1 };
        }
    });
    const [hexInputValue, setHexInputValue] = useState(() => rgbaToHex(color));

    const pickerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [pickerPosition, setPickerPosition] = useState<{top: number, left: number, placement: 'bottom' | 'top'}>({
        top: 0,
        left: 0,
        placement: 'bottom'
    });

    // Update color when value prop changes
    useEffect(() => {
        if (!value || typeof value !== 'string') {
            return;
        }
        let newColor;
        if (value.startsWith('#')) {
            newColor = hexToRgba(value, color.a); // Keep existing alpha
        } else if (value.startsWith('rgba') || value.startsWith('rgb')) {
            newColor = rgbaStringToRgba(value);
        }

        if (newColor) {
            setColor(newColor);
            setHexInputValue(rgbaToHex(newColor));
        }
    }, [value, color.a]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current &&
                !pickerRef.current.contains(event.target as Node) &&
                !buttonRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleColorChange = (newColor: { r: number; g: number; b: number; a: number }) => {
        setColor(newColor);
        setHexInputValue(rgbaToHex(newColor));
        onChange(rgbaToString(newColor));
    };

    const calculatePickerPosition = () => {
        if (!buttonRef.current) return;

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const pickerHeight = 300; // Approximate height of the color picker popover
        const pickerWidth = 250; // Approximate width of the color picker popover

        // Find the modal container
        const modal = buttonRef.current.closest('.modal-content');
        const modalRect = modal?.getBoundingClientRect();
        
        let top = buttonRect.bottom + 4;
        let left = buttonRect.left;
        let placement: 'bottom' | 'top' = 'bottom';

        // If there's a modal, constrain positioning within it
        if (modalRect) {
            const modalBottom = modalRect.bottom;
            const modalRight = modalRect.right;
            const modalTop = modalRect.top;
            const modalLeft = modalRect.left;

            // Check if picker would go outside modal bounds
            if (top + pickerHeight > modalBottom) {
                // Try positioning above the button
                const topPosition = buttonRect.top - pickerHeight - 4;
                if (topPosition >= modalTop) {
                    top = topPosition;
                    placement = 'top';
                } else {
                    // If it doesn't fit above either, position at the bottom of the modal with scroll
                    top = modalBottom - pickerHeight - 10;
                }
            }

            // Adjust horizontal position to stay within modal
            if (left + pickerWidth > modalRight) {
                left = modalRight - pickerWidth - 10;
            }
            if (left < modalLeft) {
                left = modalLeft + 10;
            }
        } else {
            // Fallback for viewport positioning
            if (top + pickerHeight > viewportHeight) {
                top = buttonRect.top - pickerHeight - 4;
                placement = 'top';
            }
            if (left + pickerWidth > viewportWidth) {
                left = viewportWidth - pickerWidth - 10;
            }
            if (left < 10) {
                left = 10;
            }
        }

        setPickerPosition({ top, left, placement });
    };

    const handleTogglePicker = () => {
        if (!isOpen) {
            calculatePickerPosition();
        }
        setIsOpen(!isOpen);
    };

    const currentColorStyle = {
        backgroundColor: rgbaToString(color)
    };

    return (
        <div className={`color-picker-wrapper ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                className="color-picker-button"
                onClick={handleTogglePicker}
                style={currentColorStyle}
                title={`Color: ${rgbaToString(color)}`}
            >
                <span className="color-picker-preview" style={currentColorStyle}></span>
            </button>

            {isOpen && (
                <div 
                    ref={pickerRef} 
                    className="color-picker-popover"
                    style={{
                        position: 'fixed',
                        top: `${pickerPosition.top}px`,
                        left: `${pickerPosition.left}px`,
                        zIndex: 10001
                    }}
                >
                    <RgbaColorPicker
                        color={color}
                        onChange={handleColorChange}
                    />
                    <div className="color-picker-info">
                        <div className="color-input-row">
                            <label>Hex:</label>
                            <input
                                type="text"
                                value={hexInputValue}
                                onChange={(e) => {
                                    // Allow free typing - just update the input value
                                    setHexInputValue(e.target.value);
                                }}
                                onBlur={(e) => {
                                    // Validate and apply on blur
                                    let hexValue = e.target.value.trim();

                                    // Remove # if present
                                    hexValue = hexValue.replace(/^#/, '');

                                    // Check if it's a valid hex
                                    if (/^[0-9A-Fa-f]{6}$/.test(hexValue)) {
                                        const newColor = hexToRgba('#' + hexValue, color.a);
                                        handleColorChange(newColor);
                                    } else if (/^[0-9A-Fa-f]{3}$/.test(hexValue)) {
                                        // Convert 3-char hex to 6-char hex
                                        hexValue = hexValue.split('').map(c => c + c).join('');
                                        const newColor = hexToRgba('#' + hexValue, color.a);
                                        handleColorChange(newColor);
                                    } else {
                                        // Invalid - revert to current color
                                        setHexInputValue(rgbaToHex(color));
                                    }
                                }}
                                onKeyDown={(e) => {
                                    // Apply on Enter key
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="hex-input"
                                placeholder="#ffffff"
                            />
                        </div>
                        <div className="color-input-row">
                            <label>Alpha:</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={Math.round(color.a * 100)}
                                onChange={(e) => {
                                    const alpha = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                                    handleColorChange({ ...color, a: alpha });
                                }}
                                className="alpha-input"
                            />
                            <span>%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}