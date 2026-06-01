export interface Point2D {
  id: string;
  x: number; // radius from center axis (0.0 to 1.0)
  y: number; // height (0.0 to 3.0)
  isCurved?: boolean; // whether this segment behaves as a curve
}

export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export interface PieceDesign {
  type: PieceType;
  profilePoints: Point2D[]; // 2D points for revolve-base
  // Custom non-revolve features
  rookNotchCount: number; // e.g. 4, 6, 8
  rookNotchDepth: number; // height of cuts
  rookBoreRadius: number; // hollow inner hole at top
  bishopSlitWidth: number;
  bishopSlitDepth: number;
  bishopSlitAngle: number; // in degrees
  kingCrossHeight: number;
  kingCrossWidth: number;
  queenCoronetPoints: number; // spikes on crown
  queenCoronetDepth: number;
  // For the Knight:
  knightSidePoints: Point2D[]; // points representing the 2D side silhouette of the horse head
  knightThickness: number; // thickness of the horse head body
}

export type FilamentMaterial = 'bronze' | 'silver' | 'gold' | 'wood' | 'matte-black' | 'white-gloss' | 'translucent-blue';

export interface AppState {
  pieces: Record<PieceType, PieceDesign>;
  selectedPiece: PieceType;
  material: FilamentMaterial;
  viewMode: 'editor' | 'board';
  showGrid: boolean;
  scaleMm: number; // Height scaling in mm (e.g. 30 to 100 mm)
}
