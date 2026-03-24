/**
 * License Manager - Gumroad License Validation
 *
 * Handles license key validation via Gumroad API and localStorage persistence.
 */

const PRODUCT_ID = 'qowMwcfa7s4hW_ZkDrOhzw==';
const LICENSE_STORAGE_KEY = 'global_license_key';
const GUMROAD_API_URL = 'https://api.gumroad.com/v2/licenses/verify';

export interface LicenseValidationResult {
    success: boolean;
    error?: string;
}

export interface GumroadResponse {
    success: boolean;
    uses?: number;
    purchase?: {
        sale_id: string;
        product_name: string;
        email: string;
        refunded: boolean;
        chargebacked: boolean;
        sale_timestamp: string;
    };
    message?: string;
}

/**
 * Validate a license key with Gumroad API
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
    if (!licenseKey || licenseKey.trim() === '') {
        return {
            success: false,
            error: 'Please enter a license key.'
        };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('product_id', PRODUCT_ID);
        formData.append('license_key', licenseKey.trim());
        formData.append('increment_uses_count', 'false');

        const response = await fetch(GUMROAD_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        // If we can't reach Gumroad or get a server error
        if (!response.ok) {
            // HTTP errors like 500, 503, etc. indicate server issues
            if (response.status >= 500) {
                return {
                    success: false,
                    error: 'Could not connect to server. Please try again.'
                };
            }
            // Other HTTP errors (400s, etc.)
            return {
                success: false,
                error: 'Could not validate license key. Please try again.'
            };
        }

        const data: GumroadResponse = await response.json();

        // If API returns success: false, it means the key is invalid
        if (!data.success) {
            return {
                success: false,
                error: 'Invalid license key.'
            };
        }

        // Check if purchase was refunded or chargebacked
        if (data.purchase?.refunded) {
            return {
                success: false,
                error: 'This license has been refunded.'
            };
        }

        if (data.purchase?.chargebacked) {
            return {
                success: false,
                error: 'This license has been disputed.'
            };
        }

        return { success: true };

    } catch (error) {
        // Network errors (no internet, DNS failure, etc.)
        console.error('License validation network error:', error);

        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return {
                success: false,
                error: 'Could not connect to validation server. Please check your internet connection.'
            };
        }

        // Generic error fallback
        return {
            success: false,
            error: 'Could not validate license key. Please try again.'
        };
    }
}

/**
 * Store a validated license key in localStorage
 */
export function storeLicense(licenseKey: string): void {
    localStorage.setItem(LICENSE_STORAGE_KEY, licenseKey.trim());
}

/**
 * Get the stored license key
 */
export function getStoredLicense(): string | null {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
}

/**
 * Remove the stored license key
 */
export function clearLicense(): void {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
}

/**
 * Check if a license is stored (does not validate)
 */
export function hasStoredLicense(): boolean {
    const license = getStoredLicense();
    return license !== null && license.trim() !== '';
}
