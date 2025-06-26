/**
 * Network Manager - Handles device discovery and network communication
 */

class NetworkManager {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.NETWORK_KEY = 'fileTransfer_network';
        this.discoveredDevices = new Map();
        this.isScanning = false;
        this.broadcastInterval = null;
        this.cleanupInterval = null;
        this.ipDetection = new IPDetection();
        this.localIP = null;
        this.networkInfo = null;
        
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.initializeNetwork();
    }

    /**
     * Initialize network management
     */
    async initializeNetwork() {
        // Detect local IP
        await this.detectLocalIP();
        
        this.startBroadcasting();
        this.startCleanupTimer();
        this.setupStorageListener();
        console.log('Network manager initialized');
    }

    /**
     * Detect local IP address
     */
    async detectLocalIP() {
        try {
            console.log('🔍 Detecting local IP address...');
            this.networkInfo = await this.ipDetection.getNetworkInfo();
            this.localIP = this.networkInfo.ip;
            
            if (this.localIP) {
                console.log(`✅ Local IP detected: ${this.localIP}`);
                console.log(`📡 Network range: ${this.networkInfo.network}`);
            } else {
                console.log('❌ Could not detect local IP');
            }
        } catch (error) {
            console.error('Failed to detect IP:', error);
        }
    }

    /**
     * Start broadcasting device presence
     */
    startBroadcasting() {
        // Initial broadcast
        this.broadcastPresence();
        
        // Broadcast every 10 seconds
        this.broadcastInterval = setInterval(() => {
            this.broadcastPresence();
        }, 10000);
        
        console.log('Started broadcasting device presence');
    }

    /**
     * Broadcast device presence to network
     */
    broadcastPresence() {
        if (!this.sessionManager.isReady()) {
            return;
        }

        const deviceData = {
            deviceId: this.sessionManager.getDeviceId(),
            sessionId: this.sessionManager.getSessionId(),
            lastSeen: Utils.getCurrentTimestamp(),
            status: 'online',
            capabilities: ['fileTransfer', 'p2p'],
            version: '1.0.0',
            userAgent: navigator.userAgent,
            timestamp: Utils.getCurrentTimestamp(),
            ip: this.getLocalIP(),
            platform: this.getPlatformInfo()
        };

        try {
            // Get current network state
            const networkData = this.getNetworkData();
            
            // Update with current device data
            networkData[deviceData.deviceId] = deviceData;
            
            // Save updated network state
            this.saveNetworkData(networkData);
            
            // Also try alternative discovery methods
            this.broadcastToAlternativeChannels(deviceData);
            
            // Update session activity
            this.sessionManager.updateActivity();
            
        } catch (error) {
            console.error('Failed to broadcast presence:', error);
        }
    }

    /**
     * Get platform information
     */
    getPlatformInfo() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
        if (/Android/.test(ua)) return 'Android';
        if (/Mac/.test(ua)) return 'macOS';
        if (/Windows/.test(ua)) return 'Windows';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Unknown';
    }

    /**
     * Get local IP (placeholder - browsers restrict this)
     */
    getLocalIP() {
        return this.localIP || 'detecting...';
    }

    /**
     * Get network information
     */
    getNetworkInfo() {
        return this.networkInfo;
    }

    /**
     * Get devices on same network (by IP range)
     */
    getDevicesOnSameNetwork() {
        if (!this.networkInfo || !this.networkInfo.subnet) {
            return this.discoveredDevices;
        }

        const sameNetworkDevices = new Map();
        
        for (const [deviceId, device] of this.discoveredDevices) {
            // If device has IP and it's on same subnet, prioritize it
            if (device.ip && device.ip.startsWith(this.networkInfo.subnet)) {
                sameNetworkDevices.set(deviceId, {
                    ...device,
                    priority: 'high',
                    sameNetwork: true
                });
            } else {
                sameNetworkDevices.set(deviceId, {
                    ...device,
                    priority: 'normal',
                    sameNetwork: false
                });
            }
        }

        return sameNetworkDevices;
    }

    /**
     * Alternative discovery using BroadcastChannel API
     */
    broadcastToAlternativeChannels(deviceData) {
        try {
            // Use BroadcastChannel for same-origin communication
            if (window.BroadcastChannel) {
                if (!this.broadcastChannel) {
                    this.broadcastChannel = new BroadcastChannel('fileTransfer_discovery');
                    this.setupBroadcastListener();
                }
                this.broadcastChannel.postMessage({
                    type: 'device_presence',
                    device: deviceData
                });
            }

            // Use SharedWorker if available (more advanced)
            this.trySharedWorkerDiscovery(deviceData);
            
            // Use IndexedDB for cross-tab persistence
            this.saveToIndexedDB(deviceData);
            
        } catch (error) {
            console.log('Alternative discovery methods not available:', error.message);
        }
    }

    /**
     * Setup BroadcastChannel listener
     */
    setupBroadcastListener() {
        this.broadcastChannel.addEventListener('message', (event) => {
            if (event.data.type === 'device_presence') {
                const deviceData = event.data.device;
                
                // Don't add own device
                if (deviceData.deviceId === this.sessionManager.getDeviceId()) {
                    return;
                }
                
                // Add to discovered devices
                console.log('Discovered device via BroadcastChannel:', deviceData.deviceId);
                this.discoveredDevices.set(deviceData.deviceId, deviceData);
                
                // Also save to localStorage for persistence
                const networkData = this.getNetworkData();
                networkData[deviceData.deviceId] = deviceData;
                this.saveNetworkData(networkData);
                
                // Trigger UI update
                if (window.uiManager) {
                    window.uiManager.updateDevicesUI(this.discoveredDevices);
                }
            }
        });
    }

    /**
     * Try SharedWorker for discovery (advanced browsers)
     */
    trySharedWorkerDiscovery(deviceData) {
        // Placeholder for SharedWorker implementation
        // This would allow discovery across different browsers
        console.log('SharedWorker discovery: Not implemented yet');
    }

    /**
     * Save to IndexedDB for better persistence
     */
    async saveToIndexedDB(deviceData) {
        try {
            // Simple IndexedDB implementation
            const request = indexedDB.open('FileTransferDB', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('devices')) {
                    db.createObjectStore('devices', { keyPath: 'deviceId' });
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['devices'], 'readwrite');
                const store = transaction.objectStore('devices');
                store.put(deviceData);
            };
            
        } catch (error) {
            console.log('IndexedDB not available:', error.message);
        }
    }

    /**
     * Get network data from storage
     */
    getNetworkData() {
        try {
            const data = localStorage.getItem(this.NETWORK_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get network data:', error);
            return {};
        }
    }

    /**
     * Save network data to storage
     */
    saveNetworkData(data) {
        try {
            localStorage.setItem(this.NETWORK_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save network data:', error);
        }
    }

    /**
     * Scan network for available devices
     */
    async scanNetwork() {
        if (this.isScanning) {
            console.log('Scan already in progress');
            return this.discoveredDevices;
        }

        this.isScanning = true;
        console.log('Starting network scan...');

        try {
            // Simulate scan delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Get current network data
            const networkData = this.getNetworkData();
            const currentTime = Utils.getCurrentTimestamp();
            const activeDevices = new Map();
            
            // Filter active devices (exclude self and inactive devices)
            Object.entries(networkData).forEach(([deviceId, deviceData]) => {
                // Skip own device
                if (deviceId === this.sessionManager.getDeviceId()) {
                    return;
                }
                
                // Check if device is active (last seen within 60 seconds)
                if (Utils.isDeviceActive(deviceData.lastSeen, 60000)) {
                    activeDevices.set(deviceId, deviceData);
                }
            });
            
            this.discoveredDevices = activeDevices;
            console.log(`Network scan completed. Found ${activeDevices.size} active devices`);
            
            return this.discoveredDevices;
            
        } catch (error) {
            console.error('Network scan failed:', error);
            return new Map();
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Get discovered devices
     */
    getDiscoveredDevices() {
        return new Map(this.discoveredDevices);
    }

    /**
     * Check if device is online
     */
    isDeviceOnline(deviceId) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device) return false;
        
        return Utils.isDeviceActive(device.lastSeen, 60000);
    }

    /**
     * Get device information
     */
    getDeviceInfo(deviceId) {
        return this.discoveredDevices.get(deviceId) || null;
    }

    /**
     * Start cleanup timer to remove stale devices
     */
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleDevices();
        }, 30000); // Cleanup every 30 seconds
    }

    /**
     * Remove stale devices from network
     */
    cleanupStaleDevices() {
        try {
            const networkData = this.getNetworkData();
            const currentTime = Utils.getCurrentTimestamp();
            let cleanedCount = 0;
            
            // Remove devices not seen for more than 2 minutes
            Object.keys(networkData).forEach(deviceId => {
                const deviceData = networkData[deviceId];
                if (!Utils.isDeviceActive(deviceData.lastSeen, 120000)) {
                    delete networkData[deviceId];
                    this.discoveredDevices.delete(deviceId);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                this.saveNetworkData(networkData);
                console.log(`Cleaned up ${cleanedCount} stale devices`);
            }
            
        } catch (error) {
            console.error('Failed to cleanup stale devices:', error);
        }
    }

    /**
     * Setup storage event listener for real-time updates
     */
    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === this.NETWORK_KEY) {
                // Network data changed, update discovered devices
                this.updateDiscoveredDevicesFromStorage();
            }
        });
    }

    /**
     * Update discovered devices from storage changes
     */
    updateDiscoveredDevicesFromStorage() {
        try {
            const networkData = this.getNetworkData();
            const activeDevices = new Map();
            
            Object.entries(networkData).forEach(([deviceId, deviceData]) => {
                // Skip own device
                if (deviceId === this.sessionManager.getDeviceId()) {
                    return;
                }
                
                // Check if device is active
                if (Utils.isDeviceActive(deviceData.lastSeen, 60000)) {
                    activeDevices.set(deviceId, deviceData);
                }
            });
            
            this.discoveredDevices = activeDevices;
            
        } catch (error) {
            console.error('Failed to update devices from storage:', error);
        }
    }

    /**
     * Send message to device (placeholder for WebRTC implementation)
     */
    async sendMessage(targetDeviceId, message) {
        console.log(`Sending message to ${targetDeviceId}:`, message);
        
        // For now, simulate message sending
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (this.isDeviceOnline(targetDeviceId)) {
                    resolve({ success: true, timestamp: Utils.getCurrentTimestamp() });
                } else {
                    reject(new Error('Target device is offline'));
                }
            }, Utils.getRandomDelay(100, 500));
        });
    }

    /**
     * Establish WebRTC connection (placeholder)
     */
    async establishConnection(targetDeviceId) {
        console.log(`Establishing connection to ${targetDeviceId}`);
        
        // Placeholder for WebRTC peer connection setup
        // In a real implementation, this would:
        // 1. Create RTCPeerConnection
        // 2. Exchange SDP offers/answers
        // 3. Handle ICE candidates
        // 4. Setup data channels
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (this.isDeviceOnline(targetDeviceId)) {
                    const mockConnection = {
                        id: Utils.generateUniqueId(),
                        targetDevice: targetDeviceId,
                        status: 'connected',
                        createdAt: Utils.getCurrentTimestamp()
                    };
                    resolve(mockConnection);
                } else {
                    reject(new Error('Failed to establish connection'));
                }
            }, Utils.getRandomDelay(1000, 3000));
        });
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        const networkData = this.getNetworkData();
        const totalDevices = Object.keys(networkData).length;
        const activeDevices = this.discoveredDevices.size;
        const ownDevice = networkData[this.sessionManager.getDeviceId()];
        
        return {
            totalDevices,
            activeDevices,
            discoveredDevices: Array.from(this.discoveredDevices.keys()),
            ownDeviceLastSeen: ownDevice ? ownDevice.lastSeen : null,
            isScanning: this.isScanning
        };
    }

    /**
     * Stop all network operations
     */
    cleanup() {
        // Stop broadcasting
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        
        // Stop cleanup timer
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Mark device as offline
        try {
            const networkData = this.getNetworkData();
            const deviceId = this.sessionManager.getDeviceId();
            if (networkData[deviceId]) {
                networkData[deviceId].status = 'offline';
                networkData[deviceId].lastSeen = Utils.getCurrentTimestamp();
                this.saveNetworkData(networkData);
            }
        } catch (error) {
            console.error('Failed to mark device offline:', error);
        }
        
        console.log('Network manager cleanup completed');
    }

    /**
     * Force refresh network state
     */
    refreshNetwork() {
        this.broadcastPresence();
        return this.scanNetwork();
    }

    /**
     * Get device count
     */
    getDeviceCount() {
        return this.discoveredDevices.size;
    }

    /**
     * Check if scanning is in progress
     */
    isScanningInProgress() {
        return this.isScanning;
    }
}