class UndergroundEscapeGame {
    constructor(mode, options = {}) {
        this.mode = mode; // 'singleplayer' lub 'multiplayer'
        this.options = options;
        this.networkManager = null;
        this.players = new Map();
        this.localPlayerId = null;
        
        // Inicjalizacja canvas i kontekstów (kod z oryginalnej gry)
        this.setupCanvas();
        this.setupGame();
        
        if (mode === 'multiplayer') {
            this.initMultiplayer();
        } else {
            this.initSingleplayer();
        }
    }
    
    async initMultiplayer() {
        // Pokaż elementy UI multiplayer
        document.getElementById('multiplayerInfo').style.display = 'block';
        document.getElementById('playerList').style.display = 'block';
        document.getElementById('chatContainer').style.display = 'block';
        document.getElementById('connectionStatus').style.display = 'block';
        
        // Ustaw kod pokoju
        document.getElementById('roomCode').textContent = this.options.roomCode;
        
        // Inicjalizuj networking
        this.networkManager = new NetworkManager();
        
        try {
            const peerId = await this.networkManager.initialize(
                this.options.roomCode,
                this.options.isHost,
                this.options.playerName,
                this.options.playerRole
            );
            
            this.localPlayerId = peerId;
            this.setupNetworkHandlers();
            
            // Inicjalizuj lokalnego gracza
            if (this.options.playerRole === 'killer') {
                this.initKillerPlayer();
            } else {
                this.initSurvivorPlayer();
            }
            
        } catch (error) {
            console.error('Failed to initialize multiplayer:', error);
            this.showConnectionError();
        }
    }
    
    initSingleplayer() {
        // Kod dla trybu singleplayer (używa oryginalnego AI)
        this.initSurvivorPlayer();
        this.initAIKiller();
    }
    
    setupNetworkHandlers() {
        this.networkManager.on('playerJoined', (player) => {
            this.addPlayer(player);
            this.updatePlayerList();
            this.addChatMessage(`${player.name} dołączył do gry`, 'system');
        });
        
        this.networkManager.on('playerDisconnected', (playerId) => {
            const player = this.players.get(playerId);
            if (player) {
                this.addChatMessage(`${player.name} opuścił grę`, 'system');
                this.players.delete(playerId);
                this.updatePlayerList();
            }
        });
        
        this.networkManager.on('playerUpdate', (playerData) => {
            this.updatePlayer(playerData);
        });
        
        this.networkManager.on('gameEvent', (event) => {
            this.handleGameEvent(event);
        });
        
        // Chat
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = e.target.value.trim();
                if (message) {
                    this.sendChatMessage(message);
                    e.target.value = '';
                }
            }
        });
    }
    
    addPlayer(playerData) {
        this.players.set(playerData.id, {
            ...playerData,
            sprite: this.createPlayerSprite(playerData.role)
        });
        document.getElementById('playerCount').textContent = 
            `${this.players.size + 1}/5`;
    }
    
    updatePlayer(playerData) {
        const player = this.players.get(playerData.id);
        if (player) {
            Object.assign(player, playerData);
        }
    }
    
    updatePlayerList() {
        const content = document.getElementById('playerListContent');
        content.innerHTML = '';
        
        // Dodaj lokalnego gracza
        const localDiv = document.createElement('div');
        localDiv.className = 'player-item';
        localDiv.innerHTML = `
            <strong>${this.options.playerName}</strong> (Ty)
            <span style="float: right;">${this.options.playerRole === 'killer' ? '🔪' : '🏃'}</span>
        `;
        content.appendChild(localDiv);
        
        // Dodaj innych graczy
        this.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                ${player.name}
                <span style="float: right;">${player.role === 'killer' ? '🔪' : '🏃'}</span>
            `;
            content.appendChild(playerDiv);
        });
    }
    
    sendChatMessage(message) {
        this.addChatMessage(`${this.options.playerName}: ${message}`, 'player');
        this.networkManager.sendGameEvent('chat', {
            sender: this.options.playerName,
            message: message
        });
    }
    
    addChatMessage(text, type = 'player') {
        const messages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.style.color = type === 'system' ? '#888' : '#fff';
        messageDiv.textContent = text;
        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
    }
    
    handleGameEvent(event) {
        switch(event.type) {
            case 'chat':
                this.addChatMessage(`${event.data.sender}: ${event.data.message}`);
                break;
            case 'generatorFixed':
                this.onGeneratorFixed(event.data);
                break;
            case 'playerCaught':
                this.onPlayerCaught(event.data);
                break;
            // Dodaj więcej eventów...
        }
    }
    
    // Ulepszone AI dla trybu singleplayer
    updateAIKiller() {
        if (this.mode !== 'singleplayer') return;
        
        // Rozszerzone AI z oryginalnego kodu
        // Dodaj:
        // - Przewidywanie ruchów gracza
        // - Pamiętanie ostatnich pozycji
        // - Strategie pułapek
        // - Adaptacyjna trudność
        
        const killer = this.killer;
        const player = this.player;
        
        // System przewidywania
        if (killer.lastPlayerPositions) {
            killer.lastPlayerPositions.push({ x: player.x, y: player.y, time: Date.now() });
            if (killer.lastPlayerPositions.length > 10) {
                killer.lastPlayerPositions.shift();
            }
            
            // Oblicz kierunek ruchu gracza
            if (killer.lastPlayerPositions.length >= 2) {
                const recent = killer.lastPlayerPositions[killer.lastPlayerPositions.length - 1];
                const previous = killer.lastPlayerPositions[killer.lastPlayerPositions.length - 2];
                
                const velocityX = (recent.x - previous.x) / (recent.time - previous.time);
                const velocityY = (recent.y - previous.y) / (recent.time - previous.time);
                
                // Przewidź pozycję gracza
                const predictTime = 1000; // 1 sekunda w przód
                killer.predictedPlayerPos = {
                    x: player.x + velocityX * predictTime,
                    y: player.y + velocityY * predictTime
                };
            }
        } else {
            killer.lastPlayerPositions = [];
        }
        
        // Użyj oryginalnej logiki AI z dodatkowymi ulepszeniami...
    }
    
    gameLoop() {
        // Główna pętla gry
        this.update();
        this.render();
        
        // W trybie multiplayer, synchronizuj stan
        if (this.mode === 'multiplayer' && this.networkManager) {
            this.syncNetworkState();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    syncNetworkState() {
        // Wyślij pozycję lokalnego gracza
        const localPlayer = this.options.playerRole === 'killer' ? this.killer : this.player;
        
        this.networkManager.updateLocalPlayer({
            x: localPlayer.x,
            y: localPlayer.y,
            health: localPlayer.health,
            state: localPlayer.state || 'alive'
        });
    }
}

// Uruchom grę po załadowaniu
window.UndergroundEscapeGame = UndergroundEscapeGame;