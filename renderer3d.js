class ChessRenderer3D {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Camera setup
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
        this.camera.position.set(6, 12, 16);
        this.camera.lookAt(6, 0, 6);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(6, 0, 6);
        this.controls.minDistance = 8;
        this.controls.maxDistance = 30;
        this.controls.maxPolarAngle = Math.PI / 2.2;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.autoRotate = false;
        
        // Lighting groups
        this.lights = {
            hemi: new THREE.HemisphereLight(0x87CEEB, 0x445522, 0.6),
            dir: new THREE.DirectionalLight(0xffffff, 0.8),
            ambient: new THREE.AmbientLight(0x404040, 0.4)
        };
        
        this.lights.dir.position.set(5, 15, 5);
        this.lights.dir.castShadow = true;
        this.lights.dir.shadow.mapSize.width = 2048;
        this.lights.dir.shadow.mapSize.height = 2048;
        this.lights.dir.shadow.camera.left = -10;
        this.lights.dir.shadow.camera.right = 10;
        this.lights.dir.shadow.camera.top = 10;
        this.lights.dir.shadow.camera.bottom = -10;
        this.lights.dir.shadow.camera.far = 50;
        
        this.scene.add(this.lights.hemi);
        this.scene.add(this.lights.dir);
        this.scene.add(this.lights.ambient);
        
        // Ground plane — sandy desert/landscape instead of black void
        const groundGeo = new THREE.PlaneGeometry(80, 80, 32, 32);
        // Add subtle height variation for terrain feel
        const posAttr = groundGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            // Only add bumps outside the board area
            const bx = x + 6, by = y + 6;
            if (bx < -1 || bx > 13 || by < -1 || by > 13) {
                posAttr.setZ(i, Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.4 + Math.random() * 0.1);
            }
        }
        groundGeo.computeVertexNormals();
        this.groundMat = new THREE.MeshStandardMaterial({ 
            color: 0xc2a456,  // Sandy desert color
            roughness: 0.95,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, this.groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(6, -0.1, 6);
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Board spotlight — ensures board is always well-lit
        this.boardSpotlight = new THREE.SpotLight(0xffffff, 0.3);
        this.boardSpotlight.position.set(6, 18, 6);
        this.boardSpotlight.target.position.set(6, 0, 6);
        this.boardSpotlight.angle = Math.PI / 5;
        this.boardSpotlight.penumbra = 0.4;
        this.boardSpotlight.decay = 1.5;
        this.boardSpotlight.distance = 40;
        this.scene.add(this.boardSpotlight);
        this.scene.add(this.boardSpotlight.target);
        
        // Groups
        this.boardGroup = new THREE.Group();
        this.piecesGroup = new THREE.Group();
        this.indicatorsGroup = new THREE.Group();
        this.scene.add(this.boardGroup);
        this.scene.add(this.piecesGroup);
        this.scene.add(this.indicatorsGroup);
        
        // Stars for night mode
        this.starsGeo = new THREE.BufferGeometry();
        const starsCount = 200;
        const posArray = new Float32Array(starsCount * 3);
        for(let i = 0; i < starsCount * 3; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 100;
            posArray[i+1] = 10 + Math.random() * 40;
            posArray[i+2] = (Math.random() - 0.5) * 100;
        }
        this.starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        this.starsMat = new THREE.PointsMaterial({ size: 0.3, color: 0xffffff, transparent: true, opacity: 0 });
        this.stars = new THREE.Points(this.starsGeo, this.starsMat);
        this.scene.add(this.stars);
        
        // Biome particles
        this.biomeParticles = null;
        this.currentBiome = 'desert';
        this.biomeConfigs = {
            desert: {
                ground: 0xc2a456,
                skyTint: 0x000000,
                particles: { count: 60, color: 0xffdd88, size: 0.12, speed: -0.3, spread: 45, height: 20,
                    movement: 'drift', sway: 1.5 } // Heat shimmer / dust
            },
            snow: {
                ground: 0xe8e8f0,
                skyTint: 0xc0d0e8,
                particles: { count: 300, color: 0xffffff, size: 0.15, speed: -2, spread: 40, height: 25,
                    movement: 'fall', sway: 0.5 }
            },
            ocean: {
                ground: 0x2a6090,
                skyTint: 0x4488cc,
                particles: { count: 400, color: 0xaabbdd, size: 0.08, speed: -7, spread: 40, height: 25,
                    movement: 'fall', sway: 0.15 } // Rain over ocean
            },
            volcano: {
                ground: 0x3a2020,
                skyTint: 0x442200,
                particles: { count: 100, color: 0xff6600, size: 0.2, speed: 1.5, spread: 20, height: 0,
                    movement: 'rise', sway: 0.8 }
            },
            forest: {
                ground: 0x3a6a30,
                skyTint: 0x225522,
                particles: { count: 60, color: 0x88aa44, size: 0.2, speed: -0.4, spread: 35, height: 20,
                    movement: 'drift', sway: 2.0 } // Falling leaves
            }
        };
        
        // State
        this.boardSquares = [];
        this.clickCallback = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.animating = true;
        this.clock = new THREE.Clock();
        
        this.envTransition = {
            active: false,
            progress: 0,
            duration: 2.0,
            targetColors: {},
            sourceColors: {}
        };
        
        this.dayNightCycle = {
            active: false,
            timer: 0,
            interval: 10,
            currentPhase: 0, // 0=day, 1=sunset, 2=night
            phases: ['day', 'sunset', 'night']
        };

        // Cache geometries and materials
        this.geometries = {};
        this.materials = {
            white: new THREE.MeshStandardMaterial({ color: 0xfaf0e6, metalness: 0.2, roughness: 0.5 }),
            black: new THREE.MeshStandardMaterial({ color: 0x2a1810, metalness: 0.2, roughness: 0.5 }),
            tigerWhite: new THREE.MeshStandardMaterial({ color: 0xe8820a, metalness: 0.2, roughness: 0.5 }),
            tigerBlack: new THREE.MeshStandardMaterial({ color: 0xb56000, metalness: 0.2, roughness: 0.5 }),
            roosterWhite: new THREE.MeshStandardMaterial({ color: 0xcc4444, metalness: 0.2, roughness: 0.5 }),
            roosterBlack: new THREE.MeshStandardMaterial({ color: 0x882222, metalness: 0.2, roughness: 0.5 }),
            roosterComb: new THREE.MeshStandardMaterial({ color: 0xcc3333, metalness: 0.1, roughness: 0.7 })
        };

        this.initBoard();
        this.setupEvents();
        
        // Start loop
        this.animate();
    }
    
    initBoard() {
        const boxGeo = new THREE.BoxGeometry(1, 0.15, 1);
        this.geometries.square = boxGeo;
        
        // Frame
        const frameGeoVertical = new THREE.BoxGeometry(12.4, 0.25, 0.2);
        const frameGeoHorizontal = new THREE.BoxGeometry(0.2, 0.25, 12.4);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, metalness: 0.1, roughness: 0.8 });
        
        const f1 = new THREE.Mesh(frameGeoVertical, frameMat);
        f1.position.set(6, -0.05, -0.1);
        f1.castShadow = true; f1.receiveShadow = true;
        this.boardGroup.add(f1);
        
        const f2 = new THREE.Mesh(frameGeoVertical, frameMat);
        f2.position.set(6, -0.05, 12.1);
        f2.castShadow = true; f2.receiveShadow = true;
        this.boardGroup.add(f2);
        
        const f3 = new THREE.Mesh(frameGeoHorizontal, frameMat);
        f3.position.set(-0.1, -0.05, 6);
        f3.castShadow = true; f3.receiveShadow = true;
        this.boardGroup.add(f3);
        
        const f4 = new THREE.Mesh(frameGeoHorizontal, frameMat);
        f4.position.set(12.1, -0.05, 6);
        f4.castShadow = true; f4.receiveShadow = true;
        this.boardGroup.add(f4);

        for (let row = 0; row < 12; row++) {
            this.boardSquares[row] = [];
            for (let col = 0; col < 12; col++) {
                const isLight = (row + col) % 2 === 0;
                const baseColor = isLight ? 0xf0d9b5 : 0xb58863;
                
                const mat = new THREE.MeshStandardMaterial({
                    color: baseColor,
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                const square = new THREE.Mesh(boxGeo, mat);
                square.position.set(col + 0.5, 0, (11 - row) + 0.5);
                square.receiveShadow = true;
                square.userData = { row, col, isLight, baseColor };
                
                this.boardGroup.add(square);
                this.boardSquares[row][col] = square;
            }
        }
    }
    
    updateBoardColors(lightHex, darkHex) {
        const lightColor = new THREE.Color(lightHex);
        const darkColor = new THREE.Color(darkHex);
        for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 12; col++) {
                const sq = this.boardSquares[row][col];
                if (sq && sq.userData) {
                    const isLight = sq.userData.isLight;
                    const newColor = isLight ? lightColor : darkColor;
                    sq.userData.baseColor = newColor.getHex();
                    sq.material.color.copy(newColor);
                }
            }
        }
    }
    
    setupEvents() {
        this._onClick = this.onClick.bind(this);
        this._onResize = this.onResize.bind(this);
        
        this.renderer.domElement.addEventListener('click', this._onClick);
        window.addEventListener('resize', this._onResize);
    }
    
    onClick(event) {
        if (!this.clickCallback || this.container.style.display === 'none') return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const squares = [];
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                squares.push(this.boardSquares[r][c]);
            }
        }
        
        const intersects = this.raycaster.intersectObjects(squares);
        if (intersects.length > 0) {
            const userData = intersects[0].object.userData;
            this.clickCallback(userData.row, userData.col);
        }
    }
    
    onSquareClick(callback) {
        this.clickCallback = callback;
    }
    
    onResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    clearIndicators() {
        while (this.indicatorsGroup.children.length > 0) {
            const child = this.indicatorsGroup.children[0];
            this.indicatorsGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
        this.checkIndicator = null;
    }
    
    showValidMoves(moves) {
        this.clearIndicators();
        const hoverGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const captureGeo = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
        captureGeo.rotateX(Math.PI / 2);
        
        const moveMat = new THREE.MeshBasicMaterial({ 
            color: 0x44ff44, 
            transparent: true, 
            opacity: 0.55,
            depthWrite: false
        });
        
        const captureMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        });
        
        moves.forEach(m => {
            const row = m.toRow;
            const col = m.toCol;
            const isCapture = m.isCapture;
            const mesh = new THREE.Mesh(isCapture ? captureGeo : hoverGeo, isCapture ? captureMat.clone() : moveMat.clone());
            mesh.position.set(col + 0.5, isCapture ? 0.2 : 0.3, (11 - row) + 0.5);
            this.indicatorsGroup.add(mesh);
        });
    }
    
    highlightLastMove(fromR, fromC, toR, toC) {
        const highlightGeo = new THREE.PlaneGeometry(1, 1);
        highlightGeo.rotateX(-Math.PI / 2);
        const highlightMat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.4,
            depthWrite: false
        });
        
        const fromMesh = new THREE.Mesh(highlightGeo, highlightMat);
        fromMesh.position.set(fromC + 0.5, 0.08, (11 - fromR) + 0.5);
        this.indicatorsGroup.add(fromMesh);
        
        const toMesh = new THREE.Mesh(highlightGeo, highlightMat.clone());
        toMesh.position.set(toC + 0.5, 0.08, (11 - toR) + 0.5);
        this.indicatorsGroup.add(toMesh);
    }
    
    showCheck(row, col) {
        const checkGeo = new THREE.PlaneGeometry(1, 1);
        checkGeo.rotateX(-Math.PI / 2);
        const checkMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });
        
        this.checkIndicator = new THREE.Mesh(checkGeo, checkMat);
        this.checkIndicator.position.set(col + 0.5, 0.08, (11 - row) + 0.5);
        this.indicatorsGroup.add(this.checkIndicator);
    }
    
    getOrCreateGeo(name, createFn) {
        if (!this.geometries[name]) {
            this.geometries[name] = createFn();
        }
        return this.geometries[name];
    }
    
    createPieceMesh(type, colorStr) {
        const group = new THREE.Group();
        const mat = colorStr === 'white' ? this.materials.white : this.materials.black;
        const isWhite = colorStr === 'white';
        
        const addPart = (geo, material, yPos) => {
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.y = yPos;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
        };

        if (type === 'pawn' || type === 'p') {
            const base = this.getOrCreateGeo('pawnBase', () => new THREE.CylinderGeometry(0.15, 0.2, 0.5, 16));
            const head = this.getOrCreateGeo('pawnHead', () => new THREE.SphereGeometry(0.15, 16, 16));
            addPart(base, mat, 0.25);
            addPart(head, mat, 0.55);
        }
        else if (type === 'rook' || type === 'r') {
            const base = this.getOrCreateGeo('rookBase', () => new THREE.CylinderGeometry(0.22, 0.25, 0.7, 16));
            addPart(base, mat, 0.35);
            // Crenellations
            const cren = this.getOrCreateGeo('rookCren', () => new THREE.BoxGeometry(0.1, 0.1, 0.1));
            for(let i=0; i<4; i++) {
                const angle = i * Math.PI / 2;
                const mesh = addPart(cren, mat, 0.75);
                mesh.position.x = Math.cos(angle) * 0.15;
                mesh.position.z = Math.sin(angle) * 0.15;
            }
        }
        else if (type === 'knight' || type === 'n') {
            const base = this.getOrCreateGeo('knightBase', () => new THREE.CylinderGeometry(0.2, 0.25, 0.4, 16));
            addPart(base, mat, 0.2);
            
            const head = this.getOrCreateGeo('knightHead', () => {
                const g = new THREE.BoxGeometry(0.15, 0.5, 0.25);
                g.translate(0, 0.25, 0);
                return g;
            });
            const headMesh = addPart(head, mat, 0.4);
            headMesh.rotation.x = Math.PI / 6;
            
            const nose = this.getOrCreateGeo('knightNose', () => new THREE.SphereGeometry(0.1, 16, 16));
            const noseMesh = addPart(nose, mat, 0.7);
            noseMesh.position.z = 0.15;
            
            // Face the correct way
            group.rotation.y = isWhite ? Math.PI : 0;
        }
        else if (type === 'bishop' || type === 'b') {
            const base = this.getOrCreateGeo('bishopBase', () => new THREE.CylinderGeometry(0.18, 0.22, 0.7, 16));
            addPart(base, mat, 0.35);
            
            const top = this.getOrCreateGeo('bishopTop', () => new THREE.ConeGeometry(0.12, 0.3, 16));
            addPart(top, mat, 0.85);
            
            const orb = this.getOrCreateGeo('bishopOrb', () => new THREE.SphereGeometry(0.05, 16, 16));
            addPart(orb, mat, 1.05);
        }
        else if (type === 'queen' || type === 'q') {
            const base = this.getOrCreateGeo('queenBase', () => new THREE.CylinderGeometry(0.2, 0.25, 0.8, 16));
            addPart(base, mat, 0.4);
            
            const crownSpike = this.getOrCreateGeo('queenSpike', () => new THREE.SphereGeometry(0.06, 16, 16));
            for(let i=0; i<5; i++) {
                const angle = i * Math.PI * 2 / 5;
                const mesh = addPart(crownSpike, mat, 0.85);
                mesh.position.x = Math.cos(angle) * 0.15;
                mesh.position.z = Math.sin(angle) * 0.15;
            }
            
            const crownTop = this.getOrCreateGeo('queenTop', () => new THREE.SphereGeometry(0.1, 16, 16));
            addPart(crownTop, mat, 0.85);
        }
        else if (type === 'king' || type === 'k') {
            const base = this.getOrCreateGeo('kingBase', () => new THREE.CylinderGeometry(0.2, 0.25, 0.8, 16));
            addPart(base, mat, 0.4);
            
            const dome = this.getOrCreateGeo('kingDome', () => new THREE.SphereGeometry(0.18, 16, 16));
            addPart(dome, mat, 0.85);
            
            const crossV = this.getOrCreateGeo('kingCrossV', () => new THREE.BoxGeometry(0.03, 0.2, 0.03));
            addPart(crossV, mat, 1.1);
            
            const crossH = this.getOrCreateGeo('kingCrossH', () => new THREE.BoxGeometry(0.12, 0.03, 0.03));
            addPart(crossH, mat, 1.1);
        }
        else if (type === 'tiger' || type === 't') {
            const tMat = isWhite ? this.materials.tigerWhite : this.materials.tigerBlack;
            const body = this.getOrCreateGeo('tigerBody', () => new THREE.CylinderGeometry(0.25, 0.3, 0.4, 16));
            addPart(body, tMat, 0.2);
            
            const head = this.getOrCreateGeo('tigerHead', () => new THREE.SphereGeometry(0.18, 16, 16));
            const headMesh = addPart(head, tMat, 0.45);
            headMesh.position.z = 0.15;
            
            const ear = this.getOrCreateGeo('tigerEar', () => new THREE.ConeGeometry(0.05, 0.1, 8));
            const earL = addPart(ear, tMat, 0.6);
            earL.position.set(-0.1, 0, 0.1);
            const earR = addPart(ear, tMat, 0.6);
            earR.position.set(0.1, 0, 0.1);
            
            group.rotation.y = isWhite ? Math.PI : 0;
        }
        else if (type === 'rooster' || type === 'c' /* for chicken/rooster */) {
            const rMat = isWhite ? this.materials.roosterWhite : this.materials.roosterBlack;
            const combMat = this.materials.roosterComb;
            
            const body = this.getOrCreateGeo('roosterBody', () => new THREE.CylinderGeometry(0.15, 0.2, 0.5, 16));
            addPart(body, rMat, 0.25);
            
            const comb = this.getOrCreateGeo('roosterComb', () => new THREE.ConeGeometry(0.08, 0.25, 8));
            addPart(comb, combMat, 0.625);
            
            const beak = this.getOrCreateGeo('roosterBeak', () => new THREE.ConeGeometry(0.05, 0.12, 8));
            const beakMesh = addPart(beak, combMat, 0.5);
            beakMesh.rotation.x = Math.PI / 2;
            beakMesh.position.z = 0.15;
            
            group.rotation.y = isWhite ? Math.PI : 0;
        }
        else {
            // Fallback
            const base = this.getOrCreateGeo('fallback', () => new THREE.BoxGeometry(0.4, 0.4, 0.4));
            addPart(base, mat, 0.2);
        }
        
        group.position.y = 0.075; // on top of board
        return group;
    }
    
    syncBoard(board, terrain, pieceSymbols) {
        // Clear pieces
        while (this.piecesGroup.children.length > 0) {
            const child = this.piecesGroup.children[0];
            this.piecesGroup.remove(child);
        }
        
        // Setup board colors/terrain
        const terrainColors = {
            'forest': 0x3a8a4a,
            'water': 0x3a7ab8,
            'temple': 0xb8a030
        };
        
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const square = this.boardSquares[r][c];
                const t = terrain && terrain[r] && terrain[r][c];
                
                if (t && terrainColors[t]) {
                    square.material.color.setHex(terrainColors[t]);
                } else {
                    square.material.color.setHex(square.userData.baseColor);
                }
                
                const piece = board[r][c];
                if (piece) {
                    const mesh = this.createPieceMesh(piece.type.toLowerCase(), piece.color);
                    mesh.position.x = c + 0.5;
                    mesh.position.z = (11 - r) + 0.5;
                    this.piecesGroup.add(mesh);
                }
            }
        }
    }
    
    setEnvironmentColors(mode) {
        let colors = {};
        if (mode === 'day') {
            colors = {
                bg: 0x87CEEB,
                hemiSky: 0x87CEEB, hemiGround: 0x445522, hemiIntensity: 0.6,
                dirColor: 0xffffff, dirIntensity: 0.8, dirPos: new THREE.Vector3(5, 15, 5),
                ambColor: 0x404040, ambIntensity: 0.4,
                starsOpacity: 0,
                groundColor: 0xc2a456,   // Sandy desert
                spotIntensity: 0.3       // Subtle spotlight
            };
        } else if (mode === 'sunset') {
            colors = {
                bg: 0x8b5a3a,           // Warm brown-amber (less orange)
                hemiSky: 0xc49060, hemiGround: 0x553322, hemiIntensity: 0.55,
                dirColor: 0xddaa77, dirIntensity: 0.7, dirPos: new THREE.Vector3(-5, 10, 5),
                ambColor: 0x443322, ambIntensity: 0.35,
                starsOpacity: 0,
                groundColor: 0xa07840,   // Warm sand
                spotIntensity: 0.4       // Board spotlight
            };
        } else if (mode === 'night') {
            colors = {
                bg: 0x0a0a2a,
                hemiSky: 0x1a2244, hemiGround: 0x0a0a1a, hemiIntensity: 0.25,
                dirColor: 0x6688cc, dirIntensity: 0.5, dirPos: new THREE.Vector3(3, 18, 8),
                ambColor: 0x1a1a33, ambIntensity: 0.25,
                starsOpacity: 1,
                groundColor: 0x2a2a40,   // Dark bluish ground
                spotIntensity: 0.8       // Strong moonlight spotlight on board
            };
        }
        return colors;
    }

    setEnvironment(mode) {
        const target = this.setEnvironmentColors(mode);
        
        // Capture current state
        const source = {
            bg: this.scene.background.getHex(),
            hemiSky: this.lights.hemi.color.getHex(),
            hemiGround: this.lights.hemi.groundColor.getHex(),
            hemiIntensity: this.lights.hemi.intensity,
            dirColor: this.lights.dir.color.getHex(),
            dirIntensity: this.lights.dir.intensity,
            dirPos: this.lights.dir.position.clone(),
            ambColor: this.lights.ambient.color.getHex(),
            ambIntensity: this.lights.ambient.intensity,
            starsOpacity: this.starsMat.opacity,
            groundColor: this.groundMat.color.getHex(),
            spotIntensity: this.boardSpotlight.intensity
        };
        
        this.envTransition = {
            active: true,
            progress: 0,
            duration: 2.0,
            source,
            target
        };
    }
    
    setBiome(name) {
        if (!this.biomeConfigs[name]) return;
        this.currentBiome = name;
        const config = this.biomeConfigs[name];
        
        // Transition ground color smoothly
        if (this.groundMat) {
            const targetColor = new THREE.Color(config.ground);
            // Use a simple tween approach via the animation loop
            this.groundTransition = {
                active: true,
                source: this.groundMat.color.clone(),
                target: targetColor,
                progress: 0,
                duration: 1.5
            };
        }
        
        // Remove old particles
        if (this.biomeParticles) {
            this.scene.remove(this.biomeParticles);
            if (this.biomeParticles.geometry) this.biomeParticles.geometry.dispose();
            if (this.biomeParticles.material) this.biomeParticles.material.dispose();
            this.biomeParticles = null;
        }
        
        // Create new particles
        if (config.particles) {
            const p = config.particles;
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array(p.count * 3);
            for (let i = 0; i < p.count * 3; i += 3) {
                positions[i] = (Math.random() - 0.5) * p.spread + 6;     // x centered on board
                positions[i+1] = Math.random() * p.height + (p.movement === 'rise' ? 0 : 2); // y
                positions[i+2] = (Math.random() - 0.5) * p.spread + 6;  // z centered on board
            }
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const mat = new THREE.PointsMaterial({
                color: p.color,
                size: p.size,
                transparent: true,
                opacity: 0.7,
                depthWrite: false
            });
            
            this.biomeParticles = new THREE.Points(geo, mat);
            this.biomeParticles.userData = { config: p };
            this.scene.add(this.biomeParticles);
        }
    }
    
    getAvailableBiomes() {
        return Object.keys(this.biomeConfigs);
    }
    
    startDayNightCycle(intervalSeconds) {
        this.dayNightCycle.active = true;
        this.dayNightCycle.interval = intervalSeconds;
        this.dayNightCycle.timer = 0;
    }
    
    stopDayNightCycle() {
        this.dayNightCycle.active = false;
        this.setEnvironment('day');
    }
    
    show() {
        this.container.style.display = 'block';
        this.onResize();
    }
    
    hide() {
        this.container.style.display = 'none';
    }
    
    isVisible() {
        return this.container.style.display !== 'none';
    }
    
    animate() {
        if (!this.animating) return;
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        
        if (!this.isVisible()) return;
        
        this.controls.update();
        
        // Animations
        if (this.checkIndicator) {
            const t = Date.now() * 0.005;
            this.checkIndicator.material.opacity = 0.3 + 0.4 * Math.sin(t);
        }
        
        // Env Transitions
        if (this.envTransition.active) {
            this.envTransition.progress += delta / this.envTransition.duration;
            const p = Math.min(this.envTransition.progress, 1.0);
            
            const s = this.envTransition.source;
            const t = this.envTransition.target;
            
            const cBg = new THREE.Color(s.bg).lerp(new THREE.Color(t.bg), p);
            this.scene.background.set(cBg);
            
            this.lights.hemi.color.set(new THREE.Color(s.hemiSky).lerp(new THREE.Color(t.hemiSky), p));
            this.lights.hemi.groundColor.set(new THREE.Color(s.hemiGround).lerp(new THREE.Color(t.hemiGround), p));
            this.lights.hemi.intensity = s.hemiIntensity + (t.hemiIntensity - s.hemiIntensity) * p;
            
            this.lights.dir.color.set(new THREE.Color(s.dirColor).lerp(new THREE.Color(t.dirColor), p));
            this.lights.dir.intensity = s.dirIntensity + (t.dirIntensity - s.dirIntensity) * p;
            this.lights.dir.position.lerpVectors(s.dirPos, t.dirPos, p);
            
            this.lights.ambient.color.set(new THREE.Color(s.ambColor).lerp(new THREE.Color(t.ambColor), p));
            this.lights.ambient.intensity = s.ambIntensity + (t.ambIntensity - s.ambIntensity) * p;
            
            this.starsMat.opacity = s.starsOpacity + (t.starsOpacity - s.starsOpacity) * p;
            
            // Ground and spotlight transitions
            if (t.groundColor !== undefined && this.groundMat) {
                this.groundMat.color.set(new THREE.Color(s.groundColor).lerp(new THREE.Color(t.groundColor), p));
            }
            if (t.spotIntensity !== undefined && this.boardSpotlight) {
                this.boardSpotlight.intensity = s.spotIntensity + (t.spotIntensity - s.spotIntensity) * p;
            }
            
            if (p >= 1.0) {
                this.envTransition.active = false;
            }
        }
        
        // Day Night Cycle
        if (this.dayNightCycle.active && !this.envTransition.active) {
            this.dayNightCycle.timer += delta;
            if (this.dayNightCycle.timer >= this.dayNightCycle.interval) {
                this.dayNightCycle.timer = 0;
                this.dayNightCycle.currentPhase = (this.dayNightCycle.currentPhase + 1) % this.dayNightCycle.phases.length;
                this.setEnvironment(this.dayNightCycle.phases[this.dayNightCycle.currentPhase]);
            }
        }
        
        // Biome particle animation
        if (this.biomeParticles && this.biomeParticles.userData.config) {
            const p = this.biomeParticles.userData.config;
            const positions = this.biomeParticles.geometry.attributes.position;
            const time = Date.now() * 0.001;
            
            for (let i = 0; i < positions.count; i++) {
                let y = positions.getY(i);
                let x = positions.getX(i);
                let z = positions.getZ(i);
                
                // Vertical movement
                y += p.speed * delta;
                
                // Horizontal sway
                x += Math.sin(time + i * 0.1) * p.sway * delta;
                z += Math.cos(time + i * 0.15) * p.sway * delta * 0.5;
                
                // Reset particles that go out of range
                if (p.movement === 'fall' && y < -0.5) {
                    y = p.height + Math.random() * 3;
                    x = (Math.random() - 0.5) * p.spread + 6;
                    z = (Math.random() - 0.5) * p.spread + 6;
                } else if (p.movement === 'rise' && y > p.height + 5) {
                    y = Math.random() * 2;
                    x = (Math.random() - 0.5) * p.spread + 6;
                    z = (Math.random() - 0.5) * p.spread + 6;
                } else if (p.movement === 'drift' && y < -0.5) {
                    y = p.height + Math.random() * 5;
                    x = (Math.random() - 0.5) * p.spread + 6;
                    z = (Math.random() - 0.5) * p.spread + 6;
                }
                
                positions.setXYZ(i, x, y, z);
            }
            positions.needsUpdate = true;
        }
        
        // Ground color transition
        if (this.groundTransition && this.groundTransition.active) {
            this.groundTransition.progress += delta / this.groundTransition.duration;
            const gp = Math.min(this.groundTransition.progress, 1.0);
            this.groundMat.color.copy(this.groundTransition.source).lerp(this.groundTransition.target, gp);
            if (gp >= 1.0) this.groundTransition.active = false;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose() {
        this.animating = false;
        
        window.removeEventListener('resize', this._onResize);
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('click', this._onClick);
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer.dispose();
        }
        
        Object.values(this.geometries).forEach(g => g.dispose());
        Object.values(this.materials).forEach(m => m.dispose());
        this.starsGeo.dispose();
        this.starsMat.dispose();
        
        this.scene.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        });
    }
}

window.ChessRenderer3D = ChessRenderer3D;
