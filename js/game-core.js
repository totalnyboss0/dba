class UndergroundEscapeGame {
    constructor(mode, options = {}) {
        this.mode = mode;
        this.options = options;
        this.networkManager = null;
        this.players = new Map();
        this.localPlayerId = null;
        
        // Canvas setup
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.lightCanvas = document.getElementById('lightCanvas');
        this.lightCtx = this.lightCanvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        this.canvas.width = 1000;
        this.canvas.height = 700;
        this.lightCanvas.width = this.canvas.width;
        this.lightCanvas.height = this.canvas.height;
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 150;
        
        // Tekstury
        this.textures = {
            concrete: null,
            asphalt: null,
            metal: null,
            rust: null,
            loaded: 0,
            total: 4
        };
        
        // Stan gry
        this.game = {
            state: 'playing',
            generatorsFixed: 0,
            totalGenerators: 5,
            camera: { x: 0, y: 0 },
            mouseX: 0,
            mouseY: 0,
            particles: [],
            bloodParticles: [],
            time: 0
        };
        
        // Gracz
        this.player = {
            x: 150,
            y: 150,
            radius: 15,
            speed: 2.5,
            runSpeed: 4,
            health: 100,
            maxHealth: 100,
            stamina: 100,
            maxStamina: 100,
            isRunning: false,
            angle: 0,
            handOffset: 0,
            injured: false,
            injuryTimer: 0
        };
        
        // Zabójca
        this.killer = {
            x: 800,
            y: 500,
            radius: 18,
            speed: 2.3,
            viewDistance: 180,
            viewAngle: Math.PI / 3,
            angle: 0,
            state: 'patrol',
            patrolPoints: [],
            currentPatrolIndex: 0,
            targetPoint: null,
            chasingPlayer: false,
            lastSeen: null,
            searchTimer: 0,
            attackCooldown: 0,
            handOffset: 0,
            alertLevel: 0,
            stuckTimer: 0,
            lastPosition: { x: 800, y: 500 },
            pathfindingTimer: 0,
            avoidanceAngle: 0,
            lastPlayerPositions: []
        };
        
        // Mapa
        this.map = {
            width: 1600,
            height: 1200,
            walls: [],
            generators: [],
            cars: [],
            pillars: [],
            lights: [],
            exitGate: { x: 1550, y: 600, width: 40, height: 80, isOpen: false },
            parkingLines: [],
            walkableAreas: []
        };
        
        // Input
        this.keys = {};
        this.mouseAngle = 0;
        
        // Kontrola gracza/zabójcy
        this.isControllingKiller = false;
        
        // Initialize
        this.setupEventListeners();
        this.createTextures();
        this.generateMap();
        
        if (mode === 'multiplayer') {
            this.initMultiplayer();
        } else {
            this.initSingleplayer();
        }
        
        // Start game loop
        this.gameLoop();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.game.mouseX = e.clientX - rect.left;
            this.game.mouseY = e.clientY - rect.top;
            
            const entity = this.isControllingKiller ? this.killer : this.player;
            const dx = (this.game.mouseX + this.game.camera.x) - entity.x;
            const dy = (this.game.mouseY + this.game.camera.y) - entity.y;
            this.mouseAngle = Math.atan2(dy, dx);
        });
    }
    
    createTextures() {
        // Tekstura betonu
        const concreteCanvas = document.createElement('canvas');
        concreteCanvas.width = 256;
        concreteCanvas.height = 256;
        const concreteCtx = concreteCanvas.getContext('2d');
        
        const concreteGrad = concreteCtx.createLinearGradient(0, 0, 256, 256);
        concreteGrad.addColorStop(0, '#3a3a3a');
        concreteGrad.addColorStop(0.5, '#2f2f2f');
        concreteGrad.addColorStop(1, '#353535');
        concreteCtx.fillStyle = concreteGrad;
        concreteCtx.fillRect(0, 0, 256, 256);
        
        for(let i = 0; i < 5000; i++) {
            concreteCtx.fillStyle = `rgba(${Math.random()*50}, ${Math.random()*50}, ${Math.random()*50}, 0.1)`;
            concreteCtx.fillRect(Math.random()*256, Math.random()*256, 2, 2);
        }
        
        concreteCtx.strokeStyle = 'rgba(0,0,0,0.3)';
        concreteCtx.lineWidth = 0.5;
        for(let i = 0; i < 10; i++) {
            concreteCtx.beginPath();
            concreteCtx.moveTo(Math.random()*256, Math.random()*256);
            concreteCtx.lineTo(Math.random()*256, Math.random()*256);
            concreteCtx.stroke();
        }
        
        this.textures.concrete = concreteCanvas;
        
        // Tekstura asfaltu
        const asphaltCanvas = document.createElement('canvas');
        asphaltCanvas.width = 256;
        asphaltCanvas.height = 256;
        const asphaltCtx = asphaltCanvas.getContext('2d');
        
        asphaltCtx.fillStyle = '#1a1a1a';
        asphaltCtx.fillRect(0, 0, 256, 256);
        
        for(let i = 0; i < 10000; i++) {
            const brightness = Math.random() * 30;
            asphaltCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.2)`;
            asphaltCtx.fillRect(Math.random()*256, Math.random()*256, 1, 1);
        }
        
        for(let i = 0; i < 5; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const rad = asphaltCtx.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 30);
            rad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
            rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            asphaltCtx.fillStyle = rad;
            asphaltCtx.fillRect(x - 50, y - 50, 100, 100);
        }
        
        this.textures.asphalt = asphaltCanvas;
        
        // Metal texture
        const metalCanvas = document.createElement('canvas');
        metalCanvas.width = 128;
        metalCanvas.height = 128;
        const metalCtx = metalCanvas.getContext('2d');
        
        const metalGrad = metalCtx.createLinearGradient(0, 0, 128, 0);
        metalGrad.addColorStop(0, '#4a4a4a');
        metalGrad.addColorStop(0.5, '#5a5a5a');
        metalGrad.addColorStop(1, '#4a4a4a');
        metalCtx.fillStyle = metalGrad;
        metalCtx.fillRect(0, 0, 128, 128);
        
        this.textures.metal = metalCanvas;
        
        // Rust texture
        const rustCanvas = document.createElement('canvas');
        rustCanvas.width = 128;
        rustCanvas.height = 128;
        const rustCtx = rustCanvas.getContext('2d');
        
        rustCtx.fillStyle = '#8B4513';
        rustCtx.fillRect(0, 0, 128, 128);
        
        for(let i = 0; i < 1000; i++) {
            rustCtx.fillStyle = `rgba(${139 + Math.random()*50}, ${69 + Math.random()*30}, 19, 0.3)`;
            rustCtx.fillRect(Math.random()*128, Math.random()*128, Math.random()*5, Math.random()*5);
        }
        
        this.textures.rust = rustCanvas;
        
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 100);
        }
    }
    
    generateMap() {
        // Ściany zewnętrzne
        this.map.walls = [
            { x: 0, y: 0, width: this.map.width, height: 30 },
            { x: 0, y: this.map.height - 30, width: this.map.width, height: 30 },
            { x: 0, y: 0, width: 30, height: this.map.height },
            { x: this.map.width - 30, y: 0, width: 30, height: this.map.height }
        ];
        
        // Filary
        for (let x = 250; x < this.map.width - 200; x += 300) {
            for (let y = 250; y < this.map.height - 200; y += 250) {
                this.map.pillars.push({
                    x: x + (Math.random() - 0.5) * 20,
                    y: y + (Math.random() - 0.5) * 20,
                    radius: 25
                });
            }
        }
        
        // Samochody
        const carSpots = [
            { x: 350, y: 200, angle: 0 },
            { x: 550, y: 200, angle: 0 },
            { x: 750, y: 200, angle: 0.1 },
            { x: 350, y: 450, angle: 0 },
            { x: 650, y: 450, angle: -0.05 },
            { x: 950, y: 450, angle: 0.05 },
            { x: 350, y: 700, angle: 0 },
            { x: 550, y: 700, angle: 0 },
            { x: 850, y: 700, angle: -0.1 },
            { x: 1150, y: 700, angle: 0 },
            { x: 450, y: 950, angle: 0 },
            { x: 750, y: 950, angle: 0.05 },
            { x: 1050, y: 950, angle: 0 }
        ];
        
        carSpots.forEach(spot => {
            if (Math.random() > 0.2) {
                this.map.cars.push({
                    x: spot.x,
                    y: spot.y,
                    width: 90,
                    height: 160,
                    angle: spot.angle,
                    color: `hsl(${Math.random()*360}, 20%, ${25 + Math.random()*15}%)`
                });
            }
        });
        
        // Linie parkingowe
        for (let x = 300; x < this.map.width - 200; x += 200) {
            for (let y = 150; y < this.map.height - 150; y += 250) {
                this.map.parkingLines.push({
                    x: x,
                    y: y,
                    width: 100,
                    height: 180
                });
            }
        }
        
        // Generatory
        const generatorPositions = [
            { x: 200, y: 300 },
            { x: 700, y: 250 },
            { x: 1200, y: 350 },
            { x: 450, y: 800 },
            { x: 1000, y: 850 }
        ];
        
        generatorPositions.forEach((pos, index) => {
            this.map.generators.push({
                x: pos.x,
                y: pos.y,
                width: 60,
                height: 60,
                progress: 0,
                isFixed: false,
                sparks: [],
                id: index
            });
        });
        
        // Światła
        for (let x = 150; x < this.map.width; x += 300) {
            for (let y = 150; y < this.map.height; y += 300) {
                this.map.lights.push({
                    x: x + (Math.random() - 0.5) * 50,
                    y: y + (Math.random() - 0.5) * 50,
                    radius: 150,
                    intensity: 0.3 + Math.random() * 0.2,
                    flicker: Math.random() * Math.PI
                });
            }
        }
        
        this.generatePatrolPoints();
    }
    
    generatePatrolPoints() {
        this.killer.patrolPoints = [];
        
        this.map.generators.forEach(gen => {
            this.killer.patrolPoints.push({
                x: gen.x + gen.width/2,
                y: gen.y + gen.height/2,
                priority: 2
            });
        });
        
        const gridSize = 200;
        for (let x = 100; x < this.map.width - 100; x += gridSize) {
            for (let y = 100; y < this.map.height - 100; y += gridSize) {
                const testPoint = {
                    x: x + Math.random() * 50 - 25,
                    y: y + Math.random() * 50 - 25
                };
                
                if (!this.checkMapCollision({ x: testPoint.x, y: testPoint.y, radius: this.killer.radius }, testPoint.x, testPoint.y)) {
                    this.killer.patrolPoints.push({
                        ...testPoint,
                        priority: 1
                    });
                }
            }
        }
        
        this.killer.patrolPoints.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - this.killer.x, 2) + Math.pow(a.y - this.killer.y, 2));
            const distB = Math.sqrt(Math.pow(b.x - this.killer.x, 2) + Math.pow(b.y - this.killer.y, 2));
            return distA - distB;
        });
    }
    
    // System cząsteczek
    class Particle {
        constructor(x, y, vx, vy, color, size, lifetime) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.color = color;
            this.size = size;
            this.lifetime = lifetime;
            this.maxLifetime = lifetime;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.98;
            this.vy *= 0.98;
            this.lifetime--;
            return this.lifetime > 0;
        }
        
        render(ctx) {
            const alpha = this.lifetime / this.maxLifetime;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
            ctx.globalAlpha = 1;
        }
    }
    
    // Kolizje
    checkCircleCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < obj1.radius + obj2.radius;
    }
    
    checkCircleRectCollision(circle, rect) {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
        
        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        
        return (dx * dx + dy * dy) < (circle.radius * circle.radius);
    }
    
    checkMapCollision(entity, newX, newY) {
        const testEntity = { ...entity, x: newX, y: newY };
        
        for (let wall of this.map.walls) {
            if (this.checkCircleRectCollision(testEntity, wall)) return true;
        }
        
        for (let pillar of this.map.pillars) {
            if (this.checkCircleCollision(testEntity, pillar)) return true;
        }
        
        for (let car of this.map.cars) {
            if (this.checkCircleRectCollision(testEntity, car)) return true;
        }
        
        return false;
    }
    
    isPointReachable(from, to, radius) {
        const steps = 10;
        const dx = (to.x - from.x) / steps;
        const dy = (to.y - from.y) / steps;
        
        for (let i = 1; i <= steps; i++) {
            const testX = from.x + dx * i;
            const testY = from.y + dy * i;
            
            if (this.checkMapCollision({ x: testX, y: testY, radius: radius }, testX, testY)) {
                return false;
            }
        }
        
        return true;
    }
    
    findAlternativePath(from, to, radius) {
        const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
        const distance = 50;
        
        for (let angle of angles) {
            const testX = from.x + Math.cos(angle) * distance;
            const testY = from.y + Math.sin(angle) * distance;
            
            if (!this.checkMapCollision({ x: testX, y: testY, radius: radius }, testX, testY)) {
                const currentDist = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
                const newDist = Math.sqrt(Math.pow(to.x - testX, 2) + Math.pow(to.y - testY, 2));
                
                if (newDist < currentDist) {
                    return { x: testX, y: testY, angle: angle };
                }
            }
        }
        
        const validAngles = angles.filter(angle => {
            const testX = from.x + Math.cos(angle) * distance;
            const testY = from.y + Math.sin(angle) * distance;
            return !this.checkMapCollision({ x: testX, y: testY, radius: radius }, testX, testY);
        });
        
        if (validAngles.length > 0) {
            const randomAngle = validAngles[Math.floor(Math.random() * validAngles.length)];
            return {
                x: from.x + Math.cos(randomAngle) * distance,
                y: from.y + Math.sin(randomAngle) * distance,
                angle: randomAngle
            };
        }
        
        return null;
    }
    
    updatePlayer() {
        if (this.game.state !== 'playing' || !this.player || this.isControllingKiller) return;
        
        let dx = 0;
        let dy = 0;
        
        if (this.keys['w']) dy = -1;
        if (this.keys['s']) dy = 1;
        if (this.keys['a']) dx = -1;
        if (this.keys['d']) dx = 1;
        
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        this.player.isRunning = this.keys['shift'] && this.player.stamina > 0 && (dx !== 0 || dy !== 0);
        
        if (this.player.isRunning) {
            this.player.stamina = Math.max(0, this.player.stamina - 1.5);
            
            if (Math.random() < 0.3) {
                this.game.particles.push(new this.Particle(
                    this.player.x - dx * 10,
                    this.player.y - dy * 10,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    'rgba(100, 100, 100, 0.5)',
                    3,
                    20
                ));
            }
        } else {
            this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 0.5);
        }
        
        const currentSpeed = this.player.isRunning ? this.player.runSpeed : this.player.speed;
        
        const newX = this.player.x + dx * currentSpeed;
        const newY = this.player.y + dy * currentSpeed;
        
        if (!this.checkMapCollision(this.player, newX, this.player.y)) {
            this.player.x = newX;
        }
        if (!this.checkMapCollision(this.player, this.player.x, newY)) {
            this.player.y = newY;
        }
        
        if (dx !== 0 || dy !== 0) {
            this.player.handOffset = Math.sin(this.game.time * 0.15) * 3;
        } else {
            this.player.handOffset *= 0.9;
        }
        
        this.player.angle = this.mouseAngle;
        
        if (this.player.injured) {
            this.player.injuryTimer--;
            if (this.player.injuryTimer <= 0) {
                this.player.injured = false;
            }
            
            if (Math.random() < 0.1) {
                this.game.bloodParticles.push({
                    x: this.player.x + (Math.random() - 0.5) * 10,
                    y: this.player.y + (Math.random() - 0.5) * 10,
                    size: 3 + Math.random() * 5,
                    alpha: 0.6
                });
            }
        }
        
        if (this.keys['e']) {
            this.map.generators.forEach(gen => {
                const dx = this.player.x - (gen.x + gen.width/2);
                const dy = this.player.y - (gen.y + gen.height/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (!gen.isFixed && dist < 50) {
                    gen.progress = Math.min(100, gen.progress + 0.4);
                    
                    if (Math.random() < 0.4) {
                        gen.sparks.push({
                            x: gen.x + gen.width/2 + (Math.random() - 0.5) * 40,
                            y: gen.y + gen.height/2 + (Math.random() - 0.5) * 40,
                            vx: (Math.random() - 0.5) * 5,
                            vy: -Math.random() * 4,
                            life: 25,
                            size: Math.random() * 3 + 1
                        });
                    }
                    
                    if (gen.progress >= 100 && !gen.isFixed) {
                        gen.isFixed = true;
                        this.game.generatorsFixed++;
                        
                        for (let i = 0; i < 20; i++) {
                            gen.sparks.push({
                                x: gen.x + gen.width/2,
                                y: gen.y + gen.height/2,
                                vx: (Math.random() - 0.5) * 10,
                                vy: -Math.random() * 8,
                                life: 40,
                                size: Math.random() * 4 + 2
                            });
                        }
                        
                        if (this.game.generatorsFixed >= this.game.totalGenerators) {
                            this.map.exitGate.isOpen = true;
                        }
                        
                        // Multiplayer event
                        if (this.mode === 'multiplayer' && this.networkManager) {
                            this.networkManager.sendGameEvent('generatorFixed', {
                                generatorId: gen.id,
                                fixedBy: this.options.playerName
                            });
                        }
                    }
                }
            });
        }
        
        if (this.map.exitGate.isOpen && this.checkCircleRectCollision(this.player, this.map.exitGate)) {
            this.game.state = 'won';
        }
    }
    
    updateKillerPlayer() {
        if (this.game.state !== 'playing' || !this.isControllingKiller) return;
        
        let dx = 0;
        let dy = 0;
        
        if (this.keys['w']) dy = -1;
        if (this.keys['s']) dy = 1;
        if (this.keys['a']) dx = -1;
        if (this.keys['d']) dx = 1;
        
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        const speed = this.keys['shift'] ? this.killer.speed * 1.3 : this.killer.speed;
        
        const newX = this.killer.x + dx * speed;
        const newY = this.killer.y + dy * speed;
        
        if (!this.checkMapCollision(this.killer, newX, this.killer.y)) {
            this.killer.x = newX;
        }
        if (!this.checkMapCollision(this.killer, this.killer.x, newY)) {
            this.killer.y = newY;
        }
        
        if (dx !== 0 || dy !== 0) {
            this.killer.handOffset = Math.sin(this.game.time * 0.15) * 4;
        } else {
            this.killer.handOffset *= 0.9;
        }
        
        this.killer.angle = this.mouseAngle;
        
        // Atak na innych graczy w multiplayer
        if (this.mode === 'multiplayer') {
            this.players.forEach(player => {
                if (player.role === 'survivor' && player.state === 'alive') {
                    const dx = player.x - this.killer.x;
                    const dy = player.y - this.killer.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 35 && this.killer.attackCooldown === 0) {
                        this.killer.attackCooldown = 90;
                        this.networkManager.sendGameEvent('playerAttacked', {
                            targetId: player.id,
                            damage: 25
                        });
                    }
                }
            });
        }
        
        this.killer.attackCooldown = Math.max(0, this.killer.attackCooldown - 1);
    }
    
    updateKiller() {
        if (this.game.state !== 'playing' || !this.player || this.isControllingKiller) return;
        
        this.killer.attackCooldown = Math.max(0, this.killer.attackCooldown - 1);
        this.killer.pathfindingTimer++;
        
        const dx = this.player.x - this.killer.x;
        const dy = this.player.y - this.killer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const moveDistance = Math.sqrt(
            Math.pow(this.killer.x - this.killer.lastPosition.x, 2) + 
            Math.pow(this.killer.y - this.killer.lastPosition.y, 2)
        );
        
        if (moveDistance < 0.5 && this.killer.state !== 'idle') {
            this.killer.stuckTimer++;
            if (this.killer.stuckTimer > 30) {
                this.killer.state = 'stuck';
            }
        } else {
            this.killer.stuckTimer = 0;
            this.killer.lastPosition = { x: this.killer.x, y: this.killer.y };
        }
        
        const angleToPlayer = Math.atan2(dy, dx);
        const angleDiff = Math.abs(angleToPlayer - this.killer.angle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        const inFOV = normalizedDiff < this.killer.viewAngle / 2;
        
        const canSeePlayer = distance < this.killer.viewDistance && inFOV && !this.hasLineOfSightBlocked(this.killer, this.player);
        
        // AI State Machine
        switch(this.killer.state) {
            case 'patrol':
                if (canSeePlayer) {
                    this.killer.state = 'chase';
                    this.killer.chasingPlayer = true;
                    this.killer.lastSeen = { x: this.player.x, y: this.player.y };
                    this.killer.alertLevel = 100;
                    this.killer.speed = 2.8;
                } else {
                    if (!this.killer.targetPoint || 
                        (Math.abs(this.killer.x - this.killer.targetPoint.x) < 30 && 
                         Math.abs(this.killer.y - this.killer.targetPoint.y) < 30)) {
                        
                        this.killer.currentPatrolIndex = (this.killer.currentPatrolIndex + 1) % this.killer.patrolPoints.length;
                        this.killer.targetPoint = this.killer.patrolPoints[this.killer.currentPatrolIndex];
                    }
                    
                    this.killer.speed = 2.0;
                    this.moveTowardsTarget(this.killer.targetPoint);
                }
                break;
                
            case 'chase':
                if (canSeePlayer) {
                    this.killer.lastSeen = { x: this.player.x, y: this.player.y };
                    this.killer.targetPoint = { x: this.player.x, y: this.player.y };
                    this.killer.alertLevel = 100;
                    
                    // Przewidywanie ruchu gracza
                    this.killer.lastPlayerPositions.push({ 
                        x: this.player.x, 
                        y: this.player.y, 
                        time: Date.now() 
                    });
                    
                    if (this.killer.lastPlayerPositions.length > 10) {
                        this.killer.lastPlayerPositions.shift();
                    }
                    
                    if (this.killer.lastPlayerPositions.length >= 2) {
                        const recent = this.killer.lastPlayerPositions[this.killer.lastPlayerPositions.length - 1];
                        const previous = this.killer.lastPlayerPositions[this.killer.lastPlayerPositions.length - 2];
                        
                        const velocityX = (recent.x - previous.x) / (recent.time - previous.time);
                        const velocityY = (recent.y - previous.y) / (recent.time - previous.time);
                        
                        const predictTime = 500;
                        this.killer.targetPoint = {
                            x: this.player.x + velocityX * predictTime,
                            y: this.player.y + velocityY * predictTime
                        };
                    }
                } else {
                    this.killer.alertLevel = Math.max(0, this.killer.alertLevel - 1);
                    
                    if (this.killer.alertLevel === 0) {
                        this.killer.state = 'search';
                        this.killer.searchTimer = 180;
                        this.killer.speed = 2.3;
                    }
                }
                
                this.moveTowardsTarget(this.killer.targetPoint);
                break;
                
            case 'search':
                this.killer.searchTimer--;
                
                if (canSeePlayer) {
                    this.killer.state = 'chase';
                    this.killer.chasingPlayer = true;
                    this.killer.lastSeen = { x: this.player.x, y: this.player.y };
                    this.killer.alertLevel = 100;
                    this.killer.speed = 2.8;
                } else if (this.killer.searchTimer <= 0) {
                    this.killer.state = 'patrol';
                    this.killer.chasingPlayer = false;
                    this.killer.lastSeen = null;
                    this.killer.targetPoint = null;
                } else {
                    if (!this.killer.targetPoint || 
                        (Math.abs(this.killer.x - this.killer.targetPoint.x) < 20 && 
                         Math.abs(this.killer.y - this.killer.targetPoint.y) < 20)) {
                        
                        const searchRadius = 100;
                        this.killer.targetPoint = {
                            x: this.killer.lastSeen.x + (Math.random() - 0.5) * searchRadius * 2,
                            y: this.killer.lastSeen.y + (Math.random() - 0.5) * searchRadius * 2
                        };
                    }
                    
                    this.moveTowardsTarget(this.killer.targetPoint);
                }
                break;
                
            case 'stuck':
                this.killer.avoidanceAngle += Math.PI / 4;
                
                const escapeDistance = 50;
                const escapeX = this.killer.x + Math.cos(this.killer.avoidanceAngle) * escapeDistance;
                const escapeY = this.killer.y + Math.sin(this.killer.avoidanceAngle) * escapeDistance;
                
                if (!this.checkMapCollision(this.killer, escapeX, escapeY)) {
                    this.killer.targetPoint = { x: escapeX, y: escapeY };
                    this.killer.state = this.killer.chasingPlayer ? 'chase' : 'patrol';
                    this.killer.stuckTimer = 0;
                }
                
                if (this.killer.stuckTimer > 60) {
                    const safePoint = this.killer.patrolPoints[Math.floor(Math.random() * this.killer.patrolPoints.length)];
                    this.killer.x = safePoint.x;
                    this.killer.y = safePoint.y;
                    this.killer.state = 'patrol';
                    this.killer.stuckTimer = 0;
                }
                break;
        }
        
        this.killer.handOffset = Math.sin(this.game.time * 0.15) * 4;
        
        if (distance < 35 && this.killer.attackCooldown === 0) {
            this.player.health = Math.max(0, this.player.health - 25);
            this.killer.attackCooldown = 90;
            this.player.injured = true;
            this.player.injuryTimer = 60;
            
            for (let i = 0; i < 10; i++) {
                this.game.particles.push(new this.Particle(
                    this.player.x,
                    this.player.y,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    `rgb(${150 + Math.random()*50}, 0, 0)`,
                    4 + Math.random() * 4,
                    30 + Math.random() * 20
                ));
            }
            
            if (this.player.health <= 0) {
                this.game.state = 'lost';
            }
        }
    }
    
    moveTowardsTarget(target) {
        if (!target) return;
        
        const moveX = target.x - this.killer.x;
        const moveY = target.y - this.killer.y;
        const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
        
        if (moveDistance > 5) {
            let normalX = moveX / moveDistance;
            let normalY = moveY / moveDistance;
            
            let newX = this.killer.x + normalX * this.killer.speed;
            let newY = this.killer.y + normalY * this.killer.speed;
            
            if (this.checkMapCollision(this.killer, newX, newY)) {
                const alternative = this.findAlternativePath(this.killer, target, this.killer.radius);
                
                if (alternative) {
                    const altX = alternative.x - this.killer.x;
                    const altY = alternative.y - this.killer.y;
                    const altDist = Math.sqrt(altX * altX + altY * altY);
                    
                    if (altDist > 0) {
                        normalX = altX / altDist;
                        normalY = altY / altDist;
                        newX = this.killer.x + normalX * this.killer.speed;
                        newY = this.killer.y + normalY * this.killer.speed;
                    }
                }
            }
            
            if (!this.checkMapCollision(this.killer, newX, this.killer.y)) {
                this.killer.x = newX;
            }
            if (!this.checkMapCollision(this.killer, this.killer.x, newY)) {
                this.killer.y = newY;
            }
            
            this.killer.angle = Math.atan2(normalY, normalX);
        }
    }
    
    hasLineOfSightBlocked(from, to) {
        const steps = 20;
        const dx = (to.x - from.x) / steps;
        const dy = (to.y - from.y) / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkPoint = {
                x: from.x + dx * i,
                y: from.y + dy * i,
                radius: 1
            };
            
            for (let pillar of this.map.pillars) {
                if (this.checkCircleCollision(checkPoint, pillar)) return true;
            }
            for (let car of this.map.cars) {
                if (this.checkCircleRectCollision(checkPoint, car)) return true;
            }
        }
        
        return false;
    }
    
    updateCamera() {
        const entity = this.isControllingKiller ? this.killer : this.player;
        if (!entity) return;
        
        const targetX = entity.x - this.canvas.width / 2;
        const targetY = entity.y - this.canvas.height / 2;
        
        this.game.camera.x += (targetX - this.game.camera.x) * 0.1;
        this.game.camera.y += (targetY - this.game.camera.y) * 0.1;
        
        this.game.camera.x = Math.max(0, Math.min(this.map.width - this.canvas.width, this.game.camera.x));
        this.game.camera.y = Math.max(0, Math.min(this.map.height - this.canvas.height, this.game.camera.y));
    }
    
    drawCharacter(ctx, x, y, radius, angle, color, isKiller = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 5, radius * 1.2, radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, isKiller ? '#8B0000' : '#1e4d8b');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const handDistance = radius + 5;
        const handSize = 6;
        const handSpread = 0.4;
        const offset = isKiller ? this.killer.handOffset : this.player.handOffset;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
            Math.cos(-handSpread) * handDistance + offset,
            Math.sin(-handSpread) * handDistance,
            handSize,
            0, Math.PI * 2
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(
            Math.cos(handSpread) * handDistance - offset,
            Math.sin(handSpread) * handDistance,
            handSize,
            0, Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
        
        if (isKiller) {
            const eyeGlow = this.killer.state === 'chase' ? '#ff0000' : 
                           this.killer.state === 'search' ? '#ffaa00' : '#ff6600';
            ctx.fillStyle = eyeGlow;
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath();
            ctx.arc(-5, -3, 2, 0, Math.PI * 2);
            ctx.arc(5, -3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        ctx.restore();
    }
    
    render() {
        this.game.time++;
        
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(-this.game.camera.x, -this.game.camera.y);
        
        if (this.textures.asphalt) {
            const pattern = this.ctx.createPattern(this.textures.asphalt, 'repeat');
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, 0, this.map.width, this.map.height);
        }
        
        this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.2)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 10]);
        this.map.parkingLines.forEach(line => {
            this.ctx.strokeRect(line.x, line.y, line.width, line.height);
        });
        this.ctx.setLineDash([]);
        
        this.game.bloodParticles.forEach((blood, index) => {
            this.ctx.fillStyle = `rgba(120, 0, 0, ${blood.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(blood.x, blood.y, blood.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            blood.alpha *= 0.995;
            if (blood.alpha < 0.01) {
                this.game.bloodParticles.splice(index, 1);
            }
        });
        
        this.ctx.fillStyle = '#2a2a2a';
        this.map.walls.forEach(wall => {
            if (this.textures.concrete) {
                const pattern = this.ctx.createPattern(this.textures.concrete, 'repeat');
                this.ctx.fillStyle = pattern;
            }
            this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            
            this.ctx.strokeStyle = '#1a1a1a';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
        });
        
        this.map.pillars.forEach(pillar => {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(pillar.x + 3, pillar.y + 3, pillar.radius + 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            const gradient = this.ctx.createRadialGradient(
                pillar.x - pillar.radius/3, pillar.y - pillar.radius/3, 0,
                pillar.x, pillar.y, pillar.radius
            );
            gradient.addColorStop(0, '#4a4a4a');
            gradient.addColorStop(1, '#2a2a2a');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(pillar.x, pillar.y, pillar.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#1a1a1a';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
        
        this.map.cars.forEach(car => {
            this.ctx.save();
            this.ctx.translate(car.x + car.width/2, car.y + car.height/2);
            this.ctx.rotate(car.angle);
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(-car.width/2 + 5, -car.height/2 + 5, car.width, car.height);
            
            const carGradient = this.ctx.createLinearGradient(
                -car.width/2, 0,
                car.width/2, 0
            );
            carGradient.addColorStop(0, car.color);
            carGradient.addColorStop(0.5, this.adjustBrightness(car.color, 20));
            carGradient.addColorStop(1, car.color);
            
            this.ctx.fillStyle = carGradient;
            this.ctx.fillRect(-car.width/2, -car.height/2, car.width, car.height);
            
            this.ctx.fillStyle = 'rgba(30, 40, 50, 0.8)';
            this.ctx.fillRect(-car.width/2 + 15, -car.height/2 + 25, car.width - 30, 45);
            this.ctx.fillRect(-car.width/2 + 15, car.height/2 - 60, car.width - 30, 35);
            
            this.ctx.strokeStyle = 'rgba(150, 180, 200, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(-car.width/2 + 20, -car.height/2 + 30);
            this.ctx.lineTo(-car.width/2 + 40, -car.height/2 + 50);
            this.ctx.stroke();
            
            this.ctx.fillStyle = '#ffccaa';
            this.ctx.fillRect(-car.width/2 + 5, -car.height/2 + 5, 12, 10);
            this.ctx.fillRect(car.width/2 - 17, -car.height/2 + 5, 12, 10);
            
            this.ctx.fillStyle = '#ff3333';
            this.ctx.fillRect(-car.width/2 + 5, car.height/2 - 15, 12, 10);
            this.ctx.fillRect(car.width/2 - 17, car.height/2 - 15, 12, 10);
            
            this.ctx.restore();
        });
        
        this.map.generators.forEach(gen => {
            const baseGradient = this.ctx.createLinearGradient(
                gen.x, gen.y,
                gen.x + gen.width, gen.y + gen.height
            );
            
            if (gen.isFixed) {
                baseGradient.addColorStop(0, '#2a7f3e');
                baseGradient.addColorStop(1, '#1a5f2e');
            } else {
                baseGradient.addColorStop(0, '#4a4a4a');
                baseGradient.addColorStop(1, '#2a2a2a');
            }
            
            this.ctx.fillStyle = baseGradient;
            this.ctx.fillRect(gen.x, gen.y, gen.width, gen.height);
            
            this.ctx.strokeStyle = gen.isFixed ? '#3a9f4e' : '#5a5a5a';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(gen.x + 5, gen.y + 5, gen.width - 10, gen.height - 10);
            
            this.ctx.fillStyle = gen.isFixed ? '#00ff00' : '#ff0000';
            this.ctx.fillRect(gen.x + gen.width/2 - 5, gen.y + 10, 10, 10);
            
            if (!gen.isFixed && gen.progress > 0) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(gen.x - 5, gen.y - 20, gen.width + 10, 10);
                
                const progressGradient = this.ctx.createLinearGradient(
                    gen.x, gen.y - 15,
                    gen.x + gen.width * (gen.progress / 100), gen.y - 15
                );
                progressGradient.addColorStop(0, '#ffaa00');
                progressGradient.addColorStop(1, '#ff6600');
                
                this.ctx.fillStyle = progressGradient;
                this.ctx.fillRect(gen.x, gen.y - 15, gen.width * (gen.progress / 100), 5);
            }
            
            gen.sparks = gen.sparks.filter(spark => {
                spark.x += spark.vx;
                spark.y += spark.vy;
                spark.vy += 0.3;
                spark.life--;
                
                if (spark.life > 0) {
                    const alpha = spark.life / 40;
                    const gradient = this.ctx.createRadialGradient(
                        spark.x, spark.y, 0,
                        spark.x, spark.y, spark.size
                    );
                    gradient.addColorStop(0, `rgba(255, 230, 100, ${alpha})`);
                    gradient.addColorStop(0.5, `rgba(255, 180, 0, ${alpha * 0.8})`);
                    gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
                    
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(spark.x - spark.size, spark.y - spark.size, 
                               spark.size * 2, spark.size * 2);
                    return true;
                }
                return false;
            });
        });
        
        if (this.map.exitGate.isOpen) {
            const glowIntensity = 0.5 + Math.sin(this.game.time * 0.1) * 0.3;
            const gateGlow = this.ctx.createRadialGradient(
                this.map.exitGate.x + this.map.exitGate.width/2,
                this.map.exitGate.y + this.map.exitGate.height/2,
                0,
                this.map.exitGate.x + this.map.exitGate.width/2,
                this.map.exitGate.y + this.map.exitGate.height/2,
                100
            );
            gateGlow.addColorStop(0, `rgba(0, 255, 0, ${glowIntensity})`);
            gateGlow.addColorStop(1, 'rgba(0, 255, 0, 0)');
            this.ctx.fillStyle = gateGlow;
            this.ctx.fillRect(
                this.map.exitGate.x - 50,
                this.map.exitGate.y - 50,
                this.map.exitGate.width + 100,
                this.map.exitGate.height + 100
            );
        }
        
        this.ctx.fillStyle = this.map.exitGate.isOpen ? '#00ff00' : '#ff0000';
        this.ctx.fillRect(this.map.exitGate.x, this.map.exitGate.y, this.map.exitGate.width, this.map.exitGate.height);
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 14px Oswald';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('EXIT', 
            this.map.exitGate.x + this.map.exitGate.width/2, 
            this.map.exitGate.y + this.map.exitGate.height/2 + 5
        );
        
        // Rysuj graczy
        if (this.player && !this.isControllingKiller) {
            this.drawCharacter(this.ctx, this.player.x, this.player.y, this.player.radius, 
                             this.player.angle, this.player.injured ? '#ff6666' : '#4a90e2', false);
        }
        
        this.drawCharacter(this.ctx, this.killer.x, this.killer.y, this.killer.radius, 
                         this.killer.angle, '#8B0000', true);
        
        // Rysuj innych graczy w multiplayer
        if (this.mode === 'multiplayer') {
            this.players.forEach(player => {
                const isKiller = player.role === 'killer';
                const color = isKiller ? '#8B0000' : '#4a90e2';
                this.drawCharacter(this.ctx, player.x, player.y, 
                                 isKiller ? 18 : 15, 
                                 player.angle || 0, color, isKiller);
            });
        }
        
        this.game.particles = this.game.particles.filter(particle => {
            particle.render(this.ctx);
            return particle.update();
        });
        
        this.ctx.restore();
        
        this.renderLighting();
        this.renderMinimap();
    }
    
    renderLighting() {
        this.lightCtx.clearRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
        
        this.lightCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.lightCtx.fillRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
        
        this.lightCtx.save();
        this.lightCtx.translate(-this.game.camera.x, -this.game.camera.y);
        
        this.lightCtx.globalCompositeOperation = 'destination-out';
        
        this.map.lights.forEach(light => {
            const flicker = 1 + Math.sin(this.game.time * 0.05 + light.flicker) * 0.1;
            const gradient = this.lightCtx.createRadialGradient(
                light.x, light.y, 0,
                light.x, light.y, light.radius * flicker
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${light.intensity})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${light.intensity * 0.5})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            this.lightCtx.fillStyle = gradient;
            this.lightCtx.fillRect(
                light.x - light.radius * 2,
                light.y - light.radius * 2,
                light.radius * 4,
                light.radius * 4
            );
        });
        
        const entity = this.isControllingKiller ? this.killer : this.player;
        if (entity) {
            const playerGradient = this.lightCtx.createRadialGradient(
                entity.x, entity.y, 0,
                entity.x, entity.y, 120
            );
            playerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            playerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
            playerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            this.lightCtx.fillStyle = playerGradient;
            this.lightCtx.fillRect(entity.x - 200, entity.y - 200, 400, 400);
        }
        
        if (this.killer.state === 'chase' || this.killer.state === 'search') {
            const killerGradient = this.lightCtx.createRadialGradient(
                this.killer.x, this.killer.y, 0,
                this.killer.x, this.killer.y, 80
            );
            const color = this.killer.state === 'chase' ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 170, 0, 0.2)';
            killerGradient.addColorStop(0, color);
            killerGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            this.lightCtx.globalCompositeOperation = 'source-over';
            this.lightCtx.fillStyle = killerGradient;
            this.lightCtx.fillRect(this.killer.x - 100, this.killer.y - 100, 200, 200);
            this.lightCtx.globalCompositeOperation = 'destination-out';
        }
        
        this.lightCtx.restore();
    }
    
    renderMinimap() {
        this.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
        
        const scale = 0.125;
        
        this.minimapCtx.fillStyle = '#333';
        this.map.walls.forEach(wall => {
            this.minimapCtx.fillRect(
                wall.x * scale,
                wall.y * scale,
                wall.width * scale,
                wall.height * scale
            );
        });
        
        this.map.generators.forEach(gen => {
            this.minimapCtx.fillStyle = gen.isFixed ? '#0f0' : '#f00';
            this.minimapCtx.fillRect(
                gen.x * scale,
                gen.y * scale,
                gen.width * scale,
                gen.height * scale
            );
        });
        
        if (this.player && !this.isControllingKiller) {
            this.minimapCtx.fillStyle = '#4a90e2';
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(this.player.x * scale, this.player.y * scale, 3, 0, Math.PI * 2);
            this.minimapCtx.fill();
        }
        
        if (this.player && !this.isControllingKiller) {
            const dx = this.player.x - this.killer.x;
            const dy = this.player.y - this.killer.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 300 || this.killer.state === 'chase') {
                const alpha = this.killer.state === 'chase' ? 1 : (1 - dist/300);
                this.minimapCtx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                this.minimapCtx.beginPath();
                this.minimapCtx.arc(this.killer.x * scale, this.killer.y * scale, 3, 0, Math.PI * 2);
                this.minimapCtx.fill();
            }
        } else if (this.isControllingKiller) {
            this.minimapCtx.fillStyle = '#ff0000';
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(this.killer.x * scale, this.killer.y * scale, 3, 0, Math.PI * 2);
            this.minimapCtx.fill();
        }
    }
    
    adjustBrightness(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 +
                    (G<255?G<1?0:G:255)*0x100 +
                    (B<255?B<1?0:B:255)).toString(16).slice(1);
    }
    
    updateUI() {
        if (this.player && !this.isControllingKiller) {
            document.getElementById('healthBar').style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
            document.getElementById('staminaBar').style.width = `${(this.player.stamina / this.player.maxStamina) * 100}%`;
        } else {
            document.getElementById('healthBar').style.width = '100%';
            document.getElementById('staminaBar').style.width = '100%';
        }
        
        let iconsHTML = '';
        for (let i = 0; i < this.game.totalGenerators; i++) {
            iconsHTML += `<span class="generator-icon ${i < this.game.generatorsFixed ? 'fixed' : ''}"></span>`;
        }
        document.getElementById('generatorIcons').innerHTML = iconsHTML;
        
        if (this.game.state === 'won') {
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('gameOverText').textContent = '🎉 UCIEKŁEŚ! 🎉';
            document.getElementById('gameOverText').style.color = '#00ff00';
        } else if (this.game.state === 'lost') {
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('gameOverText').textContent = '💀 ZŁAPANY! 💀';
            document.getElementById('gameOverText').style.color = '#ff0000';
        }
        
        if (this.keys['r'] && this.game.state !== 'playing') {
            this.restartGame();
        }
    }
    
    restartGame() {
        window.location.reload();
    }
    
    // Multiplayer functions
    async initMultiplayer() {
        document.getElementById('multiplayerInfo').style.display = 'block';
        document.getElementById('playerList').style.display = 'block';
        document.getElementById('chatContainer').style.display = 'block';
        document.getElementById('connectionStatus').style.display = 'block';
        document.getElementById('roomCode').textContent = this.options.roomCode;
        
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
            
            if (this.options.playerRole === 'killer') {
                this.isControllingKiller = true;
                this.player = null;
            } else {
                this.isControllingKiller = false;
            }
            
            this.updatePlayerList();
            
        } catch (error) {
            console.error('Failed to initialize multiplayer:', error);
            alert('Nie udało się połączyć. Sprawdź kod pokoju.');
        }
    }
    
    initSingleplayer() {
        this.isControllingKiller = false;
    }
    
    setupNetworkHandlers() {
        this.networkManager.on('playerJoined', (player) => {
            this.players.set(player.id, player);
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
            this.players.set(playerData.id, playerData);
        });
        
        this.networkManager.on('gameEvent', (event) => {
            this.handleGameEvent(event);
        });
        
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
    
    updatePlayerList() {
        const content = document.getElementById('playerListContent');
        content.innerHTML = '';
        
        const localDiv = document.createElement('div');
        localDiv.className = 'player-item';
        localDiv.innerHTML = `
            <strong>${this.options.playerName}</strong> (Ty)
            <span style="float: right;">${this.options.playerRole === 'killer' ? '🔪' : '🏃'}</span>
        `;
        content.appendChild(localDiv);
        
        this.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                ${player.name}
                <span style="float: right;">${player.role === 'killer' ? '🔪' : '🏃'}</span>
            `;
            content.appendChild(playerDiv);
        });
        
        document.getElementById('playerCount').textContent = 
            `${this.players.size + 1}/5`;
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
                const gen = this.map.generators.find(g => g.id === event.data.generatorId);
                if (gen) {
                    gen.isFixed = true;
                    gen.progress = 100;
                    this.game.generatorsFixed++;
                    this.addChatMessage(`${event.data.fixedBy} naprawił generator!`, 'system');
                }
                break;
            case 'playerAttacked':
                // Handle attacks in multiplayer
                break;
        }
    }
    
    syncNetworkState() {
        const entity = this.isControllingKiller ? this.killer : this.player;
        if (!entity) return;
        
        this.networkManager.updateLocalPlayer({
            x: entity.x,
            y: entity.y,
            health: entity.health || 100,
            angle: entity.angle || 0,
            state: this.game.state
        });
    }
    
    gameLoop() {
        this.update();
        this.render();
        this.updateUI();
        
        if (this.mode === 'multiplayer' && this.networkManager) {
            this.syncNetworkState();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        if (this.game.state !== 'playing') return;
        
        if (this.mode === 'singleplayer') {
            this.updatePlayer();
            this.updateKiller();
        } else if (this.mode === 'multiplayer') {
            if (this.isControllingKiller) {
                this.updateKillerPlayer();
            } else {
                this.updatePlayer();
            }
        }
        
        this.updateCamera();
        this.game.time++;
    }
    
    // Particle class definition for this context
    Particle = class {
        constructor(x, y, vx, vy, color, size, lifetime) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.color = color;
            this.size = size;
            this.lifetime = lifetime;
            this.maxLifetime = lifetime;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.98;
            this.vy *= 0.98;
            this.lifetime--;
            return this.lifetime > 0;
        }
        
        render(ctx) {
            const alpha = this.lifetime / this.maxLifetime;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
            ctx.globalAlpha = 1;
        }
    }
}

window.UndergroundEscapeGame = UndergroundEscapeGame;