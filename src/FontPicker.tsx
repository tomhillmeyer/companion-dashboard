import { useState, useEffect } from 'react';
import './FontPicker.css';

interface FontPickerProps {
    value: string;
    onChange: (fontFamily: string) => void;
    className?: string;
}

// Font info from font-list library
interface FontInfo {
    name: string;
    familyName: string;
    postScriptName: string;
    weight: string;
    style: string;
    width: string;
    monospace: boolean;
}

// Helper function to categorize system fonts
// Uses actual monospace property from font-list, and smart heuristics for serif/sans-serif/cursive/display
const categorizeSystemFont = (font: FontInfo): 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'display' => {
    const name = font.familyName.toLowerCase();

    // Use actual monospace property from font-list
    if (font.monospace) {
        return 'monospace';
    }

    // Serif patterns
    if ((name.includes('serif') && !name.includes('sans')) ||
        name.includes('times') || name.includes('georgia') || name.includes('palatino') ||
        name.includes('baskerville') || name.includes('garamond') || name.includes('cambria') ||
        name.includes('bodoni') || name.includes('caslon') || name.includes('didot')) {
        return 'serif';
    }

    // Cursive/Script patterns
    if (name.includes('script') || name.includes('cursive') || name.includes('handwriting') ||
        name.includes('brush') || name.includes('calligraphy') || name.includes('chancery') ||
        name.includes('zapfino') || name.includes('comic') || name.includes('marker')) {
        return 'cursive';
    }

    // Display patterns
    if (name.includes('display') || name.includes('decorative') || name.includes('ornament') ||
        name.includes('fantasy') || name.includes('impact') || name.includes('stencil') ||
        name.includes('poster')) {
        return 'display';
    }

    // Default to sans-serif
    return 'sans-serif';
};

// Get system fonts using font-list via Electron IPC
const getSystemFonts = async (): Promise<FontInfo[]> => {
    try {
        // Check if running in Electron
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        if (isElectron) {
            // Call Electron to get system fonts with detailed info
            const fonts = await (window as any).electronAPI.getSystemFonts();
            return fonts || [];
        } else {
            // Fallback to empty array for web environments
            return [];
        }
    } catch (error) {
        console.error('Error loading system fonts:', error);
        return [];
    }
};

const FontPicker: React.FC<FontPickerProps> = ({ value, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [detectedSystemFonts, setDetectedSystemFonts] = useState<FontInfo[]>([]);
    const [systemFontsLoaded, setSystemFontsLoaded] = useState(false);

    const handleFontSelect = (fontFamily: string, event: React.MouseEvent) => {
        event.stopPropagation();
        onChange(fontFamily);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Get categorized font lists from detected system fonts
    const getCombinedFonts = () => {
        // Categorize detected system fonts
        const categories = {
            serif: [] as string[],
            sansSerif: [] as string[],
            monospace: [] as string[],
            cursive: [] as string[],
            display: [] as string[]
        };

        detectedSystemFonts.forEach(font => {
            const category = categorizeSystemFont(font);
            const fontName = font.familyName;
            switch (category) {
                case 'serif':
                    categories.serif.push(fontName);
                    break;
                case 'sans-serif':
                    categories.sansSerif.push(fontName);
                    break;
                case 'monospace':
                    categories.monospace.push(fontName);
                    break;
                case 'cursive':
                    categories.cursive.push(fontName);
                    break;
                case 'display':
                    categories.display.push(fontName);
                    break;
            }
        });

        // Sort fonts alphabetically within each category
        return {
            serif: categories.serif.sort((a, b) => a.localeCompare(b)),
            sansSerif: categories.sansSerif.sort((a, b) => a.localeCompare(b)),
            monospace: categories.monospace.sort((a, b) => a.localeCompare(b)),
            cursive: categories.cursive.sort((a, b) => a.localeCompare(b)),
            display: categories.display.sort((a, b) => a.localeCompare(b))
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

    // Detect system fonts on component mount
    useEffect(() => {
        if (!systemFontsLoaded) {
            getSystemFonts().then(fonts => {
                setDetectedSystemFonts(fonts);
                setSystemFontsLoaded(true);
            });
        }
    }, [systemFontsLoaded]);

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
                        {/* Use Global Font option */}
                        <div
                            className={`font-picker-item ${value === 'Use Global Font' ? 'selected' : ''}`}
                            onClick={(e) => handleFontSelect('Use Global Font', e)}
                            style={{ fontWeight: 600, borderBottom: '2px solid #444' }}
                        >
                            Use Global Font
                        </div>

                        {filteredSerif.length > 0 && (
                            <>
                                <div className="font-category-header">Serif</div>
                                {filteredSerif.map((font) => (
                                    <div
                                        key={font}
                                        className={`font-picker-item ${value === font ? 'selected' : ''}`}
                                        onClick={(e) => handleFontSelect(font, e)}
                                        style={{ fontFamily: `"${font}", serif` }}
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
                                        style={{ fontFamily: `"${font}", sans-serif` }}
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
                                        style={{ fontFamily: `"${font}", monospace` }}
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
                                        style={{ fontFamily: `"${font}", cursive` }}
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
                                        style={{ fontFamily: `"${font}", sans-serif` }}
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