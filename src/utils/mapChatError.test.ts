import { describe, it, expect } from 'vitest';
import { mapChatError } from './mapChatError';

describe('mapChatError', () => {
    it('handles 401 errors', () => {
        expect(mapChatError({ message: '401 Unauthorized' }))
            .toBe("Your session seems to have expired. Please log in again.");
    });

    it('handles rate limits', () => {
        expect(mapChatError({ message: '429 Too many requests' }))
            .toBe("I'm receiving too many requests right now. Please wait a moment and try again.");
    });

    it('handles configuration errors', () => {
        expect(mapChatError({ message: 'configuration' }))
            .toBe("My AI systems are currently unconfigured. Please check the backend configuration.");
    });

    it('falls back to generic error', () => {
        expect(mapChatError({ message: 'Unknown server crash' }))
            .toBe("I'm having a bit of trouble connecting right now. Let me try again in a moment.");
    });
});

