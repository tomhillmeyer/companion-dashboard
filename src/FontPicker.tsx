import { useState, useEffect } from 'react';
import './FontPicker.css';
// @ts-ignore
import 'font-detective';

interface FontPickerProps {
    value: string;
    onChange: (fontFamily: string) => void;
    className?: string;
}

// Google Fonts API interface
interface GoogleFontItem {
    family: string;
    category: string;
}

// System fonts by category
const SYSTEM_SERIF_FONTS = [
    'Times New Roman',
    'Georgia',
    'Times',
    'Palatino',
    'Baskerville',
    'Hoefler Text',
    'Palatino Linotype',
    'serif'
];

const SYSTEM_SANS_SERIF_FONTS = [
    'Arial',
    'Helvetica',
    'Helvetica Neue',
    'Verdana',
    'Tahoma',
    'Segoe UI',
    'Calibri',
    'Trebuchet MS',
    'Lucida Sans Unicode',
    'Liberation Sans',
    'DejaVu Sans',
    'Ubuntu',
    'Cantarell',
    'Noto Sans',
    'system-ui',
    'ui-sans-serif',
    'sans-serif'
];

const SYSTEM_MONOSPACE_FONTS = [
    'Courier New',
    'Monaco',
    'Menlo',
    'Consolas',
    'Lucida Console',
    'SF Mono',
    'Courier',
    'Liberation Mono',
    'DejaVu Sans Mono',
    'Ubuntu Mono',
    'Noto Mono',
    'ui-monospace',
    'monospace'
];

const SYSTEM_CURSIVE_FONTS = [
    'Apple Chancery',
    'Zapfino',
    'Comic Sans MS',
    'cursive'
];

// Helper function to categorize system fonts
const categorizeSystemFont = (fontName: string): 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'display' => {
    const name = fontName.toLowerCase();
    
    // Monospace patterns
    if (name.includes('mono') || name.includes('courier') || name.includes('consolas') || 
        name.includes('menlo') || name.includes('monaco') || name.includes('inconsolata') ||
        name.includes('code') || name.includes('terminal') || name.includes('fixed')) {
        return 'monospace';
    }
    
    // Serif patterns
    if (name.includes('serif') && !name.includes('sans') || 
        name.includes('times') || name.includes('georgia') || name.includes('palatino') ||
        name.includes('baskerville') || name.includes('garamond') || name.includes('cambria')) {
        return 'serif';
    }
    
    // Cursive patterns
    if (name.includes('script') || name.includes('cursive') || name.includes('handwriting') ||
        name.includes('brush') || name.includes('calligraphy') || name.includes('chancery') ||
        name.includes('zapfino') || name.includes('comic')) {
        return 'cursive';
    }
    
    // Display patterns
    if (name.includes('display') || name.includes('decorative') || name.includes('ornament') ||
        name.includes('fantasy') || name.includes('impact') || name.includes('black') ||
        name.includes('ultra') || name.includes('heavy')) {
        return 'display';
    }
    
    // Default to sans-serif
    return 'sans-serif';
};

