/**
 * File Manager - Handles file operations and transfers
 */

class FileManager {
    constructor(sessionManager, networkManager) {
        this.sessionManager = sessionManager;
        this.networkManager = networkManager;
        this.RECEIVED_FILES_KEY = 'fileTransfer_receivedFiles';
        this.receivedFiles = [];
        this.activeTransfers = new Map();
        this.transferQueue = [];
        this.maxConcurrentTransfers = 3;
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        
        this.initializeFileManager();
    }

    /**
     * Initialize file manager
     */
    initializeFileManager() {
        this.loadReceivedFiles();
        this.setupFileTransferListener();
        console.log('File manager initialized');
    }

    /**
     * Load received files from storage
     */
    loadReceivedFiles() {
        try {
            const savedFiles = localStorage.getItem(this.RECEIVED_FILES_KEY);
            if (savedFiles) {
                this.receivedFiles = JSON.parse(savedFiles);
                console.log(`Loaded ${this.receivedFiles.length} received files`);
            }
        } catch (error) {
            console.error('Failed to load received files:', error);
            this.receivedFiles = [];
        }
    }

    /**
     * Save received files to storage
     */
    saveReceivedFiles() {
        try {
            localStorage.setItem(this.RECEIVED_FILES_KEY, JSON.stringify(this.receivedFiles));
        } catch (error) {
            console.error('Failed to save received files:', error);
        }
    }

