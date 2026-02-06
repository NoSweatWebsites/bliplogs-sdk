"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BlipLogs: () => BlipLogs,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var _BlipLogs = class _BlipLogs {
  constructor(config) {
    this.bandwidthBuffer = [];
    this.bandwidthObserver = null;
    this.bandwidthIntervalId = null;
    if (!config.projectId) {
      throw new Error("BlipLogs: projectId is required");
    }
    const isBrowser = typeof window !== "undefined";
    if (!isBrowser && !config.apiKey) {
      throw new Error("BlipLogs: apiKey is required for server-side usage");
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
    const bandwidthEnabled = config.trackBandwidth === true || typeof config.trackBandwidth === "object" && config.trackBandwidth.enabled !== false;
    this.bandwidthConfig = {
      enabled: bandwidthEnabled,
      batchInterval: typeof config.trackBandwidth === "object" ? config.trackBandwidth.batchInterval ?? 3e4 : 3e4,
      resourceTypes: typeof config.trackBandwidth === "object" ? config.trackBandwidth.resourceTypes ?? [] : [],
      maxBatchSize: typeof config.trackBandwidth === "object" ? config.trackBandwidth.maxBatchSize ?? 100 : 100,
      sanitizeUrls: typeof config.trackBandwidth === "object" ? config.trackBandwidth.sanitizeUrls ?? true : true
    };
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
   * Parse user agent string into structured information
   */
  parseUserAgent(ua) {
    const result = {
      browser: "Unknown",
      browserVersion: "",
      os: "Unknown",
      isBot: false,
      deviceType: "unknown",
      raw: ua
    };
    if (!ua) return result;
    for (const { pattern, name } of _BlipLogs.BOT_PATTERNS) {
      if (pattern.test(ua)) {
        result.isBot = true;
        result.botName = name;
        result.browser = name;
        return result;
      }
    }
    if (/edg/i.test(ua)) {
      result.browser = "Edge";
      const match = ua.match(/edg[e]?\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    } else if (/opr|opera/i.test(ua)) {
      result.browser = "Opera";
      const match = ua.match(/(?:opr|opera)[\/\s](\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    } else if (/chrome|chromium|crios/i.test(ua)) {
      result.browser = "Chrome";
      const match = ua.match(/(?:chrome|chromium|crios)\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    } else if (/firefox|fxios/i.test(ua)) {
      result.browser = "Firefox";
      const match = ua.match(/(?:firefox|fxios)\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      result.browser = "Safari";
      const match = ua.match(/version\/(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    } else if (/msie|trident/i.test(ua)) {
      result.browser = "Internet Explorer";
      const match = ua.match(/(?:msie |rv:)(\d+[\d.]*)/i);
      result.browserVersion = match?.[1] || "";
    }
    if (/windows/i.test(ua)) {
      result.os = "Windows";
      if (/windows nt 10/i.test(ua)) result.os = "Windows 10/11";
      else if (/windows nt 6.3/i.test(ua)) result.os = "Windows 8.1";
      else if (/windows nt 6.2/i.test(ua)) result.os = "Windows 8";
      else if (/windows nt 6.1/i.test(ua)) result.os = "Windows 7";
    } else if (/macintosh|mac os x/i.test(ua)) {
      result.os = "macOS";
    } else if (/iphone/i.test(ua)) {
      result.os = "iOS";
    } else if (/ipad/i.test(ua)) {
      result.os = "iPadOS";
    } else if (/android/i.test(ua)) {
      result.os = "Android";
    } else if (/linux/i.test(ua)) {
      result.os = "Linux";
    } else if (/cros/i.test(ua)) {
      result.os = "Chrome OS";
    }
    if (/mobile|iphone|ipod|android.*mobile|webos|blackberry|opera mini|opera mobi|iemobile/i.test(ua)) {
      result.deviceType = "mobile";
    } else if (/tablet|ipad|android(?!.*mobile)|kindle|silk/i.test(ua)) {
      result.deviceType = "tablet";
    } else if (/windows|macintosh|linux|cros/i.test(ua)) {
      result.deviceType = "desktop";
    }
    return result;
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
    const payloadWithAuth = {
      ...payload,
      project_id: this.projectId,
      ...this.apiKey && { api_key: this.apiKey }
    };
    const body = JSON.stringify(payloadWithAuth);
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
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }
      fetch(_BlipLogs.API_ENDPOINT, {
        method: "POST",
        headers,
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
  // ============================================
  // Bandwidth Tracking Methods
  // ============================================
  /**
   * Initialize bandwidth tracking with PerformanceObserver
   */
  initBandwidthTracking() {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
      if (this.debug) {
        console.warn("BlipLogs: Bandwidth tracking requires browser environment with PerformanceObserver");
      }
      return;
    }
    try {
      this.bandwidthObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "resource") {
            this.recordResourceTiming(entry);
          }
        }
      });
      this.bandwidthObserver.observe({ type: "resource", buffered: true });
      this.bandwidthIntervalId = setInterval(() => {
        this.flushBandwidthBatch();
      }, this.bandwidthConfig.batchInterval);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") {
            this.flushBandwidthBatch();
          }
        });
      }
      if (this.debug) {
        console.log("BlipLogs: Bandwidth tracking initialized");
      }
    } catch (error) {
      if (this.debug) {
        console.error("BlipLogs: Failed to initialize bandwidth tracking:", error);
      }
    }
  }
  /**
   * Record a single resource timing entry
   */
  recordResourceTiming(entry) {
    const initiatorType = entry.initiatorType || "other";
    if (this.bandwidthConfig.resourceTypes.length > 0 && !this.bandwidthConfig.resourceTypes.includes(initiatorType)) {
      return;
    }
    const url = this.bandwidthConfig.sanitizeUrls ? this.sanitizeResourceUrl(entry.name) : entry.name;
    const resourceEntry = {
      url,
      resourceType: initiatorType,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0,
      duration: entry.duration || 0,
      startTime: entry.startTime || 0
    };
    this.bandwidthBuffer.push(resourceEntry);
    if (this.bandwidthBuffer.length >= this.bandwidthConfig.maxBatchSize) {
      this.flushBandwidthBatch();
    }
  }
  /**
   * Sanitize resource URL - removes sensitive params and query strings
   */
  sanitizeResourceUrl(url) {
    const sanitized = this.sanitizeUrl(url);
    if (!sanitized) return "[UNKNOWN]";
    try {
      const urlObj = new URL(sanitized);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return sanitized;
    }
  }
  /**
   * Flush accumulated bandwidth data to API
   */
  flushBandwidthBatch() {
    if (this.bandwidthBuffer.length === 0) return;
    const resources = this.bandwidthBuffer.splice(0, this.bandwidthConfig.maxBatchSize);
    const totalTransferSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
    const rawUserAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const parsedUserAgent = this.privacy.collectUserAgent && rawUserAgent ? this.parseUserAgent(rawUserAgent) : void 0;
    const payload = {
      resources,
      session_id: this.privacy.collectSessionId ? this.getSessionId() : void 0,
      timestamp_ms: Date.now(),
      project_id: this.projectId,
      ...this.apiKey && { api_key: this.apiKey },
      context: this.getContext(),
      totalTransferSize,
      resourceCount: resources.length,
      userAgent: parsedUserAgent
    };
    this.sendBandwidth(payload);
  }
  /**
   * Send bandwidth data using sendBeacon with fetch fallback
   */
  sendBandwidth(payload) {
    const endpoint = `${_BlipLogs.API_ENDPOINT}/bandwidth`;
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        const sent = navigator.sendBeacon(endpoint, blob);
        if (sent) return true;
      } catch {
      }
    }
    if (typeof fetch !== "undefined") {
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }
      fetch(endpoint, {
        method: "POST",
        headers,
        body,
        keepalive: true,
        credentials: "omit"
      }).catch((err) => {
        this.handleError({
          type: "network",
          message: err?.message || "Bandwidth tracking request failed",
          originalError: err instanceof Error ? err : void 0
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
  stopBandwidthTracking() {
    if (this.bandwidthObserver) {
      this.bandwidthObserver.disconnect();
      this.bandwidthObserver = null;
    }
    if (this.bandwidthIntervalId) {
      clearInterval(this.bandwidthIntervalId);
      this.bandwidthIntervalId = null;
    }
    this.flushBandwidthBatch();
    if (this.debug) {
      console.log("BlipLogs: Bandwidth tracking stopped");
    }
  }
  /**
   * Stop bandwidth tracking on the global instance
   */
  static stopBandwidthTracking() {
    _BlipLogs.getInstance().stopBandwidthTracking();
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
/**
 * Known bot patterns for detection
 */
_BlipLogs.BOT_PATTERNS = [
  { pattern: /googlebot/i, name: "Googlebot" },
  { pattern: /bingbot/i, name: "Bingbot" },
  { pattern: /slurp/i, name: "Yahoo Slurp" },
  { pattern: /duckduckbot/i, name: "DuckDuckBot" },
  { pattern: /baiduspider/i, name: "Baiduspider" },
  { pattern: /yandexbot/i, name: "YandexBot" },
  { pattern: /facebot|facebookexternalhit/i, name: "Facebook Bot" },
  { pattern: /twitterbot/i, name: "Twitter Bot" },
  { pattern: /linkedinbot/i, name: "LinkedIn Bot" },
  { pattern: /slackbot/i, name: "Slackbot" },
  { pattern: /telegrambot/i, name: "Telegram Bot" },
  { pattern: /discordbot/i, name: "Discord Bot" },
  { pattern: /whatsapp/i, name: "WhatsApp" },
  { pattern: /applebot/i, name: "Applebot" },
  { pattern: /semrushbot/i, name: "SEMrush Bot" },
  { pattern: /ahrefsbot/i, name: "Ahrefs Bot" },
  { pattern: /mj12bot/i, name: "Majestic Bot" },
  { pattern: /dotbot/i, name: "DotBot" },
  { pattern: /petalbot/i, name: "PetalBot" },
  { pattern: /bytespider/i, name: "ByteSpider" },
  { pattern: /gptbot/i, name: "GPTBot" },
  { pattern: /claudebot/i, name: "ClaudeBot" },
  { pattern: /headless/i, name: "Headless Browser" },
  { pattern: /phantomjs/i, name: "PhantomJS" },
  { pattern: /lighthouse/i, name: "Lighthouse" },
  { pattern: /pagespeed/i, name: "PageSpeed Insights" },
  { pattern: /crawl|spider|bot|scrape/i, name: "Generic Bot" }
];
var BlipLogs = _BlipLogs;
var index_default = BlipLogs;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BlipLogs
});
