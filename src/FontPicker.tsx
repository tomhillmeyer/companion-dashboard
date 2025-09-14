import { useState, useEffect } from 'react';
import './FontPicker.css';

interface FontPickerProps {
    value: string;
    onChange: (fontFamily: string) => void;
    className?: string;
}

// Extended Google Fonts list (popular and commonly used)
const GOOGLE_FONTS = [
    'Work Sans',
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Source Sans Pro',
    'Oswald',
    'Raleway',
    'PT Sans',
    'Lora',
    'Nunito',
    'Noto Sans',
    'Playfair Display',
    'Merriweather',
    'Montserrat',
    'Ubuntu',
    'Poppins',
    'Crimson Text',
    'Libre Baskerville',
    'Roboto Condensed',
    'Roboto Slab',
    'Fira Sans',
    'IBM Plex Sans',
    'IBM Plex Serif',
    'IBM Plex Mono',
    'Source Code Pro',
    'JetBrains Mono',
    'Inconsolata',
    'Space Mono',
    'DM Sans',
    'DM Serif Display',
    'Barlow',
    'Karla',
    'Rubik',
    'Oxygen',
    'Quicksand',
    'Fjalla One',
    'Anton',
    'Bebas Neue',
    'Lobster',
    'Dancing Script',
    'Pacifico',
    'Righteous',
    'Comfortaa',
    'Cabin',
    'Bitter',
    'Arvo',
    'Vollkorn',
    'EB Garamond',
    'Libre Franklin',
    'Libre Caslon Text',
    'Crimson Pro',
    'Cormorant Garamond',
    'Spectral',
    'Alegreya',
    'PT Serif',
    'Slabo 27px',
    'Slabo 13px',
    'Zilla Slab',
    'Space Grotesk',
    'Manrope',
    'Plus Jakarta Sans',
    'Outfit',
    'League Spartan',
    'Epilogue',
    'Commissioner',
    'Public Sans',
    'Red Hat Display',
    'Red Hat Text',
    'Sora',
    'Lexend',
    'Be Vietnam Pro',
    'Chivo',
    'Overpass',
    'Source Serif Pro',
    'Literata',
    'Newsreader',
    'Fraunces',
    'JetBrains Mono',
    'Fira Code',
    'Roboto Mono',
    'Courier Prime'
];

// Comprehensive system fonts list
const getSystemFonts = (): string[] => {
    const commonSystemFonts = [
        // Generic families
        'system-ui',
        'ui-sans-serif',
        'ui-serif',
        'ui-monospace',
        'ui-rounded',
        
        // Windows fonts
        'Arial',
        'Arial Black',
        'Calibri',
        'Cambria',
        'Candara',
        'Comic Sans MS',
        'Consolas',
        'Constantia',
        'Corbel',
        'Courier New',
        'Franklin Gothic Medium',
        'Georgia',
        'Impact',
        'Lucida Console',
        'Lucida Sans Unicode',
        'Microsoft Sans Serif',
        'Palatino Linotype',
        'Segoe UI',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',
        
        // macOS fonts
        'Helvetica',
        'Helvetica Neue',
        'Times',
        'Courier',
        'Monaco',
        'Menlo',
        'SF Pro Display',
        'SF Pro Text',
        'SF Compact Display',
        'SF Compact Text',
        'SF Mono',
        'New York',
        'Avenir',
        'Avenir Next',
        'Palatino',
        'Optima',
        'Gill Sans',
        'Futura',
        'Baskerville',
        'Hoefler Text',
        'Apple Chancery',
        'Zapfino',
        
        // Linux fonts
        'Liberation Sans',
        'Liberation Serif',
        'Liberation Mono',
        'DejaVu Sans',
        'DejaVu Serif',
        'DejaVu Sans Mono',
        'Ubuntu',
        'Ubuntu Condensed',
        'Ubuntu Mono',
        'Cantarell',
        'Noto Sans',
        'Noto Serif',
        'Noto Mono',
        
        // Cross-platform
        'serif',
        'sans-serif',
        'monospace',
        'cursive',
        'fantasy'
    ];

    // Try to detect available fonts using CSS font detection
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return commonSystemFonts;

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    // Baseline font (known to exist)
    context.font = testSize + ' monospace';
    const baselineWidth = context.measureText(testString).width;

    return commonSystemFonts.filter(font => {
        context.font = testSize + ' ' + font + ', monospace';
        return context.measureText(testString).width !== baselineWidth;
    });
};

const SYSTEM_FONTS = getSystemFonts();

const FontPicker: React.FC<FontPickerProps> = ({ value, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Load Google Font when selected
    const loadGoogleFont = (fontFamily: string) => {
        // Convert font name to URL-friendly format
        const fontUrl = fontFamily.replace(/ /g, '+');
        
        // Check if link already exists
        const existingLink = document.querySelector(`link[href*="${fontUrl}"]`);
        if (existingLink) return;

        // Create new link element for Google Fonts
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontUrl}:wght@300;400;500;600;700&display=swap`;
        link.rel = 'stylesheet';
        
        // Add to document head
        document.head.appendChild(link);
    };

    const handleFontSelect = (fontFamily: string, event: React.MouseEvent) => {
        event.stopPropagation();
        if (GOOGLE_FONTS.includes(fontFamily)) {
            loadGoogleFont(fontFamily);
        }
        onChange(fontFamily);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Filter fonts based on search term and remove duplicates
    const allFonts = [...new Set([...GOOGLE_FONTS, ...SYSTEM_FONTS])]; // Remove duplicates
    const filteredFonts = allFonts.filter(font =>
        font.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Load current font on component mount
    useEffect(() => {
        if (value && GOOGLE_FONTS.includes(value)) {
            loadGoogleFont(value);
        }
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.font-picker')) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`font-picker ${className}`}>
            <button
                type="button"
                className="font-picker-button"
                onClick={() => setIsOpen(!isOpen)}
            >
                {value || 'Select Font'}
                <span className="font-picker-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>
            
            {isOpen && (
                <div className="font-picker-dropdown">
                    <input
                        type="text"
                        placeholder="Search fonts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="font-picker-search"
                    />
                    
                    <div className="font-picker-list">
                        {filteredFonts.map((font) => (
                            <div
                                key={font}
                                className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                onClick={(e) => handleFontSelect(font, e)}
                            >
                                {font}
                            </div>
                        ))}
                        
                        {filteredFonts.length === 0 && (
                            <div className="font-picker-no-results">No fonts found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FontPicker;