/**
 * UI Manager - Handles all user interface interactions and updates
 */

class UIManager {
    constructor(sessionManager, networkManager, fileManager) {
        this.sessionManager = sessionManager;
        this.networkManager = networkManager;
        this.fileManager = fileManager;
        this.selectedDevice = null;
        this.logEntries = [];
        this.maxLogEntries = 100;
        
        this.initializeUI();
    }

    /**
     * Initialize UI components and event listeners
     */
    initializeUI() {
        this.setupInitialUI();
        this.setupEventListeners();
        this.setupCustomEventListeners();
        this.startUIUpdates();
        console.log('UI manager initialized');
    }

    /**
     * Setup initial UI state
     */
    setupInitialUI() {
        // Set device ID
        const deviceId = this.sessionManager.getDeviceId();
        document.getElementById('deviceId').textContent = deviceId;
        document.getElementById('shareableDeviceId').textContent = deviceId;
        
        // Set initial status
        this.updateConnectionStatus(true);
        
        // Initialize log
        this.log('Application started successfully');
        this.log(`Device ID: ${deviceId}`);
        this.log('Share your Device ID with other devices to connect');
        
        // Load received files
        this.updateReceivedFilesUI();
        
        // Disable drop zone initially
        this.updateDropZoneState(false);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Scan button
        const scanBtn = document.getElementById('scanBtn');
        scanBtn.addEventListener('click', () => this.handleScanNetwork());

        // Add device button
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        addDeviceBtn.addEventListener('click', () => this.handleAddDevice());

        // File input and drop zone
        this.setupFileDropZone();
        
        // Window events
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
    }

    /**
     * Setup file drop zone
     */
    setupFileDropZone() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        // Click to select files
        dropZone.addEventListener('click', (e) => {
            if (!this.selectedDevice) {
                this.showAlert('Please select a target device first!', 'warning');
                return;
            }
            fileInput.click();
        });

