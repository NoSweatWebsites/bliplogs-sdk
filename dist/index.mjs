// src/index.ts
var _BlipLogs = class _BlipLogs {
  constructor(config) {
    if (!config.apiKey) {
      throw new Error("BlipLogs: apiKey is required");
    }
    if (!config.projectId) {
      throw new Error("BlipLogs: projectId is required");
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
      collectSessionId: config.privacy?.collectSessionId ?? true
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
  static configure(config) {
    _BlipLogs.globalInstance = new _BlipLogs(config);
  }
  /**
   * Get the global BlipLogs instance
   * Throws an error if not configured
   */
  static getInstance() {
    if (!_BlipLogs.globalInstance) {
      throw new Error("BlipLogs: Global instance not configured. Call BlipLogs.configure() first.");
    }
    return _BlipLogs.globalInstance;
  }
  /**
   * Track an event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.track('button_clicked', { buttonId: 'signup' });
   * ```
   */
  static track(event, metadata, level = "info") {
    return _BlipLogs.getInstance().track(event, metadata, level);
  }
  /**
   * Track an info-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.info('page_viewed', { page: '/dashboard' });
   * ```
   */
  static info(event, metadata) {
    return _BlipLogs.getInstance().info(event, metadata);
  }
  /**
   * Track a warn-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.warn('slow_request', { duration: 5000 });
   * ```
   */
  static warn(event, metadata) {
    return _BlipLogs.getInstance().warn(event, metadata);
  }
  /**
   * Track an error-level event using the global instance
   * 
   * @example
   * ```ts
   * BlipLogs.error('api_error', { message: 'Failed to fetch' });
   * ```
   */
  static error(event, metadata) {
    return _BlipLogs.getInstance().error(event, metadata);
  }
  /**
   * Gets or creates a session ID from sessionStorage
   * Sessions expire after 30 minutes of inactivity
   */
  getSessionId() {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
      return void 0;
    }
    const SESSION_TIMEOUT = 30 * 60 * 1e3;
    const STORAGE_KEY_ID = "blip_session_id";
    const STORAGE_KEY_TS = "blip_session_ts";
    try {
      let sessionId = sessionStorage.getItem(STORAGE_KEY_ID);
      const lastActivityStr = sessionStorage.getItem(STORAGE_KEY_TS);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : null;
      const now = Date.now();
      if (!sessionId || !lastActivity || now - lastActivity > SESSION_TIMEOUT) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(STORAGE_KEY_ID, sessionId);
      }
      sessionStorage.setItem(STORAGE_KEY_TS, now.toString());
      return sessionId;
    } catch (error) {
      return void 0;
    }
  }
  /**
   * Sanitize a URL by removing sensitive query parameters
   */
  sanitizeUrl(url) {
    if (!url) return void 0;
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const sensitiveSet = new Set(_BlipLogs.SENSITIVE_PARAMS.map((p) => p.toLowerCase()));
      const paramsToRedact = [];
      params.forEach((_, key) => {
        if (sensitiveSet.has(key.toLowerCase())) {
          paramsToRedact.push(key);
        }
      });
      for (const key of paramsToRedact) {
        params.set(key, "[REDACTED]");
      }
      return urlObj.toString();
    } catch {
      const queryIndex = url.indexOf("?");
      if (queryIndex !== -1) {
        return url.substring(0, queryIndex) + "?[QUERY_REDACTED]";
      }
      return url;
    }
  }
  /**
   * Auto-captures browser context information with sensitive data sanitization
   * Respects privacy configuration settings
   */
  getContext() {
    const baseContext = {
      projectId: this.projectId
    };
    if (typeof window === "undefined") {
      return baseContext;
    }
    return {
      ...baseContext,
      url: this.privacy.collectUrl ? this.sanitizeUrl(window.location?.href) : void 0,
      referrer: this.privacy.collectReferrer ? this.sanitizeUrl(document.referrer) || void 0 : void 0,
      userAgent: this.privacy.collectUserAgent ? navigator.userAgent : void 0
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
  track(event, metadata, level = "info") {
    if (!event) {
      console.warn("BlipLogs: event name is required");
      return false;
    }
    const now = Date.now();
    const sessionId = this.privacy.collectSessionId ? this.getSessionId() : void 0;
    const payload = {
      event,
      level,
      metadata,
      context: this.getContext(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      // Keep for backward compatibility
      session_id: sessionId,
      timestamp_ms: now,
      // Numeric timestamp in milliseconds
      anonymize_ip: this.privacy.anonymizeIp || void 0
      // Only include if true
    };
    return this.send(payload);
  }
  /**
   * Convenience method for info-level events
   */
  info(event, metadata) {
    return this.track(event, metadata, "info");
  }
  /**
   * Convenience method for warn-level events
   */
  warn(event, metadata) {
    return this.track(event, metadata, "warn");
  }
  /**
   * Convenience method for error-level events
   */
  error(event, metadata) {
    return this.track(event, metadata, "error");
  }
  /**
   * Sends the payload using sendBeacon for speed and reliability
   * Falls back to fetch if sendBeacon is unavailable or blocked
   */
  send(payload) {
    const payloadWithKey = {
      ...payload,
      api_key: this.apiKey
    };
    const body = JSON.stringify(payloadWithKey);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        const sent = navigator.sendBeacon(_BlipLogs.API_ENDPOINT, blob);
        if (!sent) {
          return this.sendWithFetch(body);
        }
        return true;
      } catch (error) {
        return this.sendWithFetch(body);
      }
    }
    return this.sendWithFetch(body);
  }
  /**
   * Handle and report errors
   */
  handleError(error) {
    if (this.debug) {
      console.error(`BlipLogs Error [${error.type}]:`, error.message, error);
    }
    if (this.onError) {
      try {
        this.onError(error);
      } catch (callbackError) {
        if (this.debug) {
          console.error("BlipLogs: Error in onError callback:", callbackError);
        }
      }
    }
  }
  /**
   * Fallback method using fetch API
   */
  sendWithFetch(body) {
    if (typeof fetch !== "undefined") {
      fetch(_BlipLogs.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
        },
        body,
        keepalive: true,
        credentials: "omit"
      }).then((response) => {
        if (!response.ok) {
          let errorType = "unknown";
          let message = `HTTP ${response.status}`;
          if (response.status === 429) {
            errorType = "rate_limit";
            message = "Monthly event limit exceeded. Upgrade your plan to continue.";
          } else if (response.status === 401) {
            errorType = "auth";
            message = "Invalid API key";
          } else if (response.status === 400) {
            errorType = "validation";
            message = "Invalid request payload";
          }
          this.handleError({
            type: errorType,
            message,
            statusCode: response.status
          });
        }
      }).catch((err) => {
        this.handleError({
          type: "network",
          message: err?.message || "Network request failed",
          originalError: err instanceof Error ? err : void 0
        });
      });
      return true;
    }
    this.handleError({
      type: "unknown",
      message: "No suitable transport available (fetch not defined)"
    });
    return false;
  }
};
_BlipLogs.globalInstance = null;
_BlipLogs.API_ENDPOINT = "https://api.bliplogs.co.uk";
/**
 * Sensitive URL parameters that should be redacted
 */
_BlipLogs.SENSITIVE_PARAMS = [
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "apikey",
  "api_key",
  "api-key",
  "key",
  "password",
  "pwd",
  "pass",
  "secret",
  "auth",
  "authorization",
  "bearer",
  "session",
  "sessionid",
  "session_id",
  "code",
  "state",
  "nonce",
  // OAuth params
  "email",
  "phone",
  "ssn",
  // PII
  "credit_card",
  "cc",
  "cvv",
  "card"
];
var BlipLogs = _BlipLogs;
var index_default = BlipLogs;
export {
  BlipLogs,
  index_default as default
};
