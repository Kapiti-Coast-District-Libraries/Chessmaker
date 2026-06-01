import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FilamentMaterial, PieceDesign } from '../types';
import { generatePieceMesh } from '../utils/meshGenerator';

interface ThreePreviewProps {
  design: PieceDesign;
  material: FilamentMaterial;
  showGrid: boolean;
  enforceOverhang?: boolean;
}

export default function ThreePreview({ design, material, showGrid, enforceOverhang }: ThreePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Material mapper - Returns pristine high-contrast gloss white resin material
  const getMaterial = (): THREE.Material => {
    return new THREE.MeshStandardMaterial({
      color: 0xfafafa, // Solid pure white
      metalness: 0.08,
      roughness: 0.18,
      shadowSide: THREE.DoubleSide,
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Scene, Camera & WebGL Renderer
    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // Pure pristine white workspace background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
    camera.position.set(0, 1.8, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't look under the bed too much
    controls.minDistance = 1.0;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0.9, 0);
    controlsRef.current = controls;

    // 3. Add Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.82);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeef6ff, 0.45);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // Rim light to make details and silhouettes pop
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 3, -4);
    scene.add(rimLight);

    // 4. Simulated Printer Bed Plate (Grid Helper with clean bright/light lines for white bg)
    const gridHelper = new THREE.GridHelper(2.5, 25, 0x888888, 0xdddddd);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 5. Initial piece Mesh
    const meshData = generatePieceMesh(design, 6, enforceOverhang);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

    const materialRef = getMaterial();
    const mesh = new THREE.Mesh(geometry, materialRef);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshRef.current = mesh;

    // 6. Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 7. Handles Resizing
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
      geometry.dispose();
    };
  }, []);

  // Update Geometry trigger
  useEffect(() => {
    if (!meshRef.current) return;

    const meshData = generatePieceMesh(design, 6, enforceOverhang);
    const geometry = meshRef.current.geometry;
    
    // Dispose old attributes
    geometry.dispose();

    // Set new shape attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }, [design, enforceOverhang]);

  // Update Grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  return (
    <div className="relative w-full h-full select-none rounded-xl overflow-hidden bg-white border border-slate-200">
      <div ref={containerRef} className="w-full h-full" id="three-dimension-canvas" />
      <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded border border-slate-200 shadow-sm pointer-events-none select-none">
        <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">3D Preview</p>
      </div>
    </div>
  );
}
