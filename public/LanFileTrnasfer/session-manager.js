/**
 * Session Manager - Handles persistent sessions across page refreshes
 */

class SessionManager {
    constructor() {
        this.SESSION_KEY = 'fileTransfer_session';
        this.DEVICE_KEY = 'fileTransfer_deviceId';
        this.sessionData = null;
        this.deviceId = null;
        this.isInitialized = false;
        
        this.initializeSession();
    }

    /**
     * Initialize or restore session
     */
    initializeSession() {
        try {
            // Try to restore existing session
            this.restoreSession();
            
            // If no valid session, create new one
            if (!this.isValidSession()) {
                this.createNewSession();
            }
            
            this.isInitialized = true;
            this.logSessionInfo();
            
        } catch (error) {
            console.error('Failed to initialize session:', error);
            this.createNewSession();
            this.isInitialized = true;
        }
    }

    /**
     * Create a new session
     */
    createNewSession() {
        this.deviceId = Utils.generateDeviceId();
        this.sessionData = {
            sessionId: Utils.generateSessionId(),
            deviceId: this.deviceId,
            createdAt: Utils.getCurrentTimestamp(),
            lastActivity: Utils.getCurrentTimestamp(),
            version: '1.0.0'
        };
        
        this.saveSession();
        console.log('Created new session:', this.sessionData);
    }

    /**
     * Restore session from storage
     */
    restoreSession() {
        const savedSession = localStorage.getItem(this.SESSION_KEY);
        const savedDeviceId = localStorage.getItem(this.DEVICE_KEY);
        
        if (savedSession && savedDeviceId) {
            try {
                this.sessionData = JSON.parse(savedSession);
                this.deviceId = savedDeviceId;
                
                // Update last activity
                this.sessionData.lastActivity = Utils.getCurrentTimestamp();
                this.saveSession();
                
                console.log('Restored session:', this.sessionData);
            } catch (error) {
                console.error('Failed to parse saved session:', error);
                throw error;
            }
        }
    }

    /**
     * Check if current session is valid
     */
    isValidSession() {
        if (!this.sessionData || !this.deviceId) {
            return false;
        }
        
        // Check required fields
        const requiredFields = ['sessionId', 'deviceId', 'createdAt', 'lastActivity'];
        for (const field of requiredFields) {
            if (!this.sessionData[field]) {
                return false;
            }
        }
        
        // Check if session is not too old (7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const age = Utils.getCurrentTimestamp() - this.sessionData.createdAt;
        if (age > maxAge) {
            console.log('Session expired due to age');
            return false;
        }
        
        return true;
    }

    /**
     * Save session to localStorage
     */
    saveSession() {
        try {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
            localStorage.setItem(this.DEVICE_KEY, this.deviceId);
        } catch (error) {
            console.error('Failed to save session:', error);
        }
    }

    /**
     * Update session activity
     */
    updateActivity() {
        if (this.sessionData) {
            this.sessionData.lastActivity = Utils.getCurrentTimestamp();
            this.saveSession();
        }
    }

    /**
     * Get current device ID
     */
    getDeviceId() {
        return this.deviceId;
    }

    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionData ? this.sessionData.sessionId : null;
    }

    /**
     * Get session data
     */
    getSessionData() {
        return Utils.deepClone(this.sessionData);
    }

    /**
     * Clear session
     */
    clearSession() {
        this.sessionData = null;
        this.deviceId = null;
        this.isInitialized = false;
        
        try {
            localStorage.removeItem(this.SESSION_KEY);
            localStorage.removeItem(this.DEVICE_KEY);
            console.log('Session cleared');
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
    }

    /**
     * Reset session (clear and create new)
     */
    resetSession() {
        this.clearSession();
        this.createNewSession();
        this.isInitialized = true;
        console.log('Session reset');
    }

    /**
     * Check if session manager is initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Get session age in milliseconds
     */
    getSessionAge() {
        if (!this.sessionData) return 0;
        return Utils.getCurrentTimestamp() - this.sessionData.createdAt;
    }

    /**
     * Get time since last activity
     */
    getTimeSinceLastActivity() {
        if (!this.sessionData) return 0;
        return Utils.getCurrentTimestamp() - this.sessionData.lastActivity;
    }

    /**
     * Log session information
     */
    logSessionInfo() {
        if (!this.sessionData) return;
        
        const age = this.getSessionAge();
        const lastActivity = this.getTimeSinceLastActivity();
        
        console.log('Session Info:', {
            deviceId: this.deviceId,
            sessionId: this.sessionData.sessionId,
            age: Utils.formatFileSize(age) + 'ms',
            lastActivity: Utils.formatFileSize(lastActivity) + 'ms ago',
            createdAt: new Date(this.sessionData.createdAt).toLocaleString()
        });
    }

    /**
     * Get session stats
     */
    getSessionStats() {
        if (!this.sessionData) return null;
        
        return {
            deviceId: this.deviceId,
            sessionId: this.sessionData.sessionId,
            age: this.getSessionAge(),
            lastActivity: this.getTimeSinceLastActivity(),
            createdAt: this.sessionData.createdAt,
            isValid: this.isValidSession()
        };
    }

    /**
     * Handle page visibility change
     */
    handleVisibilityChange() {
        if (!document.hidden) {
            // Page became visible, update activity
            this.updateActivity();
        }
    }

    /**
     * Start session monitoring
     */
    startMonitoring() {
        // Update activity every 30 seconds when page is active
        this.activityInterval = setInterval(() => {
            if (!document.hidden) {
                this.updateActivity();
            }
        }, 30000);

        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        // Update activity on user interactions
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, Utils.debounce(() => {
                this.updateActivity();
            }, 5000));
        });

        console.log('Session monitoring started');
    }

    /**
     * Stop session monitoring
     */
    stopMonitoring() {
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
        console.log('Session monitoring stopped');
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        this.stopMonitoring();
        this.updateActivity(); // Final activity update
    }
}