import React, { useRef, useEffect, useState } from 'react';
import { Point2D, PieceType, FilamentMaterial, PieceDesign } from '../types';
import { interpolateProfile, enforceOverhangOnProfile } from '../utils/meshGenerator';
import { Plus, Trash, RotateCcw, ArrowRightLeft, HelpCircle, Eye, EyeOff } from 'lucide-react';
import ThreePreview from './ThreePreview';

interface ProfileEditorProps {
  type: PieceType;
  profilePoints: Point2D[];
  knightSidePoints: Point2D[];
  onChangePoints: (newPoints: Point2D[]) => void;
  onReset: () => void;
  design: PieceDesign;
  material: FilamentMaterial;
  showGrid: boolean;
  enforceOverhang?: boolean;
  scaleMultiplier?: number;
}

export default function ProfileEditor({
  type,
  profilePoints,
  knightSidePoints,
  onChangePoints,
  onReset,
  design,
  material,
  showGrid,
  enforceOverhang,
  scaleMultiplier = 50
}: ProfileEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [draggedPointId, setDraggedPointId] = useState<string | null>(null);
  const [showMini3D, setShowMini3D] = useState(true);
  
  // Knight has two sub-modes: either editing the pillar base (revolve) or the horse head profile (silhouette)
  const isKnight = type === 'knight';
  const [knightEditMode, setKnightEditMode] = useState<'base' | 'head'>('head');

  // Currently active working points
  const activePoints = isKnight && knightEditMode === 'head' ? knightSidePoints : profilePoints;

  // View limits inside canvas
  const xMin = isKnight && knightEditMode === 'head' ? -0.55 : -0.05;
  const xMax = isKnight && knightEditMode === 'head' ? 0.55 : 0.65;
  const yMin = -0.05;
  const yMax = 2.10;

  // Track coordinates for dragging and hovering
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);

  // Friendly anatomic names for the 12 points of the Knight's horse head
  const getKnightPointLabel = (index: number): string => {
    const labels = [
      'Back Neck Base',
      'Lower Mane',
      'Upper Mane',
      'Ear Back',
      'Ear Tip',
      'Forehead',
      'Snout Bridge',
      'Snout Tip',
      'Mouth / Chin',
      'Throat',
      'Chest Arc',
      'Front Collar Base'
    ];
    return labels[index] || `Point ${index}`;
  };

  useEffect(() => {
    // Whenever piece type changes, select the first point as default or deselect
    setSelectedPointId(null);
  }, [type, knightEditMode]);

  // Convert Canvas Pixel coords -> CAD Units
  const pixelToUnit = (px: number, py: number, width: number, height: number) => {
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const scale = Math.min(width / xRange, height / yRange);

    const xOffset = (width - xRange * scale) / 2;
    const yOffset = (height - yRange * scale) / 2;

    const uX = xMin + (px - xOffset) / scale;
    const uY = yMax - (py - yOffset) / scale; // Flip Y so 0 sits at bottom
    return { x: uX, y: uY };
  };

  // Convert CAD Units -> Canvas Pixel coords
  const unitToPixel = (ux: number, uy: number, width: number, height: number) => {
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const scale = Math.min(width / xRange, height / yRange);

    const xOffset = (width - xRange * scale) / 2;
    const yOffset = (height - yRange * scale) / 2;

    const px = xOffset + (ux - xMin) * scale;
    const py = yOffset + (yMax - uy) * scale;
    return { px, py };
  };

  // Main canvas draw effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#f8fafc'; // Clean workspace background
    ctx.fillRect(0, 0, width, height);

    // 1. DRAW COORD GRID LINES
    ctx.strokeStyle = '#cbd5e1'; // Distinct slate-300 lines for solid contrast on light bg
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b'; // Muted slate text labels
    ctx.font = '10px monospace';

    // Horizontal grid increments
    const yGridSteps = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    for (const yg of yGridSteps) {
      const { py } = unitToPixel(0, yg, width, height);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
      ctx.fillText(`${yg.toFixed(2)}`, 8, py - 4);
    }

    // Vertical grid increments
    const xGridSteps = isKnight && knightEditMode === 'head' 
      ? [-0.4, -0.2, 0.2, 0.4] 
      : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

    for (const xg of xGridSteps) {
      const { px } = unitToPixel(xg, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
      ctx.fillText(`${xg > 0 ? '+' : ''}${xg.toFixed(2)}`, px + 4, height - 8);
    }

    // 2. REVOLVE LATHE AXIS LINE (X = 0)
    const { px: axisPx } = unitToPixel(0, 0, width, height);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.5)'; // Blueprint Blue dashed axis
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(axisPx, 0);
    ctx.lineTo(axisPx, height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Revolve label
    ctx.fillStyle = '#2563eb'; // Blueprint blue text
    ctx.fillText('REVOLVE AXIS (X=0)', axisPx + 8, 16);

    // 3. SHADE SOLID PROFILE INTERIOR & DRAW EXTRUDED/INTERPOLATED OUTLINE
    if (activePoints.length >= 2) {
      ctx.lineWidth = 2;

      if (isKnight && knightEditMode === 'head') {
        // For the Knight Head, we have a closed loop. We fill and stroke the closed polygon!
        ctx.fillStyle = 'rgba(217, 119, 6, 0.08)'; // Warm amber filling
        ctx.strokeStyle = '#d97706'; // Amber outline
        
        ctx.beginPath();
        const p0 = unitToPixel(activePoints[0].x, activePoints[0].y, width, height);
        ctx.moveTo(p0.px, p0.py);

        for (let i = 1; i < activePoints.length; i++) {
          const pi = unitToPixel(activePoints[i].x, activePoints[i].y, width, height);
          ctx.lineTo(pi.px, pi.py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // For Revolve Profile, we interpolate points (Cardinal-Hermite splines)
        const density = interpolateProfile(activePoints, 8);
        const hasEnforce = !!enforceOverhang;
        const safeDensity = hasEnforce ? enforceOverhangOnProfile(density) : density;
        
        if (safeDensity.length >= 2) {
          // Draw solid backing shade from profile boundary to the central rotation axis (using active shape)
          ctx.beginPath();
          const startPt = unitToPixel(0, safeDensity[0].y, width, height);
          ctx.moveTo(startPt.px, startPt.py);

          for (const pt of safeDensity) {
            const pCoord = unitToPixel(pt.x, pt.y, width, height);
            ctx.lineTo(pCoord.px, pCoord.py);
          }

          // Complete closing of polygon to axis
          const endPt = unitToPixel(0, safeDensity[safeDensity.length - 1].y, width, height);
          ctx.lineTo(endPt.px, endPt.py);
          ctx.closePath();

          ctx.fillStyle = hasEnforce ? 'rgba(16, 185, 129, 0.05)' : 'rgba(37, 99, 235, 0.06)'; // Emerald or Blueprint Blue backing
          ctx.fill();

          // If enforce is enabled, draw the original unconstrained profile as a faint red-dotted line
          if (hasEnforce) {
            ctx.strokeStyle = 'rgba(220, 38, 38, 0.3)'; // Faint rosy red
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            const firstOrig = unitToPixel(density[0].x, density[0].y, width, height);
            ctx.moveTo(firstOrig.px, firstOrig.py);
            for (let k = 1; k < density.length; k++) {
              const oNode = unitToPixel(density[k].x, density[k].y, width, height);
              ctx.lineTo(oNode.px, oNode.py);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Helper to check if a segment is a print overhang/angle violation
          const isSegmentViolating = (ptA: {x: number, y: number}, ptB: {x: number, y: number}) => {
            if (ptB.y > ptA.y) {
              const dy = ptB.y - ptA.y;
              const dx = ptB.x - ptA.x;
              return dx > dy + 0.001;
            } else if (ptB.y === ptA.y) {
              return ptB.x > ptA.x;
            }
            return false;
          };

          // Stroke the boundary segments individually so we can color-code violations
          for (let k = 0; k < safeDensity.length - 1; k++) {
            const ptA = safeDensity[k];
            const ptB = safeDensity[k + 1];
            const pA = unitToPixel(ptA.x, ptA.y, width, height);
            const pB = unitToPixel(ptB.x, ptB.y, width, height);

            ctx.beginPath();
            ctx.moveTo(pA.px, pA.py);
            ctx.lineTo(pB.px, pB.py);

            if (hasEnforce) {
              // If enforce is ON, the active line is safe! Draw it in supportive Emerald Teal
              ctx.strokeStyle = '#10b981'; // Solid emerald
              ctx.lineWidth = 2.5;
            } else {
              // If enforce is OFF, highlight violating overhangs in Laser Red
              if (isSegmentViolating(ptA, ptB)) {
                ctx.strokeStyle = '#dc2626'; // Hot laser warning red
                ctx.lineWidth = 3;
              } else {
                ctx.strokeStyle = '#2563eb'; // Blueprint blue
                ctx.lineWidth = 2.5;
              }
            }
            ctx.stroke();
          }

          // Draw the control segment lines (dotted) linking actual sparse points
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'; // Slate lines
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          const seg0 = unitToPixel(activePoints[0].x, activePoints[0].y, width, height);
          ctx.moveTo(seg0.px, seg0.py);
          for (let i = 1; i < activePoints.length; i++) {
            const segI = unitToPixel(activePoints[i].x, activePoints[i].y, width, height);
            ctx.lineTo(segI.px, segI.py);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 4. DRAW NODE DOTS
    activePoints.forEach((pt, index) => {
      const { px, py } = unitToPixel(pt.x, pt.y, width, height);
      const isSelected = pt.id === selectedPointId;

      // Outer ring for selected point
      if (isSelected) {
        ctx.strokeStyle = '#0f172a'; // Ink Dark selected ring
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Main dot
      ctx.fillStyle = pt.isCurved ? '#10b981' : '#dc2626'; // Green for curve, laser red for corner
      if (isKnight && knightEditMode === 'head') {
        ctx.fillStyle = '#d97706'; // Amber for horse head control nodes
      }
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Border shine
      ctx.strokeStyle = '#ffffff'; // White border pop on light canvas grid
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.stroke();

      // Simple index label or name label beside the points
      ctx.fillStyle = isSelected ? '#0f172a' : '#64748b';
      ctx.font = '9.5px sans-serif';
      
      const labelText = isKnight && knightEditMode === 'head' 
        ? `${index}: ${getKnightPointLabel(index)}` 
        : `${index}`;

      ctx.fillText(labelText, px + 8, py + 3);
    });

    // 5. RENDERS CURSORS AND COORDINATES IN HUD
    if (hoverPosition) {
      ctx.fillStyle = '#64748b'; // Soft slate coordination
      ctx.font = '10px monospace';
      ctx.fillText(
        `X: ${hoverPosition.x.toFixed(3)}  Y: ${hoverPosition.y.toFixed(3)}`,
        width - 150,
        height - 12
      );
    }
  }, [activePoints, selectedPointId, hoverPosition, knightEditMode, type, enforceOverhang]);

  // Handle Mouse Move: hover coordinates and active dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Convert to CAD units
    const units = pixelToUnit(px, py, rect.width, rect.height);
    setHoverPosition(units);

    // Handle Dragging Point
    if (draggedPointId) {
      // Find the dragged point inside our active list
      const updated = activePoints.map(pt => {
        if (pt.id !== draggedPointId) return pt;

        let newX = units.x;
        let newY = units.y;

        // Apply Boundaries Constraints so parts don't go bizarre
        if (isKnight && knightEditMode === 'head') {
          // Horse head allows dual quadrant dragging [-0.5, 0.5]
          newX = Math.max(-0.5, Math.min(0.5, newX));
          newY = Math.max(0.6, Math.min(1.95, newY)); // Cannot slip under base pedestal
        } else {
          // Revolve points are strictly positive in radius X
          newX = Math.max(0.001, Math.min(0.6, newX));
          newY = Math.max(0.0, Math.min(2.0, newY));

          // Retain monotonic top/bottom base constraints
          if (pt.id === activePoints[0].id) {
            newX = Math.max(0.0, newX); // Base center must close nicely
            newY = 0.0; // Stick base to bottom bed!
          }
        }

        return { ...pt, x: newX, y: newY };
      });

      onChangePoints(updated);
    }
  };

  // Handle Mouse Down: select or click-to-add
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Radius detection in pixels (14 pixels click-box)
    const clickRadius = 14;
    let clickedPointNode: Point2D | null = null;

    for (const pt of activePoints) {
      const pPx = unitToPixel(pt.x, pt.y, rect.width, rect.height);
      const dx = px - pPx.px;
      const dy = py - pPx.py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= clickRadius) {
        clickedPointNode = pt;
        break;
      }
    }

    if (clickedPointNode) {
      setSelectedPointId(clickedPointNode.id);
      setDraggedPointId(clickedPointNode.id);
    } else {
      // Clicked in empty space - DESELECT or ADD a point along the vector lines!
      setSelectedPointId(null);

      const units = pixelToUnit(px, py, rect.width, rect.height);
      const clickTolerance = 0.045; // Unit tolerance

      // Build listing of segments we can insert points into
      const segmentsToCheck: { pA: Point2D; pB: Point2D; insertIndex: number }[] = [];
      for (let i = 0; i < activePoints.length - 1; i++) {
        segmentsToCheck.push({
          pA: activePoints[i],
          pB: activePoints[i + 1],
          insertIndex: i + 1
        });
      }
      
      // If the horse head is active, it forms a closed loop, so we must check the closing segment as well!
      if (isKnight && knightEditMode === 'head') {
        segmentsToCheck.push({
          pA: activePoints[activePoints.length - 1],
          pB: activePoints[0],
          insertIndex: activePoints.length
        });
      }

      for (const seg of segmentsToCheck) {
        const { pA, pB, insertIndex } = seg;

        // Match point on line segment
        // Simple projection distance calculation
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        // Project clicked point on segment line
        const t = Math.max(0, Math.min(1, ((units.x - pA.x) * dx + (units.y - pA.y) * dy) / lenSq));
        const projX = pA.x + t * dx;
        const projY = pA.y + t * dy;

        const dist = Math.sqrt((units.x - projX) ** 2 + (units.y - projY) ** 2);

        if (dist <= clickTolerance && t > 0.08 && t < 0.92) {
          // Success! Create a new point node and splice it in the sequence
          const newId = `pt-new-${Date.now()}`;
          const newPt: Point2D = {
            id: newId,
            x: Number(projX.toFixed(3)),
            y: Number(projY.toFixed(3)),
            isCurved: false // Default to sharp corner for horse head, clean node splits
          };

          const clone = [...activePoints];
          clone.splice(insertIndex, 0, newPt);
          onChangePoints(clone);
          setSelectedPointId(newId);
          break;
        }
      }
    }
  };

  // Drag termination
  const handleMouseUp = () => {
    setDraggedPointId(null);
  };

  const selectedPoint = activePoints.find(p => p.id === selectedPointId);

  // Deletes active node
  const handleDeletePoint = () => {
    if (!selectedPointId) return;

    // Minimum 3 points required for valid solids
    if (activePoints.length <= 3) return;

    // Boundary points should not be deleted for revolve profiles to avoid breaking closures
    if (!(isKnight && knightEditMode === 'head')) {
      if (selectedPointId === activePoints[0].id || selectedPointId === activePoints[activePoints.length - 1].id) {
        return;
      }
    }

    const filtered = activePoints.filter(p => p.id !== selectedPointId);
    onChangePoints(filtered);
    setSelectedPointId(null);
  };

  // Toggle point curved node parameter
  const handleToggleCurve = () => {
    if (!selectedPointId) return;

    const modified = activePoints.map(p => {
      if (p.id !== selectedPointId) return p;
      return { ...p, isCurved: !p.isCurved };
    });

    onChangePoints(modified);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-200">
        <div>
          <h2 className="text-xs font-display font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
            <span>2D CAD Profile Designer</span>
            <span className="text-[10px] bg-blue-550/10 bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-0.5 rounded-full uppercase font-mono font-extrabold">
              {type}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isKnight && knightEditMode === 'head' 
              ? 'Stylize the side profile of the horse. Drag any of the 12 key points.'
              : 'Add nodes by clicking on the line. Drag nodes to reshape and lathe.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* KNIGHT TOGGLE BUTTONS */}
          {isKnight && (
            <div className="flex border border-slate-200 bg-slate-50 p-0.5 rounded-lg mr-2">
              <button
                id="knight-edit-head"
                type="button"
                onClick={() => setKnightEditMode('head')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  knightEditMode === 'head'
                    ? 'bg-white text-amber-700 border border-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 border border-transparent'
                }`}
              >
                Horse Head
              </button>
              <button
                id="knight-edit-base"
                type="button"
                onClick={() => setKnightEditMode('base')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  knightEditMode === 'base'
                    ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 border border-transparent'
                }`}
              >
                Round Base
              </button>
            </div>
          )}

          <button
            id="reset-active-profile"
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-[11px] bg-white hover:bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all cursor-pointer shadow-sm"
            title="Restore default archetype dimensions"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            Reset Initial
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-4 relative">
        {/* CANVAS EDITOR STAGE */}
        <div className="flex-grow relative flex items-center justify-center bg-white bg-grid-pattern rounded-xl border border-slate-200 shadow-inner overflow-hidden min-h-[460px] select-none">
          <canvas
            ref={canvasRef}
            width={460}
            height={460}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="block cursor-crosshair max-w-full"
            id="canvas-lathe-grid-editor"
          />

          {/* HELP OVERLAY POP */}
          <div className="absolute top-2.5 right-2.5 group pointer-events-auto">
            <div className="p-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-full cursor-pointer hover:bg-slate-50 hover:text-slate-900 text-slate-500 shadow-sm">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="absolute right-0 top-8 w-60 p-3.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-xl leading-relaxed">
              <p className="font-bold mb-1.5 text-slate-900 uppercase tracking-wider text-[10px] text-blue-600">CAD Editor Tips:</p>
              {isKnight && knightEditMode === 'head' ? (
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                  <li>The Knight head uses a custom template with 12 linked anatomy points.</li>
                  <li>Drag the ears, chest, chin, nose, and mane points to sculpt!</li>
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                  <li>Click directly **on a line** to add a new point node anywhere.</li>
                  <li>Click a point node circle to select it for adjustments.</li>
                  <li>Hover near nodes to read precise sub-millimeter CAD coordinates.</li>
                </ul>
              )}
            </div>
          </div>

          {/* PIP 3D PREVIEW CORNER VIEWPORT */}
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 z-30 pointer-events-auto">
            {showMini3D ? (
              <div className="relative w-[190px] h-[190px] shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white hover:border-blue-500/35 transition-all flex flex-col">
                {/* Header minimize click overlay */}
                <div 
                  id="pip-3d-minimize"
                  onClick={() => setShowMini3D(false)}
                  className="absolute top-2 right-2 z-40 bg-white/95 hover:bg-slate-55 border border-slate-200 p-1.5 rounded-full cursor-pointer hover:text-slate-900 text-slate-500 shadow-md pointer-events-auto transition-all"
                  title="Minimize 3D View"
                >
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                </div>
                <div className="flex-1 w-full h-full min-h-0 bg-transparent">
                  <ThreePreview
                    design={design}
                    material={material}
                    showGrid={showGrid}
                  />
                </div>
              </div>
            ) : (
              <button
                id="pip-3d-restore"
                type="button"
                onClick={() => setShowMini3D(true)}
                className="bg-white/95 hover:bg-slate-50 border border-slate-200 hover:border-blue-500/35 text-blue-600 hover:text-blue-700 px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-md cursor-pointer pointer-events-auto"
                title="Restore 3D View"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-display uppercase tracking-wider text-[10px]">Show 3D View</span>
              </button>
            )}
          </div>
        </div>

        {/* PROPERTIES AND ACTION CONTROLS - SITS UNDER THE CAD CANVAS DISPLAY */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between min-h-[64px] shadow-sm">
          {selectedPoint ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex flex-col border-r border-slate-200 pr-4">
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold tracking-widest leading-none">Node Coords</span>
                  <span className="font-mono text-blue-600 font-bold mt-1 text-[13px]">
                    X: {(selectedPoint.x * scaleMultiplier).toFixed(1)} mm • Y: {(selectedPoint.y * scaleMultiplier).toFixed(1)} mm
                  </span>
                </div>
                
                {isKnight && knightEditMode === 'head' ? (
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold font-mono leading-none">Anatomy Part</span>
                    <span className="text-xs text-amber-700 font-extrabold uppercase leading-snug mt-1">
                      {getKnightPointLabel(activePoints.indexOf(selectedPoint))}
                    </span>
                  </div>
                ) : null}
              </div>              <div className="flex items-center gap-2.5">
                {!(isKnight && knightEditMode === 'head') ? (
                  <button
                    id="float-curve-toggle"
                    type="button"
                    onClick={handleToggleCurve}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-sm ${
                      selectedPoint.isCurved
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-white border-slate-200 text-slate-750 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>Segment Mode:</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[9px] uppercase font-bold opacity-90 text-slate-700">
                      {selectedPoint.isCurved ? 'Smooth' : 'Straight'}
                    </span>
                  </button>
                ) : null}

                <button
                  id="float-delete-action"
                  type="button"
                  onClick={handleDeletePoint}
                  disabled={
                    activePoints.length <= 3 ||
                    (!(isKnight && knightEditMode === 'head') && (selectedPointId === activePoints[0].id || selectedPointId === activePoints[activePoints.length - 1].id))
                  }
                  className="flex items-center gap-1.5 text-xs bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-300 py-1.5 px-3 rounded-lg transition-all font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Delete Node
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/40 animate-pulse" />
              <span>Click any node circle to edit coordinates • Double-click line to insert node</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
