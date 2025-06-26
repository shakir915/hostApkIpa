/**
 * IP Detection Module - Various methods to get local IP address in browsers
 */

class IPDetection {
    constructor() {
        this.detectedIPs = new Set();
        this.callbacks = [];
    }

    /**
     * Main method to get local IP - tries multiple approaches
     */
    async getLocalIP() {
        const results = await Promise.allSettled([
            this.getIPViaWebRTC(),
            this.getIPViaRTCPeerConnection(),
            this.getIPViaDataChannel(),
            this.getIPViaSTUN()
        ]);

        // Collect all successful results
        const ips = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value)
            .flat()
            .filter(ip => ip && this.isValidLocalIP(ip));

        // Remove duplicates and return the best IP
        const uniqueIPs = [...new Set(ips)];
        
        if (uniqueIPs.length > 0) {
            console.log('Detected local IPs:', uniqueIPs);
            return this.selectBestIP(uniqueIPs);
        }

        return null;
    }

    /**
     * Method 1: WebRTC with ICE candidates (most reliable)
     */
    async getIPViaWebRTC() {
        return new Promise((resolve) => {
            try {
                const rtc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                });

                const ips = [];
                let timeout;

                rtc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const candidate = event.candidate.candidate;
                        const ip = this.extractIPFromCandidate(candidate);
                        if (ip && this.isValidLocalIP(ip)) {
                            ips.push(ip);
                        }
                    }
                };

                // Create data channel to trigger ICE gathering
                rtc.createDataChannel('ip-detection');

                // Create offer to start ICE gathering
                rtc.createOffer()
                    .then(offer => rtc.setLocalDescription(offer))
                    .catch(console.error);

                // Timeout after 3 seconds
                timeout = setTimeout(() => {
                    rtc.close();
                    resolve(ips.length > 0 ? ips : null);
                }, 3000);

                // Complete when ICE gathering is done
                rtc.onicegatheringstatechange = () => {
                    if (rtc.iceGatheringState === 'complete') {
                        clearTimeout(timeout);
                        rtc.close();
                        resolve(ips.length > 0 ? ips : null);
                    }
                };

            } catch (error) {
                console.log('WebRTC IP detection failed:', error.message);
                resolve(null);
            }
        });
    }

    /**
     * Method 2: Alternative RTCPeerConnection approach
     */
    async getIPViaRTCPeerConnection() {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.services.mozilla.com' }]
                });

                const ips = [];

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const ip = this.extractIPFromCandidate(event.candidate.candidate);
                        if (ip && this.isValidLocalIP(ip)) {
                            ips.push(ip);
                        }
                    } else {
                        // ICE gathering complete
                        pc.close();
                        resolve(ips.length > 0 ? ips : null);
                    }
                };

                // Trigger ICE gathering
                pc.createDataChannel('');
                pc.createOffer().then(offer => pc.setLocalDescription(offer));

                // Fallback timeout
                setTimeout(() => {
                    pc.close();
                    resolve(ips.length > 0 ? ips : null);
                }, 2000);

            } catch (error) {
                console.log('Alternative WebRTC method failed:', error.message);
                resolve(null);
            }
        });
    }

    /**
     * Method 3: Using data channel approach
     */
    async getIPViaDataChannel() {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection();
                const ips = [];

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const ip = this.extractIPFromCandidate(event.candidate.candidate);
                        if (ip && this.isValidLocalIP(ip)) {
                            ips.push(ip);
                        }
                    }
                };

                const dataChannel = pc.createDataChannel('ip-detection', {
                    ordered: false,
                    maxRetransmits: 0
                });

                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .catch(console.error);

                setTimeout(() => {
                    pc.close();
                    resolve(ips.length > 0 ? ips : null);
                }, 1500);

            } catch (error) {
                console.log('Data channel IP detection failed:', error.message);
                resolve(null);
            }
        });
    }

    /**
     * Method 4: Multiple STUN servers
     */
    async getIPViaSTUN() {
        const stunServers = [
            'stun:stun.ekiga.net',
            'stun:stun.ideasip.com',
            'stun:stun.schlund.de',
            'stun:stun.stunprotocol.org:3478'
        ];

        const promises = stunServers.map(stun => this.getIPFromSTUN(stun));
        const results = await Promise.allSettled(promises);

        const ips = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value)
            .flat();

        return ips.length > 0 ? ips : null;
    }

    /**
     * Get IP from specific STUN server
     */
    async getIPFromSTUN(stunServer) {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: stunServer }]
                });

                const ips = [];

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const ip = this.extractIPFromCandidate(event.candidate.candidate);
                        if (ip && this.isValidLocalIP(ip)) {
                            ips.push(ip);
                        }
                    }
                };

                pc.createDataChannel('stun-test');
                pc.createOffer().then(offer => pc.setLocalDescription(offer));

                setTimeout(() => {
                    pc.close();
                    resolve(ips);
                }, 1000);

            } catch (error) {
                resolve([]);
            }
        });
    }

    /**
     * Extract IP address from ICE candidate string
     */
    extractIPFromCandidate(candidate) {
        try {
            // ICE candidate format: "candidate:... typ host ..."
            const parts = candidate.split(' ');
            
            // Look for IP address pattern
            for (const part of parts) {
                if (this.isIPAddress(part)) {
                    return part;
                }
            }
            
            // Alternative parsing for different formats
            const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (ipMatch) {
                return ipMatch[0];
            }

            // IPv6 support
            const ipv6Match = candidate.match(/([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/i);
            if (ipv6Match) {
                return ipv6Match[0];
            }

        } catch (error) {
            console.log('Failed to extract IP from candidate:', error);
        }
        
        return null;
    }

    /**
     * Check if string is a valid IP address
     */
    isIPAddress(str) {
        // IPv4 pattern
        const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        // IPv6 pattern (simplified)
        const ipv6Pattern = /^(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
        
        return ipv4Pattern.test(str) || ipv6Pattern.test(str);
    }

    /**
     * Check if IP is a local/private IP
     */
    isValidLocalIP(ip) {
        if (!ip || !this.isIPAddress(ip)) return false;

        // Skip invalid IPs
        if (ip === '0.0.0.0' || ip === '127.0.0.1') return false;

        // Check for private IP ranges
        const parts = ip.split('.').map(Number);
        
        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        
        // Link-local 169.254.0.0/16
        if (parts[0] === 169 && parts[1] === 254) return true;

        return false;
    }

    /**
     * Select the best IP from multiple detected IPs
     */
    selectBestIP(ips) {
        // Prefer 192.168.x.x (most common home networks)
        const preferred = ips.find(ip => ip.startsWith('192.168.'));
        if (preferred) return preferred;

        // Then 10.x.x.x
        const corporate = ips.find(ip => ip.startsWith('10.'));
        if (corporate) return corporate;

        // Then 172.16-31.x.x
        const enterprise = ips.find(ip => {
            const parts = ip.split('.');
            return parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31;
        });
        if (enterprise) return enterprise;

        // Return first valid IP
        return ips[0];
    }

    /**
     * Get network info including IP and estimated network range
     */
    async getNetworkInfo() {
        const localIP = await this.getLocalIP();
        
        if (!localIP) {
            return {
                ip: null,
                network: null,
                subnet: null
            };
        }

        const parts = localIP.split('.');
        const networkBase = `${parts[0]}.${parts[1]}.${parts[2]}`;
        
        return {
            ip: localIP,
            network: `${networkBase}.0/24`,
            subnet: networkBase,
            range: {
                start: `${networkBase}.1`,
                end: `${networkBase}.254`
            }
        };
    }

    /**
     * Start continuous IP monitoring
     */
    startMonitoring(callback) {
        this.callbacks.push(callback);
        
        // Check for IP changes every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            const currentIP = await this.getLocalIP();
            if (currentIP && !this.detectedIPs.has(currentIP)) {
                this.detectedIPs.add(currentIP);
                this.callbacks.forEach(cb => cb(currentIP));
            }
        }, 30000);

        // Initial detection
        this.getLocalIP().then(ip => {
            if (ip) {
                this.detectedIPs.add(ip);
                this.callbacks.forEach(cb => cb(ip));
            }
        });
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.callbacks = [];
    }

    /**
     * Test all methods and return results
     */
    async testAllMethods() {
        console.log('🔍 Testing all IP detection methods...');
        
        const results = {
            webrtc: await this.getIPViaWebRTC(),
            rtcPeer: await this.getIPViaRTCPeerConnection(),
            dataChannel: await this.getIPViaDataChannel(),
            stun: await this.getIPViaSTUN(),
            networkInfo: await this.getNetworkInfo()
        };

        console.log('IP Detection Results:', results);
        return results;
    }
}

// Export for use in other modules
window.IPDetection = IPDetection;