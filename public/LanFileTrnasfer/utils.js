/**
 * Utility functions for the File Transfer application
 */

class Utils {
    /**
     * Generate a unique device ID
     */
    static generateDeviceId() {
        const adjectives = ['Swift', 'Bright', 'Quick', 'Smart', 'Cool', 'Fast', 'Sharp', 'Bold'];
        const nouns = ['Falcon', 'Tiger', 'Eagle', 'Shark', 'Wolf', 'Bear', 'Lion', 'Fox'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${adj}${noun}${num}`;
    }

    /**
     * Generate a unique session ID
     */
    static generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get current timestamp
     */
    static getCurrentTimestamp() {
        return Date.now();
    }

    /**
     * Format timestamp to readable string
     */
    static formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    /**
     * Check if device is active (last seen within threshold)
     */
    static isDeviceActive(lastSeen, thresholdMs = 30000) {
        return (Date.now() - lastSeen) < thresholdMs;
    }

    /**
     * Generate random delay for simulation
     */
    static getRandomDelay(min = 100, max = 500) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Debounce function to limit function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Deep clone object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Generate unique ID
     */
    static generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Check if two objects are equal
     */
    static isEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }

    /**
     * Get file extension from filename
     */
    static getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Get file icon based on file type
     */
    static getFileIcon(filename) {
        const ext = this.getFileExtension(filename);
        const iconMap = {
            // Images
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'svg': '🖼️',
            // Documents
            'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄', 'rtf': '📄',
            // Spreadsheets
            'xlsx': '📊', 'xls': '📊', 'csv': '📊',
            // Presentations
            'ppt': '📊', 'pptx': '📊',
            // Archives
            'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
            // Audio
            'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'ogg': '🎵',
            // Video
            'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', 'wmv': '🎬',
            // Code
            'js': '⚡', 'html': '🌐', 'css': '🎨', 'json': '📋', 'xml': '📋',
            'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'php': '🔧'
        };
        
        return iconMap[ext] || '📄';
    }

    /**
     * Validate file for transfer
     */
    static validateFile(file, maxSize = 100 * 1024 * 1024) { // 100MB default
        const errors = [];
        
        if (!file) {
            errors.push('No file provided');
            return { valid: false, errors };
        }
        
        if (file.size > maxSize) {
            errors.push(`File size exceeds limit (${this.formatFileSize(maxSize)})`);
        }
        
        if (file.size === 0) {
            errors.push('File is empty');
        }
        
        // Check for potentially dangerous file types
        const dangerousExtensions = ['exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js'];
        const ext = this.getFileExtension(file.name);
        if (dangerousExtensions.includes(ext)) {
            errors.push('File type not allowed for security reasons');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Log message with timestamp
     */
    static logWithTimestamp(message, level = 'info') {
        const timestamp = this.formatTimestamp(Date.now());
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        console.log(logMessage);
        return logMessage;
    }

    /**
     * Create promise with timeout
     */
    static withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
            )
        ]);
    }

    /**
     * Retry function with exponential backoff
     */
    static async retry(fn, maxAttempts = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt === maxAttempts) break;
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
}