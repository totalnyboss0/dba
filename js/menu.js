// Menu główne i animacje tła
class MenuBackground {
    constructor() {
        this.canvas = document.getElementById('backgroundCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.resize();
        this.init();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    init() {
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: Math.random() * 0.5 + 0.1,
                opacity: Math.random() * 0.5 + 0.2
            });
        }
        this.animate();
    }
    
    animate() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.y += particle.speedY;
            particle.x += particle.speedX;
            
            if (particle.y > this.canvas.height) {
                particle.y = 0;
                particle.x = Math.random() * this.canvas.width;
            }
            
            if (particle.x < 0 || particle.x > this.canvas.width) {
                particle.speedX = -particle.speedX;
            }
            
            this.ctx.fillStyle = `rgba(255, 0, 0, ${particle.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// Inicjalizacja tła
const menuBg = new MenuBackground();

// Stan aplikacji
const appState = {
    currentMenu: 'main',
    playerName: localStorage.getItem('playerName') || 'Gracz',
    selectedRole: 'survivor',
    gameMode: null,
    serverCode: null
};

// Zapisywanie nazwy gracza
document.getElementById('playerName').value = appState.playerName;
document.getElementById('playerName').addEventListener('input', (e) => {
    appState.playerName = e.target.value;
    localStorage.setItem('playerName', appState.playerName);
});

// Funkcje menu
function showMainMenu() {
    document.getElementById('mainMenu').style.display = 'block';
    document.getElementById('multiplayerMenu').style.display = 'none';
    appState.currentMenu = 'main';
}

function showMultiplayerOptions() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('multiplayerMenu').style.display = 'block';
    document.getElementById('multiplayerMenu').classList.add('multiplayer-options');
    appState.currentMenu = 'multiplayer';
}

function selectRole(role) {
    appState.selectedRole = role;
    document.querySelectorAll('.role-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.getElementById(role + 'Role').classList.add('selected');
}

function startSingleplayer() {
    showLoading();
    appState.gameMode = 'singleplayer';
    setTimeout(() => {
        window.location.href = 'game.html?mode=singleplayer';
    }, 1000);
}

function createServer() {
    if (!appState.selectedRole) {
        alert('Wybierz rolę przed utworzeniem serwera!');
        return;
    }
    
    showLoading();
    appState.gameMode = 'multiplayer-host';
    
    // Generowanie kodu serwera
    const serverCode = generateServerCode();
    appState.serverCode = serverCode;
    
    setTimeout(() => {
        window.location.href = `game.html?mode=multiplayer&host=true&role=${appState.selectedRole}&code=${serverCode}&name=${encodeURIComponent(appState.playerName)}`;
    }, 1000);
}

function joinServer(serverCode) {
    if (!appState.selectedRole) {
        alert('Wybierz rolę przed dołączeniem!');
        return;
    }
    
    showLoading();
    appState.gameMode = 'multiplayer-join';
    appState.serverCode = serverCode;
    
    setTimeout(() => {
        window.location.href = `game.html?mode=multiplayer&host=false&role=${appState.selectedRole}&code=${serverCode}&name=${encodeURIComponent(appState.playerName)}`;
    }, 1000);
}

function showServerList() {
    const serverList = document.getElementById('serverList');
    const serverListContent = document.getElementById('serverListContent');
    
    serverList.style.display = 'block';
    
    // Symulacja listy serwerów (w prawdziwej grze pobierałoby to z serwera)
    const servers = [
        { name: 'Serwer #1', code: 'ABC123', players: '3/4', ping: 25 },
        { name: 'Serwer #2', code: 'XYZ789', players: '1/4', ping: 40 },
        { name: 'Serwer #3', code: 'QWE456', players: '2/4', ping: 15 }
    ];
    
    serverListContent.innerHTML = '';
    
    if (servers.length === 0) {
        serverListContent.innerHTML = '<div style="text-align: center; color: #666;">Brak dostępnych serwerów</div>';
    } else {
        servers.forEach(server => {
            const serverItem = document.createElement('div');
            serverItem.className = 'server-item';
            serverItem.innerHTML = `
                <div>
                    <strong>${server.name}</strong>
                    <span style="color: #666; margin-left: 10px;">Kod: ${server.code}</span>
                </div>
                <div>
                    <span class="server-players">${server.players}</span>
                    <span style="color: ${server.ping < 30 ? '#0f0' : server.ping < 60 ? '#ff0' : '#f00'}; margin-left: 10px;">${server.ping}ms</span>
                </div>
            `;
            serverItem.onclick = () => joinServer(server.code);
            serverListContent.appendChild(serverItem);
        });
    }
}

function showTutorial() {
    alert('Samouczek:\n\n' +
          'UCIEKINIER:\n' +
          '• WASD - Poruszanie się\n' +
          '• SHIFT - Sprint\n' +
          '• E - Naprawianie generatora\n' +
          '• Napraw 5 generatorów i ucieknij!\n\n' +
          'ZABÓJCA:\n' +
          '• WASD - Poruszanie się\n' +
          '• Złap wszystkich uciekinierów\n' +
          '• Patrol generatory\n' +
          '• Śledź ślady uciekinierów');
}

function showStatistics() {
    const stats = JSON.parse(localStorage.getItem('gameStats') || '{}');
    alert('Twoje statystyki:\n\n' +
          `Rozegrane gry: ${stats.gamesPlayed || 0}\n` +
          `Wygrane jako uciekinier: ${stats.survivorWins || 0}\n` +
          `Wygrane jako zabójca: ${stats.killerWins || 0}\n` +
          `Naprawione generatory: ${stats.generatorsFixed || 0}\n` +
          `Złapani uciekinierzy: ${stats.survivorsCaught || 0}`);
}

function toggleSettings() {
    alert('Ustawienia (w budowie):\n\n' +
          '• Głośność dźwięku\n' +
          '• Jakość grafiki\n' +
          '• Sterowanie\n' +
          '• Język');
}

function generateServerCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// Domyślnie wybrana rola uciekiniera
selectRole('survivor');