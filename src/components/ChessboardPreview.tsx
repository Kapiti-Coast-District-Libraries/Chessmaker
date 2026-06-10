import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PieceDesign, PieceType } from '../types';
import { generatePieceMesh } from '../utils/meshGenerator';

interface ChessboardPreviewProps {
  pieces: Record<PieceType, PieceDesign>;
  enforceOverhang?: boolean;
}

export default function ChessboardPreview({ pieces, enforceOverhang }: ChessboardPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene, Camera, and WebGL Renderer
    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Pristine Slate-50 workspace background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
    camera.position.set(0, 4.5, 6.0); // Balanced angled view

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Interactive OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.0;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't allow camera to clip below board
    controls.target.set(0, 0.2, 0);
    controlsRef.current = controls;

    // 3. Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Warm key light
    const keyLight = new THREE.DirectionalLight(0xfffaed, 0.9);
    keyLight.position.set(3, 5, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    // Cool fill light
    const fillLight = new THREE.DirectionalLight(0xdcefff, 0.4);
    fillLight.position.set(-4, 3, -1);
    scene.add(fillLight);

    // Edge glowing spot light
    const spotLight = new THREE.SpotLight(0xffffff, 0.8);
    spotLight.position.set(0, 7, 0);
    spotLight.angle = Math.PI / 3;
    spotLight.penumbra = 0.8;
    scene.add(spotLight);

    // 4. GENERATING THE CHESSBOARD
    const squareSize = 0.55;
    const halfBoard = (8 * squareSize) / 2;

    // Board Base (Border Frame)
    const boardThickness = 0.15;
    const frameSize = 8 * squareSize + 0.3;
    const boardBaseGeo = new THREE.BoxGeometry(frameSize, boardThickness, frameSize);
    const boardBaseMat = new THREE.MeshStandardMaterial({
      color: 0x2b1e15, // Deep Mahogany
      roughness: 0.18,
      metalness: 0.1,
    });
    const boardBase = new THREE.Mesh(boardBaseGeo, boardBaseMat);
    boardBase.position.y = -boardThickness / 2;
    boardBase.receiveShadow = true;
    scene.add(boardBase);

    // Light and Dark Square materials
    const lightSquareMat = new THREE.MeshStandardMaterial({
      color: 0xf5ebd0, // Maple Cream
      roughness: 0.15,
      metalness: 0.05,
    });
    const darkSquareMat = new THREE.MeshStandardMaterial({
      color: 0x4d3224, // dark Walnut
      roughness: 0.25,
      metalness: 0.05,
    });

    const squaresGeo = new THREE.BoxGeometry(squareSize, 0.03, squareSize);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 1;
        const squareMesh = new THREE.Mesh(squaresGeo, isLight ? lightSquareMat : darkSquareMat);
        
        // Position centering the board around (0,0)
        squareMesh.position.set(
          -halfBoard + c * squareSize + squareSize / 2,
          0.015,
          -halfBoard + r * squareSize + squareSize / 2
        );
        squareMesh.receiveShadow = true;
        scene.add(squareMesh);
      }
    }

    // 5. CACHING CUSTOM PIECE GEOMETRIES
    // We generate standard BufferGeometries from the user's custom designs.
    const geometries: Record<PieceType, THREE.BufferGeometry> = {} as any;
    
    Object.keys(pieces).forEach((key) => {
      const type = key as PieceType;
      const meshData = generatePieceMesh(pieces[type], 6, enforceOverhang);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
      
      // Scale down the pieces to fit perfectly on the 0.55-unit squares
      // Profile standard bounds were around H=1.8, R=0.45.
      // We scale them down by ~0.2x to correspond nicely
      geo.scale(0.24, 0.24, 0.24);
      
      geometries[type] = geo;
    });

    // 6. INSTANTIATING THE 32 PIECES IN SITU
    // White Materials (Glossy Ivory)
    const whitePieceMat = new THREE.MeshStandardMaterial({
      color: 0xefede8,
      roughness: 0.15,
      metalness: 0.05,
    });

    // Black Materials (Polished Slate / Obsidian)
    const blackPieceMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c1e,
      roughness: 0.22,
      metalness: 0.15,
    });

    // Starting Layout Mapping (from rank 1 to 8, which translates to row index 0 to 7)
    // Row 0: White Main, Row 1: White Pawns, Rows 2-5: Empty, Row 6: Black Pawns, Row 7: Black Main
    const backRowOrder: PieceType[] = [
      'rook',
      'knight',
      'bishop',
      'queen',
      'king',
      'bishop',
      'knight',
      'rook',
    ];

    const piecesContainer = new THREE.Group();
    scene.add(piecesContainer);

    const spawnPieceInSquare = (type: PieceType, row: number, col: number, isWhite: boolean) => {
      const geo = geometries[type];
      const mat = isWhite ? whitePieceMat : blackPieceMat;
      const mesh = new THREE.Mesh(geo, mat);

      // Grid position
      const posX = -halfBoard + col * squareSize + squareSize / 2;
      const posZ = -halfBoard + row * squareSize + squareSize / 2;
      
      mesh.position.set(posX, 0.03, posZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Rotate Knights to face each other (White faces North, Black faces South)
      if (type === 'knight') {
        mesh.rotation.y = isWhite ? 0 : Math.PI;
      } else {
        // Subtle random rotation for raw realism
        mesh.rotation.y = (Math.random() - 0.5) * 0.05;
      }

      piecesContainer.add(mesh);
    };

    // Spawn Rank 1 & 2 (Row 0 & 1 - White)
    for (let col = 0; col < 8; col++) {
      spawnPieceInSquare(backRowOrder[col], 0, col, true);
      spawnPieceInSquare('pawn', 1, col, true);
    }

    // Spawn Rank 7 & 8 (Row 6 & 7 - Black)
    for (let col = 0; col < 8; col++) {
      spawnPieceInSquare('pawn', 6, col, false);
      spawnPieceInSquare(backRowOrder[col], 7, col, false);
    }

    // 7. Animation Run Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Resizing
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
      Object.values(geometries).forEach(geo => geo.dispose());
      boardBaseGeo.dispose();
      boardBaseMat.dispose();
      lightSquareMat.dispose();
      darkSquareMat.dispose();
      squaresGeo.dispose();
      whitePieceMat.dispose();
      blackPieceMat.dispose();
    };
  }, [pieces, enforceOverhang]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex-grow select-none rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      <div ref={containerRef} className="w-full h-full" id="situ-board-preview" />
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-md pointer-events-none">
        <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">BOARD PREVIEW IN SITU</p>
        <p className="text-[11px] text-slate-600 font-mono">
          Interactive full court layout • Left-click & Drag to rotate • Scroll to zoom
        </p>
      </div>
    </div>
  );
}
