// Networking dla trybu multiplayer używając PeerJS (P2P)
class NetworkManager {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.isHost = false;
        this.roomCode = null;
        this.playerData = new Map();
        this.callbacks = new Map();
        this.localPlayer = null;
    }
    
    initialize(roomCode, isHost, playerName, role) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode;
            this.isHost = isHost;
            this.localPlayer = {
                id: null,
                name: playerName,
                role: role,
                x: 0,
                y: 0,
                health: 100,
                state: 'alive'
            };
            
            const peerId = isHost ? roomCode : roomCode + '_' + Math.random().toString(36).substr(2, 9);
            
            // Inicjalizacja PeerJS
            this.peer = new Peer(peerId, {
                host: 'peerjs.com',
                port: 443,
                secure: true,
                config: {
                    'iceServers': [
                        { url: 'stun:stun.l.google.com:19302' },
                        { url: 'turn:numb.viagenie.ca', credential: 'muazkh', username: 'webrtc@live.com' }
                    ]
                }
            });
            
            this.peer.on('open', (id) => {
                console.log('Connected to PeerJS with ID:', id);
                this.localPlayer.id = id;
                
                if (!isHost) {
                    // Dołącz do hosta
                    this.connectToHost(roomCode);
                }
                
                resolve(id);
            });
            
            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                reject(err);
            });
        });
    }
    
    connectToHost(hostId) {
        const conn = this.peer.connect(hostId, {
            reliable: true,
            serialization: 'json'
        });
        
        conn.on('open', () => {
            console.log('Connected to host');
            this.connections.set('host', conn);
            this.sendToHost('join', this.localPlayer);
        });
        
        this.setupConnectionHandlers(conn, 'host');
    }
    
    handleNewConnection(conn) {
        const playerId = conn.peer;
        
        conn.on('open', () => {
            console.log('New player connected:', playerId);
            this.connections.set(playerId, conn);
            
            if (this.isHost) {
                // Wyślij stan gry do nowego gracza
                this.sendToPlayer(playerId, 'gameState', {
                    players: Array.from(this.playerData.values()),
                    gameData: this.getGameState()
                });
            }
        });
        
        this.setupConnectionHandlers(conn, playerId);
    }
    
    setupConnectionHandlers(conn, playerId) {
        conn.on('data', (data) => {
            this.handleMessage(playerId, data);
        });
        
        conn.on('close', () => {
            console.log('Player disconnected:', playerId);
            this.connections.delete(playerId);
            this.playerData.delete(playerId);
            this.trigger('playerDisconnected', playerId);
        });
        
        conn.on('error', (err) => {
            console.error('Connection error with', playerId, ':', err);
        });
    }
    
    handleMessage(senderId, message) {
        const { type, data } = message;
        
        switch(type) {
            case 'join':
                if (this.isHost) {
                    this.playerData.set(senderId, data);
                    this.broadcast('playerJoined', data);
                    this.trigger('playerJoined', data);
                }
                break;
                
            case 'playerUpdate':
                this.playerData.set(senderId, data);
                if (this.isHost) {
                    this.broadcast('playerUpdate', data, senderId);
                }
                this.trigger('playerUpdate', data);
                break;
                
            case 'gameState':
                if (!this.isHost) {
                    this.trigger('gameStateUpdate', data);
                }
                break;
                
            case 'gameEvent':
                if (this.isHost) {
                    this.broadcast('gameEvent', data, senderId);
                }
                this.trigger('gameEvent', data);
                break;
                
            default:
                if (this.callbacks.has(type)) {
                    this.callbacks.get(type)(data);
                }
        }
    }
    
    sendToHost(type, data) {
        const conn = this.connections.get('host');
        if (conn && conn.open) {
            conn.send({ type, data });
        }
    }
    
    sendToPlayer(playerId, type, data) {
        const conn = this.connections.get(playerId);
        if (conn && conn.open) {
            conn.send({ type, data });
        }
    }
    
    broadcast(type, data, excludeId = null) {
        this.connections.forEach((conn, playerId) => {
            if (playerId !== excludeId && conn.open) {
                conn.send({ type, data });
            }
        });
    }
    
    updateLocalPlayer(playerData) {
        Object.assign(this.localPlayer, playerData);
        
        if (this.isHost) {
            this.broadcast('playerUpdate', this.localPlayer);
        } else {
            this.sendToHost('playerUpdate', this.localPlayer);
        }
    }
    
    sendGameEvent(eventType, eventData) {
        const event = { type: eventType, data: eventData, timestamp: Date.now() };
        
        if (this.isHost) {
            this.broadcast('gameEvent', event);
            this.trigger('gameEvent', event);
        } else {
            this.sendToHost('gameEvent', event);
        }
    }
    
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }
    
    trigger(event, data) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).forEach(callback => callback(data));
        }
    }
    
    getGameState() {
        // Zwróć aktualny stan gry (do implementacji w głównym pliku gry)
        return {
            generators: [],
            players: Array.from(this.playerData.values()),
            gameTime: 0
        };
    }
    
    disconnect() {
        this.connections.forEach(conn => conn.close());
        if (this.peer) {
            this.peer.destroy();
        }
    }
}

// Eksportuj dla użycia w głównym pliku gry
window.NetworkManager = NetworkManager;