    /**
     * Setup file transfer listener (simulated)
     */
    setupFileTransferListener() {
        // Listen for incoming file transfers
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith('fileTransfer_incoming_')) {
                this.handleIncomingFileTransfer(event);
            }
        });
    }

    /**
     * Handle incoming file transfer
     */
    handleIncomingFileTransfer(event) {
        try {
            const transferData = JSON.parse(event.newValue);
            if (transferData && transferData.targetDevice === this.sessionManager.getDeviceId()) {
                this.receiveFile(transferData);
                // Clean up the transfer notification
                localStorage.removeItem(event.key);
            }
        } catch (error) {
            console.error('Failed to handle incoming file transfer:', error);
        }
    }

    /**
     * Validate files for transfer
     */
    validateFiles(files) {
        const results = [];
        
        for (const file of files) {
            const validation = Utils.validateFile(file, this.maxFileSize);
            results.push({
                file,
                validation
            });
        }
        
        return results;
    }

    /**
     * Send files to target device
     */
    async sendFiles(files, targetDeviceId) {
        if (!targetDeviceId) {
            throw new Error('Target device not specified');
        }

        if (!this.networkManager.isDeviceOnline(targetDeviceId)) {
            throw new Error('Target device is offline');
        }

        // Validate files
        const validationResults = this.validateFiles(files);
        const validFiles = validationResults.filter(result => result.validation.valid);
        
        if (validFiles.length === 0) {
            throw new Error('No valid files to transfer');
        }

        // Report any invalid files
        const invalidFiles = validationResults.filter(result => !result.validation.valid);
        if (invalidFiles.length > 0) {
            console.warn('Invalid files skipped:', invalidFiles.map(r => r.file.name));
        }

        // Start transfer process
        const transferId = Utils.generateUniqueId();
        const transfer = {
            id: transferId,
            targetDevice: targetDeviceId,
            files: validFiles.map(r => r.file),
            status: 'starting',
            progress: 0,
            startTime: Utils.getCurrentTimestamp(),
            currentFile: 0,
            totalFiles: validFiles.length
        };

        this.activeTransfers.set(transferId, transfer);

        try {
            // Process files sequentially
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i].file;
                transfer.currentFile = i + 1;
                transfer.status = 'transferring';
                
                await this.sendSingleFile(file, targetDeviceId, transferId, i + 1, validFiles.length);
                
                // Update progress
                transfer.progress = ((i + 1) / validFiles.length) * 100;
            }

            transfer.status = 'completed';
            transfer.completedAt = Utils.getCurrentTimestamp();
            
            console.log(`Transfer ${transferId} completed successfully`);
            return transfer;

        } catch (error) {
            transfer.status = 'failed';
            transfer.error = error.message;
            transfer.failedAt = Utils.getCurrentTimestamp();
            
            console.error(`Transfer ${transferId} failed:`, error);
            throw error;
        }
    }

    /**
     * Send a single file
     */
    async sendSingleFile(file, targetDeviceId, transferId, currentFile, totalFiles) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const fileData = {
                        id: Utils.generateUniqueId(),
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: e.target.result,
                        timestamp: Utils.getCurrentTimestamp(),
                        fromDevice: this.sessionManager.getDeviceId(),
                        targetDevice: targetDeviceId,
                        transferId: transferId,
                        currentFile: currentFile,
                        totalFiles: totalFiles
                    };

                    // Simulate file transfer with progress
                    await this.simulateFileTransfer(fileData, transferId);
                    
                    console.log(`File sent: ${file.name} (${Utils.formatFileSize(file.size)})`);
                    resolve();
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * Simulate file transfer with progress updates
     */
    async simulateFileTransfer(fileData, transferId) {
        return new Promise((resolve, reject) => {
            let progress = 0;
            const transfer = this.activeTransfers.get(transferId);
            
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15 + 5; // 5-20% increments
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);
                    
                    // Simulate successful transfer to target device
                    this.simulateReceiveFile(fileData);
                    resolve();
                    
                } else {
                    // Update transfer progress
                    if (transfer) {
                        transfer.fileProgress = progress;
                    }
                    
                    // Dispatch progress event
                    this.dispatchTransferProgress(transferId, fileData.name, progress);
                }
            }, Utils.getRandomDelay(100, 300));
            
            // Simulate potential transfer failure (5% chance)
            if (Math.random() < 0.05) {
                setTimeout(() => {
                    clearInterval(progressInterval);
                    reject(new Error('Transfer failed due to network error'));
                }, Utils.getRandomDelay(1000, 3000));
            }
        });
    }

    /**
     * Simulate receiving a file (for demo purposes)
     */
    simulateReceiveFile(fileData) {
        // In a real implementation, this would happen on the target device
        // For demo, we'll simulate receiving files sometimes
        if (Math.random() > 0.3) { // 70% chance to receive
            setTimeout(() => {
                // Create transfer notification
                const notificationKey = `fileTransfer_incoming_${fileData.id}`;
                localStorage.setItem(notificationKey, JSON.stringify(fileData));
                
                // Trigger storage event manually for same-page demo
                setTimeout(() => {
                    this.receiveFile(fileData);
                    localStorage.removeItem(notificationKey);
                }, 500);
            }, Utils.getRandomDelay(500, 1500));
        }
    }

    /**
     * Receive a file
     */
    receiveFile(fileData) {
        try {
            // Add to received files
            const receivedFile = {
                ...fileData,
                receivedAt: Utils.getCurrentTimestamp(),
                id: fileData.id || Utils.generateUniqueId()
            };
            
            // Check if file already exists
            const existingIndex = this.receivedFiles.findIndex(f => f.id === receivedFile.id);
            if (existingIndex >= 0) {
                console.log('File already received:', receivedFile.name);
                return;
            }
            
            this.receivedFiles.unshift(receivedFile); // Add to beginning
            
            // Limit stored files to prevent storage overflow
            if (this.receivedFiles.length > 50) {
                this.receivedFiles = this.receivedFiles.slice(0, 50);
            }
            
            this.saveReceivedFiles();
            
            console.log(`File received: ${receivedFile.name} from ${receivedFile.fromDevice}`);
            
            // Dispatch received file event
            this.dispatchFileReceived(receivedFile);
            
        } catch (error) {
            console.error('Failed to receive file:', error);
        }
    }

    /**
     * Download a received file
     */
    downloadFile(fileId) {
        const file = this.receivedFiles.find(f => f.id === fileId);
        if (!file) {
            throw new Error('File not found');
        }

        try {
            // Create download link
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`Downloaded: ${file.name}`);
            
            // Update download count
            file.downloadCount = (file.downloadCount || 0) + 1;
            file.lastDownloaded = Utils.getCurrentTimestamp();
            this.saveReceivedFiles();
            
        } catch (error) {
            console.error('Failed to download file:', error);
            throw error;
        }
    }

    /**
     * Delete a received file
     */
    deleteReceivedFile(fileId) {
        const index = this.receivedFiles.findIndex(f => f.id === fileId);
        if (index >= 0) {
            const file = this.receivedFiles[index];
            this.receivedFiles.splice(index, 1);
            this.saveReceivedFiles();
            
            console.log(`Deleted received file: ${file.name}`);
            return true;
        }
        return false;
    }

    /**
     * Get received files
     */
    getReceivedFiles() {
        return [...this.receivedFiles];
    }

    /**
     * Get active transfers
     */
    getActiveTransfers() {
        return new Map(this.activeTransfers);
    }

    /**
     * Cancel transfer
     */
    cancelTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
            transfer.status = 'cancelled';
            transfer.cancelledAt = Utils.getCurrentTimestamp();
            
            console.log(`Transfer ${transferId} cancelled`);
            return true;
        }
        return false;
    }

    /**
     * Clear completed transfers
     */
    clearCompletedTransfers() {
        const completedTransfers = [];
        
        for (const [id, transfer] of this.activeTransfers.entries()) {
            if (transfer.status === 'completed' || transfer.status === 'failed' || transfer.status === 'cancelled') {
                completedTransfers.push(id);
            }
        }
        
        completedTransfers.forEach(id => {
            this.activeTransfers.delete(id);
        });
        
        console.log(`Cleared ${completedTransfers.length} completed transfers`);
    }

    /**
     * Dispatch transfer progress event
     */
    dispatchTransferProgress(transferId, fileName, progress) {
        const event = new CustomEvent('transferProgress', {
            detail: { transferId, fileName, progress }
        });
        window.dispatchEvent(event);
    }

    /**
     * Dispatch file received event
     */
    dispatchFileReceived(file) {
        const event = new CustomEvent('fileReceived', {
            detail: { file }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get transfer statistics
     */
    getTransferStats() {
        const totalReceived = this.receivedFiles.length;
        const totalSent = Array.from(this.activeTransfers.values())
            .filter(t => t.status === 'completed').length;
        const activeTransfers = Array.from(this.activeTransfers.values())
            .filter(t => t.status === 'transferring' || t.status === 'starting').length;
        
        return {
            totalReceived,
            totalSent,
            activeTransfers,
            totalSize: this.receivedFiles.reduce((sum, file) => sum + (file.size || 0), 0)
        };
    }

    /**
     * Clear all received files
     */
    clearAllReceivedFiles() {
        this.receivedFiles = [];
        this.saveReceivedFiles();
        console.log('All received files cleared');
    }

    /**
     * Cleanup file manager
     */
    cleanup() {
        // Cancel all active transfers
        for (const [id, transfer] of this.activeTransfers.entries()) {
            if (transfer.status === 'transferring' || transfer.status === 'starting') {
                this.cancelTransfer(id);
            }
        }
        
        // Save final state
        this.saveReceivedFiles();
        
        console.log('File manager cleanup completed');
    }
}