// Fetch Google Fonts from API
const fetchGoogleFonts = async (): Promise<GoogleFontItem[]> => {
    try {
        const response = await fetch('https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=AIzaSyCaayBwQM10HMcVHs5KWhc97CvsWeD-Yt4', {
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (!response.ok) {
            return []; // Silently fail, no Google Fonts available
        }
        const data = await response.json();
        return data.items || [];
    } catch (error) {
        // Silently handle network errors, offline scenarios, or timeouts
        // Google Fonts just won't be available
        return [];
    }
};

const FontPicker: React.FC<FontPickerProps> = ({ value, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [detectedSystemFonts, setDetectedSystemFonts] = useState<string[]>([]);
    const [systemFontsLoaded, setSystemFontsLoaded] = useState(false);
    const [googleFonts, setGoogleFonts] = useState<GoogleFontItem[]>([]);
    const [googleFontsLoaded, setGoogleFontsLoaded] = useState(false);

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
        // Check if it's a Google Font
        const isGoogleFont = googleFonts.some(font => font.family === fontFamily);
        if (isGoogleFont) {
            loadGoogleFont(fontFamily);
        }
        onChange(fontFamily);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Get combined font lists including detected system fonts and Google Fonts
    const getCombinedFonts = () => {
        // Categorize Google Fonts
        const googleFontCategories = {
            serif: [] as string[],
            sansSerif: [] as string[],
            monospace: [] as string[],
            cursive: [] as string[],
            display: [] as string[]
        };
        
        googleFonts.forEach(font => {
            switch (font.category) {
                case 'serif':
                    googleFontCategories.serif.push(font.family);
                    break;
                case 'sans-serif':
                    googleFontCategories.sansSerif.push(font.family);
                    break;
                case 'monospace':
                    googleFontCategories.monospace.push(font.family);
                    break;
                case 'handwriting':
                    googleFontCategories.cursive.push(font.family);
                    break;
                case 'display':
                    googleFontCategories.display.push(font.family);
                    break;
                default:
                    googleFontCategories.sansSerif.push(font.family);
            }
        });
        
        // Categorize detected system fonts
        const detectedCategories = {
            serif: [] as string[],
            sansSerif: [] as string[],
            monospace: [] as string[],
            cursive: [] as string[],
            display: [] as string[]
        };
        
        detectedSystemFonts.forEach(font => {
            const category = categorizeSystemFont(font);
            switch (category) {
                case 'serif':
                    detectedCategories.serif.push(font);
                    break;
                case 'sans-serif':
                    detectedCategories.sansSerif.push(font);
                    break;
                case 'monospace':
                    detectedCategories.monospace.push(font);
                    break;
                case 'cursive':
                    detectedCategories.cursive.push(font);
                    break;
                case 'display':
                    detectedCategories.display.push(font);
                    break;
            }
        });
        
        return {
            serif: [...new Set([...googleFontCategories.serif, ...SYSTEM_SERIF_FONTS, ...detectedCategories.serif])],
            sansSerif: [...new Set([...googleFontCategories.sansSerif, ...SYSTEM_SANS_SERIF_FONTS, ...detectedCategories.sansSerif])],
            monospace: [...new Set([...googleFontCategories.monospace, ...SYSTEM_MONOSPACE_FONTS, ...detectedCategories.monospace])],
            cursive: [...new Set([...googleFontCategories.cursive, ...SYSTEM_CURSIVE_FONTS, ...detectedCategories.cursive])],
            display: [...new Set([...googleFontCategories.display, ...detectedCategories.display])]
        };
    };

    const combinedFonts = getCombinedFonts();

    // Filter fonts by category based on search term
    const searchLower = searchTerm.toLowerCase();
    const filterFonts = (fonts: string[]) => 
        fonts.filter(font => font.toLowerCase().includes(searchLower));
    
    // Check if search term matches category names
    const showAllSerif = searchLower.includes('serif') && !searchLower.includes('sans');
    const showAllSansSerif = searchLower.includes('sans') || (searchLower.includes('serif') && searchLower.includes('sans'));
    const showAllMonospace = searchLower.includes('mono') || searchLower.includes('code') || searchLower.includes('fixed');
    const showAllCursive = searchLower.includes('cursive') || searchLower.includes('script') || searchLower.includes('handwriting');
    const showAllDisplay = searchLower.includes('display') || searchLower.includes('decorative');
    
    // Filter fonts - show all in category if category name matches, otherwise filter by font name
    const filteredSerif = showAllSerif ? combinedFonts.serif : filterFonts(combinedFonts.serif);
    const filteredSansSerif = showAllSansSerif ? combinedFonts.sansSerif : filterFonts(combinedFonts.sansSerif);
    const filteredMonospace = showAllMonospace ? combinedFonts.monospace : filterFonts(combinedFonts.monospace);
    const filteredCursive = showAllCursive ? combinedFonts.cursive : filterFonts(combinedFonts.cursive);
    const filteredDisplay = showAllDisplay ? combinedFonts.display : filterFonts(combinedFonts.display);

    // Fetch Google Fonts on component mount
    useEffect(() => {
        if (!googleFontsLoaded) {
            fetchGoogleFonts().then(fonts => {
                setGoogleFonts(fonts);
                setGoogleFontsLoaded(true);
            });
        }
    }, [googleFontsLoaded]);

    // Detect system fonts on component mount
    useEffect(() => {
        if (!systemFontsLoaded) {
            // @ts-ignore
            window.FontDetective.all((fonts: any[]) => {
                const fontNames = fonts.map((font: any) => font.name);
                setDetectedSystemFonts(fontNames);
                setSystemFontsLoaded(true);
            });
        }
    }, [systemFontsLoaded]);

    // Load current font on component mount
    useEffect(() => {
        if (value && googleFonts.some(font => font.family === value)) {
            loadGoogleFont(value);
        }
    }, [value, googleFonts]);

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
                        {filteredSerif.length > 0 && (
                            <>
                                <div className="font-category-header">Serif</div>
                                {filteredSerif.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredSansSerif.length > 0 && (
                            <>
                                <div className="font-category-header">Sans Serif</div>
                                {filteredSansSerif.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredMonospace.length > 0 && (
                            <>
                                <div className="font-category-header">Monospace</div>
                                {filteredMonospace.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredCursive.length > 0 && (
                            <>
                                <div className="font-category-header">Cursive</div>
                                {filteredCursive.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredDisplay.length > 0 && (
                            <>
                                <div className="font-category-header">Display</div>
                                {filteredDisplay.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </>
                        )}
                        
                        {filteredSerif.length === 0 && filteredSansSerif.length === 0 && 
                         filteredMonospace.length === 0 && filteredCursive.length === 0 && 
                         filteredDisplay.length === 0 && (
                            <div className="font-picker-no-results">No fonts found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FontPicker;