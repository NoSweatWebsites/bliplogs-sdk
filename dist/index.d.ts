type BlipLevel = 'info' | 'warn' | 'error';
interface BlipMetadata {
    [key: string]: unknown;
}
interface BlipContext {
    projectId?: string;
    url?: string;
    referrer?: string;
    userAgent?: string;
}
interface BlipPayload {
    event: string;
    level: BlipLevel;
    metadata?: BlipMetadata;
    context: BlipContext;
    timestamp: string;
    session_id?: string;
    timestamp_ms?: number;
    api_key?: string;
    anonymize_ip?: boolean;
}
interface BlipLogsError {
    type: 'network' | 'rate_limit' | 'auth' | 'validation' | 'unknown';
    message: string;
    statusCode?: number;
    originalError?: Error;
}
/**
 * Privacy configuration options for GDPR compliance
 */
interface BlipPrivacyConfig {
    /** Anonymize IP address on server (default: false) */
    anonymizeIp?: boolean;
    /** Collect page URL (default: true) */
    collectUrl?: boolean;
    /** Collect referrer URL (default: true) */
    collectReferrer?: boolean;
    /** Collect user agent string (default: true) */
    collectUserAgent?: boolean;
    /** Enable session tracking (default: true) */
    collectSessionId?: boolean;
}
interface BlipLogsConfig {
    apiKey: string;
    projectId: string;
    /** Enable debug mode to log errors to console (default: false) */
    debug?: boolean;
    /** Callback fired when an error occurs during event tracking */
    onError?: (error: BlipLogsError) => void;
    /** Privacy settings for GDPR compliance */
    privacy?: BlipPrivacyConfig;
}
/**
 * BlipLogs SDK - Zero-dependency event logging client
 *
 * @example
 * ```ts
 * // Global configuration (recommended for Astro/React apps)
 * BlipLogs.configure({ apiKey: 'your-api-key', projectId: 'your-project-id' });
 * BlipLogs.track('button_clicked', { buttonId: 'signup' });
 *
 * // Or use instance-based API
 * const blip = new BlipLogs({ apiKey: 'your-api-key', projectId: 'your-project-id' });
 * blip.track('error_occurred', { message: 'Failed to load' }, 'error');
 * ```
 */
declare class BlipLogs {
    private static globalInstance;
    private static readonly API_ENDPOINT;
    private apiKey;
    private projectId;
    private debug;
    private onError?;
    private privacy;
    constructor(config: BlipLogsConfig);
    /**
     * Configure the global BlipLogs instance
     * Call this once at the start of your application (e.g., in your Astro layout)
     *
     * @example
     * ```ts
     * // In Astro layout or initialization script
     * BlipLogs.configure({
     *   apiKey: import.meta.env.PUBLIC_BLIPLOGS_API_KEY,
     *   projectId: import.meta.env.PUBLIC_BLIPLOGS_PROJECT_ID
     * });
     * ```
     */
    static configure(config: BlipLogsConfig): void;
    /**
     * Get the global BlipLogs instance
     * Throws an error if not configured
     */
    private static getInstance;
    /**
     * Track an event using the global instance
     *
     * @example
     * ```ts
     * BlipLogs.track('button_clicked', { buttonId: 'signup' });
     * ```
     */
    static track(event: string, metadata?: BlipMetadata, level?: BlipLevel): boolean;
    /**
     * Track an info-level event using the global instance
     *
     * @example
     * ```ts
     * BlipLogs.info('page_viewed', { page: '/dashboard' });
     * ```
     */
    static info(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Track a warn-level event using the global instance
     *
     * @example
     * ```ts
     * BlipLogs.warn('slow_request', { duration: 5000 });
     * ```
     */
    static warn(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Track an error-level event using the global instance
     *
     * @example
     * ```ts
     * BlipLogs.error('api_error', { message: 'Failed to fetch' });
     * ```
     */
    static error(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Gets or creates a session ID from sessionStorage
     * Sessions expire after 30 minutes of inactivity
     */
    private getSessionId;
    /**
     * Sensitive URL parameters that should be redacted
     */
    private static readonly SENSITIVE_PARAMS;
    /**
     * Sanitize a URL by removing sensitive query parameters
     */
    private sanitizeUrl;
    /**
     * Auto-captures browser context information with sensitive data sanitization
     * Respects privacy configuration settings
     */
    private getContext;
    /**
     * Track an event with optional metadata and level
     *
     * @param event - The event name (e.g., 'signup_modal_opened')
     * @param metadata - Optional custom data to attach to the event
     * @param level - Event level: 'info' (default), 'warn', or 'error'
     * @returns boolean - Whether the event was queued for delivery
     */
    track(event: string, metadata?: BlipMetadata, level?: BlipLevel): boolean;
    /**
     * Convenience method for info-level events
     */
    info(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Convenience method for warn-level events
     */
    warn(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Convenience method for error-level events
     */
    error(event: string, metadata?: BlipMetadata): boolean;
    /**
     * Sends the payload using sendBeacon for speed and reliability
     * Falls back to fetch if sendBeacon is unavailable or blocked
     */
    private send;
    /**
     * Handle and report errors
     */
    private handleError;
    /**
     * Fallback method using fetch API
     */
    private sendWithFetch;
}

export { type BlipContext, type BlipLevel, BlipLogs, type BlipLogsConfig, type BlipLogsError, type BlipMetadata, type BlipPayload, type BlipPrivacyConfig, BlipLogs as default };
