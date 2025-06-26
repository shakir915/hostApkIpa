/**
 * Main Application - Coordinates all managers and initializes the app
 */

class FileTransferApp {
    constructor() {
        this.sessionManager = null;
        this.networkManager = null;
        this.fileManager = null;
        this.uiManager = null;
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing File Transfer Application...');
            
            // Initialize managers in order
            await this.initializeManagers();
            
            // Setup global error handling
            this.setupErrorHandling();
            
            // Setup cleanup handlers
            this.setupCleanupHandlers();
            
            this.isInitialized = true;
            console.log('File Transfer Application initialized successfully');
            
            // Initial network scan
            setTimeout(() => {
                this.networkManager.scanNetwork().then(devices => {
                    this.uiManager.updateDevicesUI(devices);
                });
            }, 1000);
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize all managers
     */
    async initializeManagers() {
        // Session Manager - handles persistent sessions
        this.sessionManager = new SessionManager();
        
        // Wait for session to be ready
        while (!this.sessionManager.isReady()) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Network Manager - handles device discovery
        this.networkManager = new NetworkManager(this.sessionManager);
        
        // File Manager - handles file operations
        this.fileManager = new FileManager(this.sessionManager, this.networkManager);
        
        // UI Manager - handles user interface
        this.uiManager = new UIManager(this.sessionManager, this.networkManager, this.fileManager);
        
        // Make UI manager globally accessible for HTML onclick handlers
        window.uiManager = this.uiManager;
        
        // Start session monitoring
        this.sessionManager.startMonitoring();
        
        console.log('All managers initialized successfully');
    }

    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            this.logError('Uncaught error', event.error);
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError('Unhandled promise rejection', event.reason);
            event.preventDefault(); // Prevent default browser behavior
        });
    }

    /**
     * Setup cleanup handlers
     */
    setupCleanupHandlers() {
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden - reducing activity');
            } else {
                console.log('Page visible - resuming normal activity');
                // Refresh network state when page becomes visible
                if (this.networkManager) {
                    this.networkManager.broadcastPresence();
                }
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Connection restored');
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus(true);
                this.uiManager.log('Connection restored', 'success');
            }
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus(false);
                this.uiManager.log('Connection lost', 'warning');
            }
        });
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        // Try to show error in UI if possible
        const errorMessage = `Failed to initialize application: ${error.message}`;
        
        // Fallback to alert if UI manager not available
        if (this.uiManager) {
            this.uiManager.log(errorMessage, 'error');
            this.uiManager.showAlert(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
        
        // Try to recover by resetting session
        if (this.sessionManager) {
            console.log('Attempting to recover by resetting session...');
            this.sessionManager.resetSession();
            
            // Retry initialization after delay
            setTimeout(() => {
                location.reload();
            }, 3000);
        }
    }

    /**
     * Log error to UI
     */
    logError(type, error) {
        if (this.uiManager) {
            const message = error?.message || error?.toString() || 'Unknown error';
            this.uiManager.log(`${type}: ${message}`, 'error');
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        if (!this.isInitialized) {
            return { status: 'initializing' };
        }

        const sessionStats = this.sessionManager.getSessionStats();
        const networkStats = this.networkManager.getNetworkStats();
        const transferStats = this.fileManager.getTransferStats();
        const uiStats = this.uiManager.getUIStats();

        return {
            status: 'running',
            initialized: this.isInitialized,
            session: sessionStats,
            network: networkStats,
            transfers: transferStats,
            ui: uiStats,
            timestamp: Utils.getCurrentTimestamp()
        };
    }

    /**
     * Get application version and info
     */
    getAppInfo() {
        return {
            name: 'Local File Transfer',
            version: '1.0.0',
            description: 'Share files instantly across your local network',
            features: [
                'Automatic device discovery',
                'Drag & drop file transfer',
                'Real-time progress tracking',
                'Cross-platform compatibility',
                'No installation required'
            ],
            deviceId: this.sessionManager?.getDeviceId() || 'Unknown',
            sessionId: this.sessionManager?.getSessionId() || 'Unknown'
        };
    }

    /**
     * Manual network refresh
     */
    async refreshNetwork() {
        if (this.networkManager && this.uiManager) {
            try {
                this.uiManager.log('Refreshing network...', 'info');
                const devices = await this.networkManager.refreshNetwork();
                this.uiManager.updateDevicesUI(devices);
                this.uiManager.log(`Network refreshed. Found ${devices.size} devices`, 'success');
                return devices;
            } catch (error) {
                this.uiManager.log(`Network refresh failed: ${error.message}`, 'error');
                throw error;
            }
        }
    }

    /**
     * Clear all application data
     */
    clearAllData() {
        if (confirm('Are you sure you want to clear all application data? This will remove all received files and reset the session.')) {
            try {
                // Clear received files
                this.fileManager.clearAllReceivedFiles();
                
                // Reset session
                this.sessionManager.resetSession();
                
                // Clear selected device
                if (this.uiManager) {
                    this.uiManager.selectedDevice = null;
                    document.getElementById('selectedDevice').style.display = 'none';
                    this.uiManager.updateDropZoneState(false);
                }
                
                // Refresh UI
                this.uiManager.updateReceivedFilesUI();
                this.uiManager.log('All application data cleared', 'success');
                this.uiManager.showAlert('All data cleared successfully', 'success');
                
                // Refresh page after delay
                setTimeout(() => {
                    location.reload();
                }, 2000);
                
            } catch (error) {
                console.error('Failed to clear data:', error);
                if (this.uiManager) {
                    this.uiManager.log(`Failed to clear data: ${error.message}`, 'error');
                    this.uiManager.showAlert('Failed to clear data', 'error');
                }
            }
        }
    }

    /**
     * Export application logs
     */
    exportLogs() {
        try {
            const appInfo = this.getAppInfo();
            const status = this.getStatus();
            const logs = this.uiManager.logEntries;
            
            const exportData = {
                appInfo,
                status,
                logs,
                exportedAt: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `file-transfer-logs-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            if (this.uiManager) {
                this.uiManager.log('Logs exported successfully', 'success');
            }
            
        } catch (error) {
            console.error('Failed to export logs:', error);
            if (this.uiManager) {
                this.uiManager.log(`Failed to export logs: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Cleanup application
     */
    cleanup() {
        console.log('Cleaning up application...');
        
        try {
            // Cleanup managers in reverse order
            if (this.uiManager) {
                this.uiManager.cleanup();
            }
            
            if (this.fileManager) {
                this.fileManager.cleanup();
            }
            
            if (this.networkManager) {
                this.networkManager.cleanup();
            }
            
            if (this.sessionManager) {
                this.sessionManager.cleanup();
            }
            
            console.log('Application cleanup completed');
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Check if application is ready
     */
    isReady() {
        return this.isInitialized && 
               this.sessionManager?.isReady() &&
               this.networkManager &&
               this.fileManager &&
               this.uiManager;
    }

    /**
     * Get application metrics for debugging
     */
    getMetrics() {
        if (!this.isReady()) {
            return { ready: false };
        }

        return {
            ready: true,
            uptime: this.sessionManager.getSessionAge(),
            devices: this.networkManager.getDeviceCount(),
            transfers: this.fileManager.getTransferStats(),
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    window.fileTransferApp = new FileTransferApp();
});

// Expose app for debugging in browser console
window.getAppStatus = () => window.fileTransferApp?.getStatus();
window.getAppInfo = () => window.fileTransferApp?.getAppInfo();
window.getAppMetrics = () => window.fileTransferApp?.getMetrics();
window.refreshNetwork = () => window.fileTransferApp?.refreshNetwork();
window.clearAllData = () => window.fileTransferApp?.clearAllData();
window.exportLogs = () => window.fileTransferApp?.exportLogs();