export type BlipLevel = 'info' | 'warn' | 'error';

export interface BlipMetadata {
  [key: string]: unknown;
}

export interface BlipContext {
  projectId?: string;
  url?: string;
  referrer?: string;
  userAgent?: string;
}

export interface BlipPayload {
  event: string;
  level: BlipLevel;
  metadata?: BlipMetadata;
  context: BlipContext;
  timestamp: string; // ISO string for backward compatibility
  session_id?: string; // Session ID from client
  timestamp_ms?: number; // Numeric timestamp in milliseconds
  api_key?: string; // API key included in body for sendBeacon (avoids URL exposure)
  anonymize_ip?: boolean; // Request server to anonymize IP address
}

export interface BlipLogsError {
  type: 'network' | 'rate_limit' | 'auth' | 'validation' | 'unknown';
  message: string;
  statusCode?: number;
  originalError?: Error;
}

/**
 * Privacy configuration options for GDPR compliance
 */
export interface BlipPrivacyConfig {
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

export interface BlipLogsConfig {
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
export class BlipLogs {
  private static globalInstance: BlipLogs | null = null;
  private static readonly API_ENDPOINT = 'https://api.bliplogs.co.uk';

  private apiKey: string;
  private projectId: string;
  private debug: boolean;
  private onError?: (error: BlipLogsError) => void;
  private privacy: Required<BlipPrivacyConfig>;

  constructor(config: BlipLogsConfig) {
    if (!config.apiKey) {
      throw new Error('BlipLogs: apiKey is required');
    }
    if (!config.projectId) {
      throw new Error('BlipLogs: projectId is required');
    }
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.debug = config.debug ?? false;
    this.onError = config.onError;
    this.privacy = {
      anonymizeIp: config.privacy?.anonymizeIp ?? false,
      collectUrl: config.privacy?.collectUrl ?? true,
      collectReferrer: config.privacy?.collectReferrer ?? true,
      collectUserAgent: config.privacy?.collectUserAgent ?? true,
      collectSessionId: config.privacy?.collectSessionId ?? true,
    };
  }

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
  static configure(config: BlipLogsConfig): void {
    BlipLogs.globalInstance = new BlipLogs(config);
  }

  /**
   * Get the global BlipLogs instance
   * Throws an error if not configured
   */
  private static getInstance(): BlipLogs {
    if (!BlipLogs.globalInstance) {
      throw new Error('BlipLogs: Global instance not configured. Call BlipLogs.configure() first.');
    }
    return BlipLogs.globalInstance;
  }

  /**
   * Track an event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.track('button_clicked', { buttonId: 'signup' });
   * ```
   */
  static track(event: string, metadata?: BlipMetadata, level: BlipLevel = 'info'): boolean {
    return BlipLogs.getInstance().track(event, metadata, level);
  }

  /**
   * Track an info-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.info('page_viewed', { page: '/dashboard' });
   * ```
   */
  static info(event: string, metadata?: BlipMetadata): boolean {
    return BlipLogs.getInstance().info(event, metadata);
  }

  /**
   * Track a warn-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.warn('slow_request', { duration: 5000 });
   * ```
   */
  static warn(event: string, metadata?: BlipMetadata): boolean {
    return BlipLogs.getInstance().warn(event, metadata);
  }

  /**
   * Track an error-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.error('api_error', { message: 'Failed to fetch' });
   * ```
   */
  static error(event: string, metadata?: BlipMetadata): boolean {
    return BlipLogs.getInstance().error(event, metadata);
  }

  /**
   * Gets or creates a session ID from sessionStorage
   * Sessions expire after 30 minutes of inactivity
   */
  private getSessionId(): string | undefined {
    // Only work in browser environments with sessionStorage
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return undefined;
    }

    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    const STORAGE_KEY_ID = 'blip_session_id';
    const STORAGE_KEY_TS = 'blip_session_ts';

    try {
      let sessionId = sessionStorage.getItem(STORAGE_KEY_ID);
      const lastActivityStr = sessionStorage.getItem(STORAGE_KEY_TS);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : null;
      const now = Date.now();

      // Check if session expired or doesn't exist
      if (!sessionId || !lastActivity || (now - lastActivity > SESSION_TIMEOUT)) {
        // Generate new session ID
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(STORAGE_KEY_ID, sessionId);
      }

      // Update last activity timestamp
      sessionStorage.setItem(STORAGE_KEY_TS, now.toString());

      return sessionId;
    } catch (error) {
      // sessionStorage might be disabled or throw errors
      // Silently fail and return undefined (bot handling)
      return undefined;
    }
  }

  /**
   * Sensitive URL parameters that should be redacted
   */
  private static readonly SENSITIVE_PARAMS = [
    'token', 'access_token', 'refresh_token', 'id_token',
    'apikey', 'api_key', 'api-key', 'key',
    'password', 'pwd', 'pass', 'secret',
    'auth', 'authorization', 'bearer',
    'session', 'sessionid', 'session_id',
    'code', 'state', 'nonce', // OAuth params
    'email', 'phone', 'ssn', // PII
    'credit_card', 'cc', 'cvv', 'card',
  ];

  /**
   * Sanitize a URL by removing sensitive query parameters
   */
  private sanitizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;

    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const sensitiveSet = new Set(BlipLogs.SENSITIVE_PARAMS.map(p => p.toLowerCase()));