        // Drag and drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.selectedDevice) {
                dropZone.classList.add('dragover');
            }
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            if (!this.selectedDevice) {
                this.showAlert('Please select a target device first!', 'warning');
                return;
            }
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileSelection(files);
            e.target.value = ''; // Reset input
        });
    }

    /**
     * Setup custom event listeners
     */
    setupCustomEventListeners() {
        // Transfer progress
        window.addEventListener('transferProgress', (e) => {
            this.updateTransferProgress(e.detail);
        });

        // File received
        window.addEventListener('fileReceived', (e) => {
            this.handleFileReceived(e.detail.file);
        });
    }

    /**
     * Handle manual device addition
     */
    handleAddDevice() {
        const deviceId = prompt(`Enter the Device ID from another device:\n\nYour Device ID (share this): ${this.sessionManager.getDeviceId()}`);
        
        if (!deviceId) return;
        
        if (deviceId === this.sessionManager.getDeviceId()) {
            this.showAlert('Cannot add your own device!', 'warning');
            return;
        }
        
        // Create mock device data
        const deviceData = {
            deviceId: deviceId,
            sessionId: `manual_${Date.now()}`,
            lastSeen: Utils.getCurrentTimestamp(),
            status: 'online',
            capabilities: ['fileTransfer', 'p2p'],
            version: '1.0.0',
            userAgent: 'Manually Added Device',
            timestamp: Utils.getCurrentTimestamp(),
            platform: 'Unknown',
            isManuallyAdded: true
        };
        
        // Add to network manager
        this.networkManager.discoveredDevices.set(deviceId, deviceData);
        
        // Save to storage
        const networkData = this.networkManager.getNetworkData();
        networkData[deviceId] = deviceData;
        this.networkManager.saveNetworkData(networkData);
        
        // Update UI
        this.updateDevicesUI(this.networkManager.discoveredDevices);
        
        this.log(`Manually added device: ${deviceId}`);
        this.showAlert(`Added device: ${deviceId}`, 'success');
    }
     
    async handleScanNetwork() {
        if (this.networkManager.isScanningInProgress()) {
            return;
        }

        const scanBtn = document.getElementById('scanBtn');
        const originalText = scanBtn.innerHTML;
        
        // Update button state
        scanBtn.innerHTML = '<span>Scanning...</span>';
        scanBtn.disabled = true;

        this.log('Scanning network for devices...');

        try {
            const devices = await this.networkManager.scanNetwork();
            this.updateDevicesUI(devices);
            
            const count = devices.size;
            this.log(`Network scan completed. Found ${count} device(s)`);
            
        } catch (error) {
            this.log(`Network scan failed: ${error.message}`, 'error');
            this.showAlert('Network scan failed. Please try again.', 'error');
        } finally {
            // Restore button state
            scanBtn.innerHTML = originalText;
            scanBtn.disabled = false;
        }
    }

    /**
     * Update devices UI
     */
    updateDevicesUI(devices) {
        const devicesGrid = document.getElementById('devicesGrid');
        
        if (devices.size === 0) {
            devicesGrid.innerHTML = `
                <div style="text-align: center; color: #6c757d; grid-column: 1/-1; padding: 40px;">
                    No devices found. Make sure other devices are running this app on the same network.
                </div>
            `;
            return;
        }

        devicesGrid.innerHTML = '';
        
        devices.forEach((device, deviceId) => {
            const deviceCard = this.createDeviceCard(device, deviceId);
            devicesGrid.appendChild(deviceCard);
        });
    }

    /**
     * Create device card element
     */
    createDeviceCard(device, deviceId) {
        const deviceCard = document.createElement('div');
        deviceCard.className = 'device-card';
        deviceCard.dataset.deviceId = deviceId;
        
        const isSelected = this.selectedDevice === deviceId;
        if (isSelected) {
            deviceCard.classList.add('selected');
        }
        
        const lastSeenTime = Utils.formatTimestamp(device.lastSeen);
        const deviceInfo = device.userAgent ? this.parseUserAgent(device.userAgent) : 'Unknown device';
        
        deviceCard.innerHTML = `
            <div class="device-name">📱 ${deviceId}</div>
            <div class="device-info">
                ${deviceInfo}<br>
                Last seen: ${lastSeenTime}<br>
                Status: <span style="color: #28a745; font-weight: bold;">Online</span>
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn" onclick="window.uiManager.selectDevice('${deviceId}')">
                    ${isSelected ? 'Selected' : 'Select Device'}
                </button>
            </div>
        `;
        
        return deviceCard;
    }

    /**
     * Parse user agent for device info
     */
    parseUserAgent(userAgent) {
        if (!userAgent) return 'Unknown device';
        
        // Simple user agent parsing
        if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
            if (userAgent.includes('Android')) return 'Android Device';
            if (userAgent.includes('iPhone')) return 'iPhone';
            if (userAgent.includes('iPad')) return 'iPad';
            return 'Mobile Device';
        } else if (userAgent.includes('Windows')) {
            return 'Windows PC';
        } else if (userAgent.includes('Mac')) {
            return 'Mac';
        } else if (userAgent.includes('Linux')) {
            return 'Linux PC';
        }
        
        return 'Desktop/Laptop';
    }

    /**
     * Select a device
     */
    selectDevice(deviceId) {
        // Check if device is still online
        if (!this.networkManager.isDeviceOnline(deviceId)) {
            this.showAlert('Selected device is no longer online. Please scan again.', 'warning');
            return;
        }

        this.selectedDevice = deviceId;
        
        // Update UI
        document.getElementById('selectedDevice').style.display = 'block';
        document.getElementById('targetDeviceName').textContent = deviceId;
        
        // Update device cards
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
            const btn = card.querySelector('.btn');
            btn.textContent = 'Select Device';
        });
        
        const selectedCard = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            const btn = selectedCard.querySelector('.btn');
            btn.textContent = 'Selected';
        }
        
        // Enable drop zone
        this.updateDropZoneState(true);
        
        this.log(`Selected device: ${deviceId}`);
    }

    /**
     * Update drop zone state
     */
    updateDropZoneState(enabled) {
        const dropZone = document.getElementById('dropZone');
        
        if (enabled) {
            dropZone.classList.remove('disabled');
            dropZone.querySelector('h3').textContent = 'Drop files here or click to select';
            dropZone.querySelector('p').textContent = 'Files will be sent to the selected device';
        } else {
            dropZone.classList.add('disabled');
            dropZone.querySelector('h3').textContent = 'Drop files here or click to select';
            dropZone.querySelector('p').textContent = 'Select a device first, then choose files to transfer';
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelection(files) {
        if (!files || files.length === 0) return;
        
        if (!this.selectedDevice) {
            this.showAlert('Please select a target device first!', 'warning');
            return;
        }

        // Validate files
        const validationResults = this.fileManager.validateFiles(files);
        const invalidFiles = validationResults.filter(r => !r.validation.valid);
        
        if (invalidFiles.length > 0) {
            const errors = invalidFiles.map(r => `${r.file.name}: ${r.validation.errors.join(', ')}`);
            this.showAlert(`Some files are invalid:\n${errors.join('\n')}`, 'warning');
        }

        const validFiles = validationResults.filter(r => r.validation.valid).map(r => r.file);
        
        if (validFiles.length === 0) {
            this.showAlert('No valid files to transfer!', 'error');
            return;
        }

        this.log(`Starting transfer of ${validFiles.length} file(s) to ${this.selectedDevice}`);
        
        try {
            // Show progress
            this.showProgress(true);
            
            // Start file transfer
            const transfer = await this.fileManager.sendFiles(validFiles, this.selectedDevice);
            
            this.log(`Transfer completed successfully (${validFiles.length} files)`);
            this.showAlert(`Successfully sent ${validFiles.length} file(s)!`, 'success');
            
        } catch (error) {
            this.log(`Transfer failed: ${error.message}`, 'error');
            this.showAlert(`Transfer failed: ${error.message}`, 'error');
        } finally {
            // Hide progress after delay
            setTimeout(() => this.showProgress(false), 2000);
        }
    }

    /**
     * Update transfer progress
     */
    updateTransferProgress(detail) {
        const { transferId, fileName, progress } = detail;
        
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Sending ${fileName}... ${Math.round(progress)}%`;
    }

    /**
     * Show/hide progress bar
     */
    showProgress(show) {
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (show) {
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            progressText.textContent = 'Preparing transfer...';
        } else {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
        }
    }

    /**
     * Handle file received
     */
    handleFileReceived(file) {
        this.updateReceivedFilesUI();
        this.log(`Received file: ${file.name} from ${file.fromDevice}`);
        this.showAlert(`Received: ${file.name}`, 'success');
    }

    /**
     * Update received files UI
     */
    updateReceivedFilesUI() {
        const receivedFilesContainer = document.getElementById('receivedFiles');
        const receivedFiles = this.fileManager.getReceivedFiles();
        
        if (receivedFiles.length === 0) {
            receivedFilesContainer.innerHTML = `
                <div style="text-align: center; color: #6c757d; padding: 20px;">
                    No files received yet.
                </div>
            `;
            return;
        }

        receivedFilesContainer.innerHTML = '';
        
        receivedFiles.forEach((file, index) => {
            const fileItem = this.createFileItem(file, index);
            receivedFilesContainer.appendChild(fileItem);
        });
    }

    /**
     * Create file item element
     */
    createFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileIcon = Utils.getFileIcon(file.name);
        const fileSize = Utils.formatFileSize(file.size);
        const receivedTime = new Date(file.receivedAt).toLocaleString();
        
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">${fileIcon}</div>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">
                        ${fileSize} • From: ${file.fromDevice} • ${receivedTime}
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="download-btn" onclick="window.uiManager.downloadFile('${file.id}')">
                    Download
                </button>
                <button class="download-btn" style="background: #dc3545;" onclick="window.uiManager.deleteFile('${file.id}')">
                    Delete
                </button>
            </div>
        `;
        
        return fileItem;
    }

    /**
     * Download file
     */
    downloadFile(fileId) {
        try {
            this.fileManager.downloadFile(fileId);
            this.log(`Downloaded file`);
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            this.showAlert(`Download failed: ${error.message}`, 'error');
        }
    }

    /**
     * Delete file
     */
    deleteFile(fileId) {
        if (confirm('Are you sure you want to delete this file?')) {
            try {
                this.fileManager.deleteReceivedFile(fileId);
                this.updateReceivedFilesUI();
                this.log(`File deleted`);
            } catch (error) {
                this.log(`Delete failed: ${error.message}`, 'error');
                this.showAlert(`Delete failed: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(online) {
        const statusElement = document.getElementById('connectionStatus');
        
        if (online) {
            statusElement.textContent = 'Online';
            statusElement.className = 'status online';
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status offline';
        }
    }

    /**
     * Log message to activity log
     */
    log(message, level = 'info') {
        const logContainer = document.getElementById('activityLog');
        const timestamp = Utils.formatTimestamp(Utils.getCurrentTimestamp());
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const levelIcon = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        }[level] || 'ℹ️';
        
        logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${levelIcon} ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only recent entries
        this.logEntries.push({ timestamp: Date.now(), message, level });
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(-this.maxLogEntries);
            
            // Remove old DOM entries
            const entries = logContainer.querySelectorAll('.log-entry');
            if (entries.length > this.maxLogEntries) {
                for (let i = 0; i < entries.length - this.maxLogEntries; i++) {
                    entries[i].remove();
                }
            }
        }
    }

    /**
     * Show alert message
     */
    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        const colors = {
            'success': '#28a745',
            'warning': '#ffc107',
            'error': '#dc3545',
            'info': '#17a2b8'
        };
        alert.style.backgroundColor = colors[type] || colors.info;
        
        alert.textContent = message;
        
        // Add to page
        document.body.appendChild(alert);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.parentNode.removeChild(alert);
                    }
                }, 300);
            }
        }, 3000);
    }

    /**
     * Start periodic UI updates
     */
    startUIUpdates() {
        // Update UI every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updatePeriodicUI();
        }, 5000);

        // Update network info when available
        this.checkNetworkInfo();
    }

    /**
     * Check and update network information
     */
    async checkNetworkInfo() {
        // Wait for network manager to detect IP
        setTimeout(async () => {
            const networkInfo = this.networkManager.getNetworkInfo();
            if (networkInfo && networkInfo.ip) {
                document.getElementById('localIP').textContent = networkInfo.ip;
                this.log(`Local IP detected: ${networkInfo.ip}`);
                this.log(`Network range: ${networkInfo.network}`);
            } else {
                document.getElementById('localIP').textContent = 'Unable to detect';
            }
        }, 3000);
    }

    /**
     * Periodic UI updates
     */
    updatePeriodicUI() {
        // Update device list if devices are shown
        const devicesGrid = document.getElementById('devicesGrid');
        if (devicesGrid.children.length > 0 && !devicesGrid.querySelector('.empty-message')) {
            const devices = this.networkManager.getDiscoveredDevices();
            if (devices.size > 0) {
                this.updateDevicesUI(devices);
            }
        }
        
        // Check if selected device is still online
        if (this.selectedDevice && !this.networkManager.isDeviceOnline(this.selectedDevice)) {
            this.log(`Selected device ${this.selectedDevice} went offline`, 'warning');
            this.selectedDevice = null;
            document.getElementById('selectedDevice').style.display = 'none';
            this.updateDropZoneState(false);
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload() {
        this.log('Application closing...');
    }

    /**
     * Get UI statistics
     */
    getUIStats() {
        return {
            selectedDevice: this.selectedDevice,
            logEntries: this.logEntries.length,
            discoveredDevices: this.networkManager.getDeviceCount(),
            receivedFiles: this.fileManager.getReceivedFiles().length
        };
    }

    /**
     * Cleanup UI manager
     */
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.log('UI manager cleanup completed');
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);