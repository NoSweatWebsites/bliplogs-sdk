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
  project_id?: string; // Project ID for browser SDK (origin validation)
  anonymize_ip?: boolean; // Request server to anonymize IP address
}

export interface BlipLogsError {
  type: 'network' | 'rate_limit' | 'auth' | 'validation' | 'unknown';
  message: string;
  statusCode?: number;
  originalError?: Error;
}

/**
 * Resource type for bandwidth tracking
 */
export type BandwidthResourceType = 'script' | 'link' | 'img' | 'fetch' | 'xmlhttprequest' | 'css' | 'font' | 'other';

/**
 * Bandwidth tracking configuration options
 */
export interface BlipBandwidthConfig {
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
export interface BandwidthResourceEntry {
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
export interface ParsedUserAgent {
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
export interface BandwidthPayload {
  resources: BandwidthResourceEntry[];
  session_id?: string;
  timestamp_ms: number;
  api_key?: string;
  project_id?: string; // Project ID for browser SDK (origin validation)
  context: BlipContext;
  totalTransferSize: number;
  resourceCount: number;
  /** Parsed user agent information for debugging */
  userAgent?: ParsedUserAgent;
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
export class BlipLogs {
  private static globalInstance: BlipLogs | null = null;
  private static readonly API_ENDPOINT = 'https://api.bliplogs.co.uk';

  private apiKey: string | undefined;
  private projectId: string;
  private debug: boolean;
  private onError?: (error: BlipLogsError) => void;
  private privacy: Required<BlipPrivacyConfig>;

  // Bandwidth tracking
  private bandwidthConfig: Required<BlipBandwidthConfig>;
  private bandwidthBuffer: BandwidthResourceEntry[] = [];
  private bandwidthObserver: PerformanceObserver | null = null;
  private bandwidthIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: BlipLogsConfig) {
    if (!config.projectId) {
      throw new Error('BlipLogs: projectId is required');
    }

    // API key is required on server, optional in browser (uses origin validation)
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser && !config.apiKey) {
      throw new Error('BlipLogs: apiKey is required for server-side usage');
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

    // Initialize bandwidth tracking config
    const bandwidthEnabled = config.trackBandwidth === true ||
      (typeof config.trackBandwidth === 'object' && config.trackBandwidth.enabled !== false);

    this.bandwidthConfig = {
      enabled: bandwidthEnabled,
      batchInterval: typeof config.trackBandwidth === 'object'
        ? config.trackBandwidth.batchInterval ?? 30000
        : 30000,
      resourceTypes: typeof config.trackBandwidth === 'object'
        ? config.trackBandwidth.resourceTypes ?? []
        : [],
      maxBatchSize: typeof config.trackBandwidth === 'object'
        ? config.trackBandwidth.maxBatchSize ?? 100
        : 100,
      sanitizeUrls: typeof config.trackBandwidth === 'object'
        ? config.trackBandwidth.sanitizeUrls ?? true
        : true,
    };

    // Start bandwidth tracking if enabled
    if (this.bandwidthConfig.enabled) {
      this.initBandwidthTracking();
    }
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
   * Known bot patterns for detection
   */
  private static readonly BOT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /googlebot/i, name: 'Googlebot' },
    { pattern: /bingbot/i, name: 'Bingbot' },
    { pattern: /slurp/i, name: 'Yahoo Slurp' },
    { pattern: /duckduckbot/i, name: 'DuckDuckBot' },
    { pattern: /baiduspider/i, name: 'Baiduspider' },
    { pattern: /yandexbot/i, name: 'YandexBot' },
    { pattern: /facebot|facebookexternalhit/i, name: 'Facebook Bot' },
    { pattern: /twitterbot/i, name: 'Twitter Bot' },
    { pattern: /linkedinbot/i, name: 'LinkedIn Bot' },
    { pattern: /slackbot/i, name: 'Slackbot' },
    { pattern: /telegrambot/i, name: 'Telegram Bot' },
    { pattern: /discordbot/i, name: 'Discord Bot' },
    { pattern: /whatsapp/i, name: 'WhatsApp' },
    { pattern: /applebot/i, name: 'Applebot' },
    { pattern: /semrushbot/i, name: 'SEMrush Bot' },
    { pattern: /ahrefsbot/i, name: 'Ahrefs Bot' },
    { pattern: /mj12bot/i, name: 'Majestic Bot' },
    { pattern: /dotbot/i, name: 'DotBot' },
    { pattern: /petalbot/i, name: 'PetalBot' },
    { pattern: /bytespider/i, name: 'ByteSpider' },
    { pattern: /gptbot/i, name: 'GPTBot' },
    { pattern: /claudebot/i, name: 'ClaudeBot' },
    { pattern: /headless/i, name: 'Headless Browser' },
    { pattern: /phantomjs/i, name: 'PhantomJS' },
    { pattern: /lighthouse/i, name: 'Lighthouse' },
    { pattern: /pagespeed/i, name: 'PageSpeed Insights' },
    { pattern: /crawl|spider|bot|scrape/i, name: 'Generic Bot' },
  ];