      // Check each param and redact if sensitive
      const paramsToRedact: string[] = [];
      params.forEach((_, key) => {
        if (sensitiveSet.has(key.toLowerCase())) {
          paramsToRedact.push(key);
        }
      });

      // Redact sensitive params
      for (const key of paramsToRedact) {
        params.set(key, '[REDACTED]');
      }

      return urlObj.toString();
    } catch {
      // If URL parsing fails, return original but strip query string as fallback
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        return url.substring(0, queryIndex) + '?[QUERY_REDACTED]';
      }
      return url;
    }
  }

  /**
   * Auto-captures browser context information with sensitive data sanitization
   * Respects privacy configuration settings
   */
  private getContext(): BlipContext {
    const baseContext: BlipContext = {
      projectId: this.projectId,
    };

    if (typeof window === 'undefined') {
      return baseContext;
    }

    return {
      ...baseContext,
      url: this.privacy.collectUrl ? this.sanitizeUrl(window.location?.href) : undefined,
      referrer: this.privacy.collectReferrer ? (this.sanitizeUrl(document.referrer) || undefined) : undefined,
      userAgent: this.privacy.collectUserAgent ? navigator.userAgent : undefined,
    };
  }

  /**
   * Track an event with optional metadata and level
   *
   * @param event - The event name (e.g., 'signup_modal_opened')
   * @param metadata - Optional custom data to attach to the event
   * @param level - Event level: 'info' (default), 'warn', or 'error'
   * @returns boolean - Whether the event was queued for delivery
   */
  track(event: string, metadata?: BlipMetadata, level: BlipLevel = 'info'): boolean {
    if (!event) {
      console.warn('BlipLogs: event name is required');
      return false;
    }

    const now = Date.now();
    const sessionId = this.privacy.collectSessionId ? this.getSessionId() : undefined;

    const payload: BlipPayload = {
      event,
      level,
      metadata,
      context: this.getContext(),
      timestamp: new Date().toISOString(), // Keep for backward compatibility
      session_id: sessionId,
      timestamp_ms: now, // Numeric timestamp in milliseconds
      anonymize_ip: this.privacy.anonymizeIp || undefined, // Only include if true
    };

    return this.send(payload);
  }

  /**
   * Convenience method for info-level events
   */
  info(event: string, metadata?: BlipMetadata): boolean {
    return this.track(event, metadata, 'info');
  }

  /**
   * Convenience method for warn-level events
   */
  warn(event: string, metadata?: BlipMetadata): boolean {
    return this.track(event, metadata, 'warn');
  }

  /**
   * Convenience method for error-level events
   */
  error(event: string, metadata?: BlipMetadata): boolean {
    return this.track(event, metadata, 'error');
  }

  /**
   * Sends the payload using sendBeacon for speed and reliability
   * Falls back to fetch if sendBeacon is unavailable or blocked
   */
  private send(payload: BlipPayload): boolean {
    // Include API key in body for sendBeacon (avoids URL exposure in logs/history)
    const payloadWithKey = {
      ...payload,
      api_key: this.apiKey,
    };
    const body = JSON.stringify(payloadWithKey);

    // Use sendBeacon as primary method (faster and more reliable for fire-and-forget)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        // API key is now in the body, not the URL - prevents exposure in logs/history
        const sent = navigator.sendBeacon(BlipLogs.API_ENDPOINT, blob);

        // If sendBeacon returns false (blocked by client), fall back to fetch
        if (!sent) {
          return this.sendWithFetch(body);
        }

        return true;
      } catch (error) {
        // If sendBeacon throws an error, fall back to fetch
        return this.sendWithFetch(body);
      }
    }

    // Fallback to fetch for non-browser environments or when sendBeacon is unavailable
    return this.sendWithFetch(body);
  }

  /**
   * Handle and report errors
   */
  private handleError(error: BlipLogsError): void {
    if (this.debug) {
      console.error(`BlipLogs Error [${error.type}]:`, error.message, error);
    }
    if (this.onError) {
      try {
        this.onError(error);
      } catch (callbackError) {
        // Prevent callback errors from breaking the SDK
        if (this.debug) {
          console.error('BlipLogs: Error in onError callback:', callbackError);
        }
      }
    }
  }

  /**
   * Fallback method using fetch API
   */
  private sendWithFetch(body: string): boolean {
    if (typeof fetch !== 'undefined') {
      fetch(BlipLogs.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body,
        keepalive: true,
        credentials: 'omit',
      })
        .then((response) => {
          if (!response.ok) {
            let errorType: BlipLogsError['type'] = 'unknown';
            let message = `HTTP ${response.status}`;

            if (response.status === 429) {
              errorType = 'rate_limit';
              message = 'Monthly event limit exceeded. Upgrade your plan to continue.';
            } else if (response.status === 401) {
              errorType = 'auth';
              message = 'Invalid API key';
            } else if (response.status === 400) {
              errorType = 'validation';
              message = 'Invalid request payload';
            }

            this.handleError({
              type: errorType,
              message,
              statusCode: response.status,
            });
          }
        })
        .catch((err) => {
          this.handleError({
            type: 'network',
            message: err?.message || 'Network request failed',
            originalError: err instanceof Error ? err : undefined,
          });
        });
      return true;
    }

    this.handleError({
      type: 'unknown',
      message: 'No suitable transport available (fetch not defined)',
    });
    return false;
  }
}

export default BlipLogs;
