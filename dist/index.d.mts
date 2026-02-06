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
    project_id?: string;
    anonymize_ip?: boolean;
}
interface BlipLogsError {
    type: 'network' | 'rate_limit' | 'auth' | 'validation' | 'unknown';
    message: string;
    statusCode?: number;
    originalError?: Error;
}
/**
 * Resource type for bandwidth tracking
 */
type BandwidthResourceType = 'script' | 'link' | 'img' | 'fetch' | 'xmlhttprequest' | 'css' | 'font' | 'other';
/**
 * Bandwidth tracking configuration options
 */
interface BlipBandwidthConfig {
    /** Enable bandwidth tracking (default: false) */
    enabled?: boolean;
    /** Batch interval in milliseconds (default: 30000 = 30 seconds) */
    batchInterval?: number;
    /** Resource types to track (default: all types) */
    resourceTypes?: BandwidthResourceType[];
    /** Maximum resources per batch (default: 100) */
    maxBatchSize?: number;
    /** Sanitize URLs to remove sensitive data (default: true) */
    sanitizeUrls?: boolean;
}
/**
 * Single resource timing entry for bandwidth tracking
 */
interface BandwidthResourceEntry {
    /** Sanitized URL of the resource */
    url: string;
    /** Resource type (script, img, fetch, etc.) */
    resourceType: string;
    /** Bytes transferred over the network */
    transferSize: number;
    /** Encoded (compressed) body size */
    encodedBodySize: number;
    /** Decoded (uncompressed) body size */
    decodedBodySize: number;
    /** Total duration in milliseconds */
    duration: number;
    /** Start time relative to navigation start */
    startTime: number;
}
/**
 * Parsed user agent information for debugging
 */
interface ParsedUserAgent {
    /** Browser name (Chrome, Firefox, Safari, Edge, etc.) */
    browser: string;
    /** Browser version */
    browserVersion: string;
    /** Operating system (Windows, macOS, Linux, iOS, Android) */
    os: string;
    /** Whether this appears to be a bot/crawler */
    isBot: boolean;
    /** Bot name if detected */
    botName?: string;
    /** Device type (desktop, mobile, tablet) */
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    /** Raw user agent string */
    raw: string;
}
/**
 * Bandwidth batch payload sent to API
 */
interface BandwidthPayload {
    resources: BandwidthResourceEntry[];
    session_id?: string;
    timestamp_ms: number;
    api_key?: string;
    project_id?: string;
    context: BlipContext;
    totalTransferSize: number;
    resourceCount: number;
    /** Parsed user agent information for debugging */
    userAgent?: ParsedUserAgent;
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
    /** API key for server-side authentication. Optional in browser when using domain whitelisting. */
    apiKey?: string;
    /** Project ID - required for both browser and server usage */
    projectId: string;
    /** Enable debug mode to log errors to console (default: false) */
    debug?: boolean;
    /** Callback fired when an error occurs during event tracking */
    onError?: (error: BlipLogsError) => void;
    /** Privacy settings for GDPR compliance */
    privacy?: BlipPrivacyConfig;
    /** Enable bandwidth tracking to monitor resource loads across the site */
    trackBandwidth?: boolean | BlipBandwidthConfig;
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
    private bandwidthConfig;
    private bandwidthBuffer;
    private bandwidthObserver;
    private bandwidthIntervalId;
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
     * Known bot patterns for detection
     */
    private static readonly BOT_PATTERNS;
    /**
     * Parse user agent string into structured information
     */
    private parseUserAgent;
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
    /**
     * Initialize bandwidth tracking with PerformanceObserver
     */
    private initBandwidthTracking;
    /**
     * Record a single resource timing entry
     */
    private recordResourceTiming;
    /**
     * Sanitize resource URL - removes sensitive params and query strings
     */
    private sanitizeResourceUrl;
    /**
     * Flush accumulated bandwidth data to API
     */
    private flushBandwidthBatch;
    /**
     * Send bandwidth data using sendBeacon with fetch fallback
     */
    private sendBandwidth;
    /**
     * Stop bandwidth tracking and cleanup resources
     * Call this when unmounting or when you want to stop tracking
     */
    stopBandwidthTracking(): void;
    /**
     * Stop bandwidth tracking on the global instance
     */
    static stopBandwidthTracking(): void;
}

export { type BandwidthPayload, type BandwidthResourceEntry, type BandwidthResourceType, type BlipBandwidthConfig, type BlipContext, type BlipLevel, BlipLogs, type BlipLogsConfig, type BlipLogsError, type BlipMetadata, type BlipPayload, type BlipPrivacyConfig, type ParsedUserAgent, BlipLogs as default };