  /**
   * Parse user agent string into structured information
   */
  private parseUserAgent(ua: string): ParsedUserAgent {
    const result: ParsedUserAgent = {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      isBot: false,
      deviceType: 'unknown',
      raw: ua,
    };

    if (!ua) return result;

    // Check for bots first
    for (const { pattern, name } of BlipLogs.BOT_PATTERNS) {
      if (pattern.test(ua)) {
        result.isBot = true;
        result.botName = name;
        result.browser = name;
        return result;
      }
    }

    // Detect browser
    if (/edg/i.test(ua)) {
      result.browser = 'Edge';
      const match = ua.match(/edg[e]?\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    } else if (/opr|opera/i.test(ua)) {
      result.browser = 'Opera';
      const match = ua.match(/(?:opr|opera)[\/\s](\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    } else if (/chrome|chromium|crios/i.test(ua)) {
      result.browser = 'Chrome';
      const match = ua.match(/(?:chrome|chromium|crios)\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    } else if (/firefox|fxios/i.test(ua)) {
      result.browser = 'Firefox';
      const match = ua.match(/(?:firefox|fxios)\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      result.browser = 'Safari';
      const match = ua.match(/version\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    } else if (/msie|trident/i.test(ua)) {
      result.browser = 'Internet Explorer';
      const match = ua.match(/(?:msie |rv:)(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || '';
    }

    // Detect OS
    if (/windows/i.test(ua)) {
      result.os = 'Windows';
      if (/windows nt 10/i.test(ua)) result.os = 'Windows 10/11';
      else if (/windows nt 6.3/i.test(ua)) result.os = 'Windows 8.1';
      else if (/windows nt 6.2/i.test(ua)) result.os = 'Windows 8';
      else if (/windows nt 6.1/i.test(ua)) result.os = 'Windows 7';
    } else if (/macintosh|mac os x/i.test(ua)) {
      result.os = 'macOS';
    } else if (/iphone/i.test(ua)) {
      result.os = 'iOS';
    } else if (/ipad/i.test(ua)) {
      result.os = 'iPadOS';
    } else if (/android/i.test(ua)) {
      result.os = 'Android';
    } else if (/linux/i.test(ua)) {
      result.os = 'Linux';
    } else if (/cros/i.test(ua)) {
      result.os = 'Chrome OS';
    }

    // Detect device type
    if (/mobile|iphone|ipod|android.*mobile|webos|blackberry|opera mini|opera mobi|iemobile/i.test(ua)) {
      result.deviceType = 'mobile';
    } else if (/tablet|ipad|android(?!.*mobile)|kindle|silk/i.test(ua)) {
      result.deviceType = 'tablet';
    } else if (/windows|macintosh|linux|cros/i.test(ua)) {
      result.deviceType = 'desktop';
    }

    return result;
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
    // Include authentication in body
    // Browser SDK: includes project_id (server validates Origin header)
    // Server SDK: includes api_key (traditional auth)
    const payloadWithAuth = {
      ...payload,
      project_id: this.projectId,
      ...(this.apiKey && { api_key: this.apiKey }),
    };
    const body = JSON.stringify(payloadWithAuth);

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      fetch(BlipLogs.API_ENDPOINT, {
        method: 'POST',
        headers,
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

  // ============================================
  // Bandwidth Tracking Methods
  // ============================================

  /**
   * Initialize bandwidth tracking with PerformanceObserver
   */
  private initBandwidthTracking(): void {
    // Only work in browser environments with PerformanceObserver support
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      if (this.debug) {
        console.warn('BlipLogs: Bandwidth tracking requires browser environment with PerformanceObserver');
      }
      return;
    }

    try {
      this.bandwidthObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.recordResourceTiming(entry as PerformanceResourceTiming);
          }
        }
      });

      // Observe resource timing entries, including buffered entries
      this.bandwidthObserver.observe({ type: 'resource', buffered: true });

      // Set up batch interval to flush data periodically
      this.bandwidthIntervalId = setInterval(() => {
        this.flushBandwidthBatch();
      }, this.bandwidthConfig.batchInterval);

      // Flush on page visibility change (user navigating away)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            this.flushBandwidthBatch();
          }
        });
      }

      if (this.debug) {
        console.log('BlipLogs: Bandwidth tracking initialized');
      }
    } catch (error) {
      if (this.debug) {
        console.error('BlipLogs: Failed to initialize bandwidth tracking:', error);
      }
    }
  }

  /**
   * Record a single resource timing entry
   */
  private recordResourceTiming(entry: PerformanceResourceTiming): void {
    const initiatorType = entry.initiatorType || 'other';

    // Filter by resource types if configured
    if (this.bandwidthConfig.resourceTypes.length > 0 &&
        !this.bandwidthConfig.resourceTypes.includes(initiatorType as BandwidthResourceType)) {
      return;
    }

    // Sanitize URL if enabled
    const url = this.bandwidthConfig.sanitizeUrls
      ? this.sanitizeResourceUrl(entry.name)
      : entry.name;

    const resourceEntry: BandwidthResourceEntry = {
      url,
      resourceType: initiatorType,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0,
      duration: entry.duration || 0,
      startTime: entry.startTime || 0,
    };

    this.bandwidthBuffer.push(resourceEntry);

    // Auto-flush if buffer exceeds max batch size
    if (this.bandwidthBuffer.length >= this.bandwidthConfig.maxBatchSize) {
      this.flushBandwidthBatch();
    }
  }

  /**
   * Sanitize resource URL - removes sensitive params and query strings
   */
  private sanitizeResourceUrl(url: string): string {
    // First apply standard URL sanitization
    const sanitized = this.sanitizeUrl(url);
    if (!sanitized) return '[UNKNOWN]';

    try {
      const urlObj = new URL(sanitized);
      // For bandwidth tracking, only keep origin + pathname (strip query params entirely)
      return urlObj.origin + urlObj.pathname;
    } catch {
      return sanitized;
    }
  }

  /**
   * Flush accumulated bandwidth data to API
   */
  private flushBandwidthBatch(): void {
    if (this.bandwidthBuffer.length === 0) return;

    // Take up to maxBatchSize resources from buffer
    const resources = this.bandwidthBuffer.splice(0, this.bandwidthConfig.maxBatchSize);
    const totalTransferSize = resources.reduce((sum, r) => sum + r.transferSize, 0);

    // Parse user agent for debugging
    const rawUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const parsedUserAgent = this.privacy.collectUserAgent && rawUserAgent
      ? this.parseUserAgent(rawUserAgent)
      : undefined;

    const payload: BandwidthPayload = {
      resources,
      session_id: this.privacy.collectSessionId ? this.getSessionId() : undefined,
      timestamp_ms: Date.now(),
      project_id: this.projectId,
      ...(this.apiKey && { api_key: this.apiKey }),
      context: this.getContext(),
      totalTransferSize,
      resourceCount: resources.length,
      userAgent: parsedUserAgent,
    };

    this.sendBandwidth(payload);
  }

  /**
   * Send bandwidth data using sendBeacon with fetch fallback
   */
  private sendBandwidth(payload: BandwidthPayload): boolean {
    const endpoint = `${BlipLogs.API_ENDPOINT}/bandwidth`;
    const body = JSON.stringify(payload);

    // Use sendBeacon as primary method
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const sent = navigator.sendBeacon(endpoint, blob);
        if (sent) return true;
      } catch {
        // Fall through to fetch
      }
    }

    // Fallback to fetch
    if (typeof fetch !== 'undefined') {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch((err) => {
        this.handleError({
          type: 'network',
          message: err?.message || 'Bandwidth tracking request failed',
          originalError: err instanceof Error ? err : undefined,
        });
      });
      return true;
    }

    return false;
  }

  /**
   * Stop bandwidth tracking and cleanup resources
   * Call this when unmounting or when you want to stop tracking
   */
  stopBandwidthTracking(): void {
    if (this.bandwidthObserver) {
      this.bandwidthObserver.disconnect();
      this.bandwidthObserver = null;
    }
    if (this.bandwidthIntervalId) {
      clearInterval(this.bandwidthIntervalId);
      this.bandwidthIntervalId = null;
    }
    // Flush any remaining data
    this.flushBandwidthBatch();

    if (this.debug) {
      console.log('BlipLogs: Bandwidth tracking stopped');
    }
  }

  /**
   * Stop bandwidth tracking on the global instance
   */
  static stopBandwidthTracking(): void {
    BlipLogs.getInstance().stopBandwidthTracking();
  }
}

export default BlipLogs;
