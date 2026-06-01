/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  PieceType, 
  PieceDesign, 
  FilamentMaterial, 
  Point2D 
} from './types';
import { DEFAULT_PIECES } from './constants/defaultProfiles';
import { 
  generatePieceMesh, 
  exportToSTL, 
  downloadMeshFile 
} from './utils/meshGenerator';

import ProfileEditor from './components/ProfileEditor';
import ThreePreview from './components/ThreePreview';
import ChessboardPreview from './components/ChessboardPreview';

import { 
  Crown, 
  Sparkles, 
  Download, 
  Grid, 
  Eye, 
  Info, 
  Settings2, 
  Printer, 
  CircleDot, 
  Maximize2,
  ListRestart
} from 'lucide-react';

export default function App() {
  // Main app states
  const [pieces, setPieces] = useState<Record<PieceType, PieceDesign>>(JSON.parse(JSON.stringify(DEFAULT_PIECES)));
  const [selectedPiece, setSelectedPiece] = useState<PieceType>('rook');
  const [material] = useState<FilamentMaterial>('white-gloss');
  const [viewMode, setViewMode] = useState<'editor' | 'board'>('editor');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [enforceOverhang, setEnforceOverhang] = useState<boolean>(true);

  const activeDesign = pieces[selectedPiece];

  // Helper to calculate piece height based on actual mesh coordinates in CAD designer (1.0 CAD unit = 50.0 mm)
  const getPieceHeightMm = (design: PieceDesign, overhangOption: boolean) => {
    const meshData = generatePieceMesh(design, 6, overhangOption);
    let minY = Infinity;
    let maxY = -Infinity;
    const verts = meshData.vertices;
    for (let i = 1; i < verts.length; i += 3) {
      const yVal = verts[i];
      if (yVal < minY) minY = yVal;
      if (yVal > maxY) maxY = yVal;
    }
    if (minY === Infinity || maxY === -Infinity) return 50;
    return Math.round((maxY - minY) * 50);
  };

  const scaleMm = getPieceHeightMm(activeDesign, enforceOverhang);

  // Helper to handle coordinate updates
  const handlePointsChange = (newPoints: Point2D[]) => {
    setPieces(prev => {
      const updated = { ...prev };
      if (selectedPiece === 'knight' && activeDesign.knightSidePoints.length > 0) {
        // Checking if editor was modulating the closed horse head or the round revolve plate
        const isHeadEditing = newPoints.length === activeDesign.knightSidePoints.length;
        if (isHeadEditing) {
          updated[selectedPiece] = {
            ...activeDesign,
            knightSidePoints: newPoints
          };
        } else {
          updated[selectedPiece] = {
            ...activeDesign,
            profilePoints: newPoints
          };
        }
      } else {
        updated[selectedPiece] = {
          ...activeDesign,
          profilePoints: newPoints
        };
      }
      return updated;
    });
  };

  // Restore active piece archetype parameters
  const handleResetPiece = () => {
    setPieces(prev => ({
      ...prev,
      [selectedPiece]: JSON.parse(JSON.stringify(DEFAULT_PIECES[selectedPiece]))
    }));
  };

  // Restore ALL archetypes
  const handleResetAll = () => {
    if (confirm("Are you sure you want to restore the entire chess set to factory starting dimensions? Your custom designs will be reset.")) {
      setPieces(JSON.parse(JSON.stringify(DEFAULT_PIECES)));
    }
  };

  // Trigger STL CAD download
  const handleExportSTL = (typeToExport: PieceType) => {
    const targetDesign = pieces[typeToExport];
    const meshData = generatePieceMesh(targetDesign, 6, enforceOverhang);
    const filename = `chess_designer_${typeToExport}_${scaleMm}mm.stl`;
    const stlContent = exportToSTL(meshData.vertices, meshData.indices, typeToExport, scaleMm);
    downloadMeshFile(stlContent, filename);
  };

  // Helper to estimate filament print specs
  const getFilamentEstimate = () => {
    const scaleFactor = scaleMm / 50; // default anchor weight
    let baseWeight = 8; // in grams
    switch (selectedPiece) {
      case 'pawn': baseWeight = 4; break;
      case 'rook': baseWeight = 11; break;
      case 'bishop': baseWeight = 10; break;
      case 'knight': baseWeight = 12; break;
      case 'queen': baseWeight = 16; break;
      case 'king': baseWeight = 19; break;
    }
    const weight = Math.round(baseWeight * (scaleFactor ** 3));
    const timeMins = Math.round(weight * 3.5 + 10);
    return {
      weight,
      timeMins,
      layers: Math.round(scaleMm / 0.16) // assuming 0.16mm layer height
    };
  };

  const currentEstimates = getFilamentEstimate();

  // Dynamic bounds for real-time CAD metrics in bottom info footer
  const getMaxDiameter = () => {
    if (!activeDesign.profilePoints || activeDesign.profilePoints.length === 0) return '0.0';
    const maxVal = activeDesign.profilePoints.reduce((max, p) => p.x > max ? p.x : max, 0);
    return (maxVal * 100).toFixed(1);
  };

  const getPieceUnicode = (type: PieceType): string => {
    switch (type) {
      case 'pawn': return '♟';
      case 'rook': return '♜';
      case 'knight': return '♞';
      case 'bishop': return '♝';
      case 'queen': return '♛';
      case 'king': return '♚';
      default: return '♟';
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-white">
      {/* GLOBAL HEADER BAR */}
      <header className="h-14 border-b border-slate-800 bg-[#161920] px-6 flex items-center justify-between gap-4 z-40 select-none shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center text-slate-950 font-bold shadow-sm">
            <span className="text-xl leading-none">♔</span>
          </div>
          <div>
            <h1 className="text-sm font-display font-bold tracking-tight text-slate-100 flex items-center gap-2">
              LATHE<span className="text-cyan-500 underline underline-offset-4 decoration-2">CHESS</span> v2.0
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-medium tracking-normal">CAM-READY</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">Lathe profiles in 2D, carve custom features, and export watertight STL meshes</p>
          </div>
        </div>

        {/* TOP LEVEL NAVIGATION AND GLOBAL RESTORE */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-md p-1">
            <button
              id="view-mode-editor"
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded transition-all ${
                viewMode === 'editor'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-cyan-400" />
              CAD Editor
            </button>
            <button
              id="view-mode-board"
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded transition-all ${
                viewMode === 'board'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              Board Preview
            </button>
          </div>

          <button
            id="reset-entire-set"
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 border text-slate-300 hover:text-rose-400 transition-colors font-medium px-3 py-1.5 rounded-lg"
            title="Reset Chess templates back to default"
          >
            <ListRestart className="w-3.5 h-3.5 text-slate-400" />
            Reset Set
          </button>
        </div>
      </header>

       {viewMode === 'board' ? (
        /* IN SITU BOARD PREVIEW FULL STAGE */
        <main className="flex-grow flex flex-col p-6 max-w-7xl mx-auto w-full gap-6 animate-fade-in">
          <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 bg-[#161920] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="max-w-md flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full font-display">
                  Virtual Showcase Board
                </span>
                <h2 className="text-xl font-display font-bold text-white mt-4 tracking-tight">Your Customized Chess Set</h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Every lathe profile, bishop notch, and knight anatomy sculpt you adjusted in the editor is compiled in real-time. 
                  They are mirrored below in custom contrasting maple ivory and deep shale stone textures.
                </p>

                <div className="mt-6 space-y-3.5 bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <h3 className="text-xs font-display font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-400" /> Print Suite Checklist
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Once you verify the proportions on the active board, you can batch download individual watertight 3D models.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono">
                      <div className="text-[9px] text-slate-500 font-semibold">SET PIECES</div>
                      <div className="text-xs font-extrabold text-cyan-400">32 Total</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono">
                      <div className="text-[9px] text-slate-500 font-semibold">SCALE ANCHOR</div>
                      <div className="text-xs font-extrabold text-cyan-400">1:1 Millimeter</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BATCH DOWNLOADS */}
              <div className="mt-8 border-t border-slate-800 pt-6">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3 block font-display">Export Models</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(pieces).map(pk => {
                    const type = pk as PieceType;
                    return (
                      <button
                        key={type}
                        id={`export-btn-${type}`}
                        type="button"
                        onClick={() => handleExportSTL(type)}
                        className="flex items-center justify-between bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-cyan-500/40 rounded-lg p-2.5 text-xs font-semibold text-slate-200 hover:text-cyan-400 transition-all capitalize cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-normal">{getPieceUnicode(type)}</span>
                          {type} STL
                        </span>
                        <Download className="w-3.5 h-3.5 text-cyan-500" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* FULL BOARD PREVIEW */}
            <div className="flex-grow flex flex-col h-[525px]">
              <ChessboardPreview pieces={pieces} enforceOverhang={enforceOverhang} />
            </div>
          </div>
        </main>
      ) : (
        /* STANDARD 2D CAD EDITOR + LIVE 3D PREVIEW */
        <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-5 px-6 py-5 max-w-[1600px] mx-auto w-full">
          {/* LEFT: PIECE SELECTOR NAVIGATION BAR */}
          <nav className="lg:col-span-2 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none bg-[#161920] p-4 rounded-xl border border-slate-805">
            <p className="hidden lg:block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-2 mb-1.5 font-display">Chess Pieces</p>
            {(['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'] as PieceType[]).map(type => {
              const active = selectedPiece === type;
              return (
                <button
                  key={type}
                  id={`nav-piece-${type}`}
                  type="button"
                  onClick={() => setSelectedPiece(type)}
                  className={`flex items-center gap-3 w-full text-left p-3 rounded-xl transition-all border text-xs font-semibold shrink-0 lg:shrink cursor-pointer select-none ${
                    active
                      ? 'ring-2 ring-cyan-500 bg-cyan-500/10 text-cyan-400 border-transparent shadow-md font-display'
                      : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg ${
                    active ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}>
                    {getPieceUnicode(type)}
                  </div>
                  <div className="flex-grow">
                    <div className={`capitalize font-bold ${active ? 'text-cyan-400' : 'text-slate-200'}`}>{type}</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      {type === 'knight' ? 'Extruded Sculpt' : 'Lathe Revolve'}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Chess pieces item selection list ends here */}
          </nav>

          {/* MIDDLE: 2D VECTOR GRID LATHE EDITOR */}
          <section className="lg:col-span-7 h-full flex flex-col min-h-[450px]">
            <ProfileEditor
              type={selectedPiece}
              profilePoints={activeDesign.profilePoints}
              knightSidePoints={activeDesign.knightSidePoints}
              onChangePoints={handlePointsChange}
              onReset={handleResetPiece}
              design={activeDesign}
              material={material}
              showGrid={showGrid}
              enforceOverhang={enforceOverhang}
            />
          </section>

          {/* RIGHT: CAD PRINT PARAMETERS & CONFIG PANELS */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            {/* CALIBRATOR CONTROLS CARD */}
            <div className="bg-[#161920] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs font-display font-bold uppercase tracking-widest text-slate-400 mb-3.5 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-cyan-400" /> Shape Carvings & Settings
                </h3>

                {/* Grid Bed Switcher Control in settings box */}
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-850/80 mb-2">
                  <label htmlFor="bed-grid-toggle" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">Show 3D Print Bed Grid</label>
                  <input
                    id="bed-grid-toggle"
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer pointer-events-auto"
                  />
                </div>

                {/* Overhang Limiter Switcher Control under Grid Box */}
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-850/80 mb-3.5">
                  <div className="flex flex-col select-none">
                    <label htmlFor="overhang-toggle" className="text-xs font-semibold text-slate-200 cursor-pointer leading-tight flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${enforceOverhang ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      Enforce 45° Overhang
                    </label>
                    <span className="text-[9px] text-slate-500 font-medium leading-normal mt-0.5">Supportless 3D Print Alignment</span>
                  </div>
                  <input
                    id="overhang-toggle"
                    type="checkbox"
                    checked={enforceOverhang}
                    onChange={(e) => setEnforceOverhang(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer pointer-events-auto"
                  />
                </div>

                {/* rook parameters */}
                {selectedPiece === 'rook' && (
                  <div className="space-y-3.5 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                    <div className="flex items-center justify-between">
                      <label htmlFor="rook-notch-count" className="text-xs font-semibold text-slate-300">Crenellation Count</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                        {activeDesign.rookNotchCount} Notches
                      </span>
                    </div>
                    <input
                      id="rook-notch-count"
                      type="range"
                      min={4}
                      max={12}
                      step={2}
                      value={activeDesign.rookNotchCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          rook: { ...prev.rook, rookNotchCount: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="rook-notch-depth" className="text-xs font-semibold text-slate-300">Crenellation Depth</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.rookNotchDepth * 50)} mm
                      </span>
                    </div>
                    <input
                      id="rook-notch-depth"
                      type="range"
                      min={0.05}
                      max={0.35}
                      step={0.01}
                      value={activeDesign.rookNotchDepth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          rook: { ...prev.rook, rookNotchDepth: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="rook-bore-radius" className="text-xs font-semibold text-slate-300">Inner Core Hollow Radius</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.rookBoreRadius * 50)} mm
                      </span>
                    </div>
                    <input
                      id="rook-bore-radius"
                      type="range"
                      min={0.08}
                      max={0.30}
                      step={0.01}
                      value={activeDesign.rookBoreRadius}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          rook: { ...prev.rook, rookBoreRadius: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                )}

                {/* bishop parameters */}
                {selectedPiece === 'bishop' && (
                  <div className="space-y-3.5 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                    <div className="flex items-center justify-between">
                      <label htmlFor="bishop-slit-depth" className="text-xs font-semibold text-slate-300">Diagonal Slit Depth</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.bishopSlitDepth * 50)} mm
                      </span>
                    </div>
                    <input
                      id="bishop-slit-depth"
                      type="range"
                      min={0.15}
                      max={0.50}
                      step={0.01}
                      value={activeDesign.bishopSlitDepth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          bishop: { ...prev.bishop, bishopSlitDepth: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="bishop-slit-width" className="text-xs font-semibold text-slate-300">Slit Clearance Width</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.bishopSlitWidth * 50)} mm
                      </span>
                    </div>
                    <input
                      id="bishop-slit-width"
                      type="range"
                      min={0.01}
                      max={0.08}
                      step={0.005}
                      value={activeDesign.bishopSlitWidth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          bishop: { ...prev.bishop, bishopSlitWidth: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="bishop-slit-angle" className="text-xs font-semibold text-slate-300">Mitre Cut Tilt Angle</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {activeDesign.bishopSlitAngle}° degree
                      </span>
                    </div>
                    <input
                      id="bishop-slit-angle"
                      type="range"
                      min={10}
                      max={45}
                      step={1}
                      value={activeDesign.bishopSlitAngle}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          bishop: { ...prev.bishop, bishopSlitAngle: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                )}

                {/* queen parameters */}
                {selectedPiece === 'queen' && (
                  <div className="space-y-3.5 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                    <div className="flex items-center justify-between">
                      <label htmlFor="queen-coronet-points" className="text-xs font-semibold text-slate-300">Crown Spike Counts</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {activeDesign.queenCoronetPoints} Crowns
                      </span>
                    </div>
                    <input
                      id="queen-coronet-points"
                      type="range"
                      min={6}
                      max={16}
                      step={2}
                      value={activeDesign.queenCoronetPoints}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          queen: { ...prev.queen, queenCoronetPoints: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="queen-coronet-depth" className="text-xs font-semibold text-slate-300">Valley Spike Depth</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.queenCoronetDepth * 50)} mm
                      </span>
                    </div>
                    <input
                      id="queen-coronet-depth"
                      type="range"
                      min={0.05}
                      max={0.35}
                      step={0.01}
                      value={activeDesign.queenCoronetDepth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          queen: { ...prev.queen, queenCoronetDepth: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                )}

                {/* king parameters */}
                {selectedPiece === 'king' && (
                  <div className="space-y-3.5 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                    <div className="flex items-center justify-between">
                      <label htmlFor="king-cross-width" className="text-xs font-semibold text-slate-300">Cross Crown Span</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.kingCrossWidth * 50)} mm
                      </span>
                    </div>
                    <input
                      id="king-cross-width"
                      type="range"
                      min={0.15}
                      max={0.50}
                      step={0.01}
                      value={activeDesign.kingCrossWidth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          king: { ...prev.king, kingCrossWidth: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      <label htmlFor="king-cross-height" className="text-xs font-semibold text-slate-300">Cross Crest Height</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.kingCrossHeight * 50)} mm
                      </span>
                    </div>
                    <input
                      id="king-cross-height"
                      type="range"
                      min={0.20}
                      max={0.65}
                      step={0.01}
                      value={activeDesign.kingCrossHeight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          king: { ...prev.king, kingCrossHeight: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                )}

                {/* knight parameters */}
                {selectedPiece === 'knight' && (
                  <div className="space-y-3.5 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                    <div className="flex items-center justify-between">
                      <label htmlFor="knight-thickness" className="text-xs font-semibold text-slate-300">Organic Head Width Thickness</label>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {Math.round(activeDesign.knightThickness * 50)} mm
                      </span>
                    </div>
                    <input
                      id="knight-thickness"
                      type="range"
                      min={0.10}
                      max={0.45}
                      step={0.01}
                      value={activeDesign.knightThickness}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPieces(prev => ({
                          ...prev,
                          knight: { ...prev.knight, knightThickness: val }
                        }));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                )}

                {/* pawn parameters */}
                {selectedPiece === 'pawn' && (
                  <div className="p-3.5 text-center bg-slate-950 border border-slate-850 rounded-lg text-[11px] text-slate-400 leading-relaxed">
                    <p className="font-semibold text-slate-305 mb-1 text-cyan-400">Smooth Solid Revolve</p>
                    A beautiful, solid watertight revolve profile is fully sufficient for Pawns. Add node details directly inside the CAD Canvas Grid!
                  </div>
                )}
              </div>

              {/* PIECE HEIGHT DISPLAY */}
              <div className="border-t border-slate-800 pt-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">Piece Height (from CAD)</span>
                  <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-extrabold">
                    {scaleMm} mm
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal mb-3.5">
                  Height is determined dynamically by the bounding coordinates drawn inside the CAD designer (1.0 CAD Unit = 50.0 mm). Adjust points vertically to change piece height.
                </p>

                {/* DYNAMIC TELEMETRY HUD */}
                <div className="grid grid-cols-3 gap-2 mt-3.5 bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-center font-mono">
                  <div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase">Estimated Weight</div>
                    <div className="text-[11px] text-slate-300 font-bold">{currentEstimates.weight}g PLA</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase">Print Time</div>
                    <div className="text-[11px] text-slate-300 font-bold">~{currentEstimates.timeMins} min</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase">Slice Layers</div>
                    <div className="text-[11px] text-slate-300 font-bold">{currentEstimates.layers} layers</div>
                  </div>
                </div>
              </div>

              {/* PRIMARY STL DOWNLOAD EXPORTER */}
              <div className="border-t border-slate-800 pt-4 flex flex-col gap-2">
                <button
                  id="export-active-stl"
                  type="button"
                  onClick={() => handleExportSTL(selectedPiece)}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:translate-y-0.5 pointer-events-auto cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download STL Model (Ready to Print)</span>
                </button>
                <div className="flex items-center gap-1 justify-center text-[10px] text-slate-500">
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Output is watertight, scaled 1:1 in millimeters</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Bottom Info Rail */}
      <footer className="h-10 border-t border-slate-850 bg-[#161920] flex items-center justify-between px-6 text-[10px] font-mono text-slate-500 select-none shrink-0 mt-auto">
        <div className="flex gap-8">
          <span>Base Radius: {activeDesign.profilePoints[1] ? (activeDesign.profilePoints[1].x * 50).toFixed(1) : (activeDesign.profilePoints[0] ? (activeDesign.profilePoints[0].x * 50).toFixed(1) : '0.0')} mm</span>
          <span>Height: {scaleMm} mm</span>
          <span>Max Diameter: {getMaxDiameter()} mm</span>
        </div>
        <div className="flex gap-6 uppercase">
          <span className="text-cyan-500/70">Project: LATHECHESS_V2</span>
          <span>Units: Metric (mm)</span>
          <span>Material: Resin High-Detail</span>
        </div>
      </footer>
    </div>
  );
}
