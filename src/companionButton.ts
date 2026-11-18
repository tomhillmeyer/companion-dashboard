import type { CompanionConnection } from './types';

export interface CompanionButtonTarget {
    companionButtonLocation?: string;
    companionButtonConnectionId?: string;
}

/**
 * Press a Companion button via its REST API.
 *
 * Runs on a device that can reach Companion directly (Electron host or the
 * native app). Web clients must never call this — they send a
 * `press-companion-button` WebSocket message and the host performs the press.
 *
 * Returns true when Companion accepted the press.
 */
export const pressCompanionButton = async (
    box: CompanionButtonTarget,
    defaultBaseUrl: string,
    connections: CompanionConnection[] = []
): Promise<boolean> => {
    const location = box.companionButtonLocation?.trim();
    if (!location) {
        console.log('No companion button location set');
        return false;
    }

    // Validate format: should be "page/row/column"
    const parts = location.split('/');
    if (parts.length !== 3) {
        console.warn('Invalid Companion button location format. Expected: page/row/column');
        return false;
    }

    // Determine which connection URL to use
    let baseUrl = defaultBaseUrl;
    if (box.companionButtonConnectionId) {
        const selectedConnection = connections.find(c => c.id === box.companionButtonConnectionId);
        if (selectedConnection?.url) {
            baseUrl = selectedConnection.url;
        }
    }

    const [page, row, column] = parts;
    const url = `${baseUrl}/api/location/${page}/${row}/${column}/press`;

    console.log('Sending POST to:', url);

    try {
        const response = await fetch(url, { method: 'POST' });
        console.log('Response:', response.status, response.statusText);
        return response.ok;
    } catch (error) {
        console.error('Failed to send Companion button press:', error);
        return false;
    }
};
