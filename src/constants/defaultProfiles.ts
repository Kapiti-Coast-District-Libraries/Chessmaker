import { PieceDesign, PieceType } from '../types';

export const DEFAULT_PIECES: Record<PieceType, PieceDesign> = {
  pawn: {
    type: 'pawn',
    profilePoints: [
      { id: 'p0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'p1', x: 0.38, y: 0.0, isCurved: false },
      { id: 'p2', x: 0.38, y: 0.08, isCurved: true },
      { id: 'p3', x: 0.30, y: 0.15, isCurved: true },
      { id: 'p4', x: 0.25, y: 0.22, isCurved: false },
      { id: 'p5', x: 0.17, y: 0.45, isCurved: true },
      { id: 'p6', x: 0.12, y: 0.70, isCurved: true },
      { id: 'p7', x: 0.18, y: 0.81, isCurved: false },
      { id: 'p8', x: 0.15, y: 0.86, isCurved: true },
      { id: 'p9', x: 0.22, y: 1.05, isCurved: true },
      { id: 'p10', x: 0.0, y: 1.24, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.2,
    rookBoreRadius: 0.15,
    bishopSlitWidth: 0.04,
    bishopSlitDepth: 0.35,
    bishopSlitAngle: 25,
    kingCrossHeight: 0.35,
    kingCrossWidth: 0.3,
    queenCoronetPoints: 8,
    queenCoronetDepth: 0.18,
    knightSidePoints: [], // Will initialize below or on demand
    knightThickness: 0.24
  },
  rook: {
    type: 'rook',
    profilePoints: [
      { id: 'r0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'r1', x: 0.40, y: 0.0, isCurved: false },
      { id: 'r2', x: 0.40, y: 0.12, isCurved: true },
      { id: 'r3', x: 0.34, y: 0.22, isCurved: true },
      { id: 'r4', x: 0.29, y: 0.35, isCurved: false },
      { id: 'r5', x: 0.26, y: 0.75, isCurved: true },
      { id: 'r6', x: 0.27, y: 1.15, isCurved: true },
      { id: 'r7', x: 0.32, y: 1.32, isCurved: false },
      { id: 'r8', x: 0.36, y: 1.55, isCurved: false },
      { id: 'r9', x: 0.23, y: 1.55, isCurved: true },
      { id: 'r10', x: 0.18, y: 1.35, isCurved: false },
      { id: 'r11', x: 0.0, y: 1.35, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.18,
    rookBoreRadius: 0.22,
    bishopSlitWidth: 0.04,
    bishopSlitDepth: 0.35,
    bishopSlitAngle: 25,
    kingCrossHeight: 0.35,
    kingCrossWidth: 0.3,
    queenCoronetPoints: 8,
    queenCoronetDepth: 0.18,
    knightSidePoints: [],
    knightThickness: 0.24
  },
  bishop: {
    type: 'bishop',
    profilePoints: [
      { id: 'b0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'b1', x: 0.38, y: 0.0, isCurved: false },
      { id: 'b2', x: 0.38, y: 0.10, isCurved: true },
      { id: 'b3', x: 0.32, y: 0.20, isCurved: true },
      { id: 'b4', x: 0.26, y: 0.32, isCurved: false },
      { id: 'b5', x: 0.18, y: 0.65, isCurved: true },
      { id: 'b6', x: 0.14, y: 0.82, isCurved: true },
      { id: 'b7', x: 0.21, y: 0.90, isCurved: false },
      { id: 'b8', x: 0.15, y: 0.96, isCurved: true },
      { id: 'b9', x: 0.27, y: 1.25, isCurved: true },
      { id: 'b10', x: 0.20, y: 1.52, isCurved: true },
      { id: 'b11', x: 0.07, y: 1.59, isCurved: false },
      { id: 'b12', x: 0.07, y: 1.66, isCurved: true },
      { id: 'b13', x: 0.0, y: 1.70, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.18,
    rookBoreRadius: 0.22,
    bishopSlitWidth: 0.03,
    bishopSlitDepth: 0.32,
    bishopSlitAngle: 28,
    kingCrossHeight: 0.35,
    kingCrossWidth: 0.3,
    queenCoronetPoints: 8,
    queenCoronetDepth: 0.18,
    knightSidePoints: [],
    knightThickness: 0.24
  },
  queen: {
    type: 'queen',
    profilePoints: [
      { id: 'q0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'q1', x: 0.42, y: 0.0, isCurved: false },
      { id: 'q2', x: 0.42, y: 0.12, isCurved: true },
      { id: 'q3', x: 0.34, y: 0.22, isCurved: true },
      { id: 'q4', x: 0.27, y: 0.40, isCurved: false },
      { id: 'q5', x: 0.19, y: 0.85, isCurved: true },
      { id: 'q6', x: 0.16, y: 1.15, isCurved: true },
      { id: 'q7', x: 0.25, y: 1.30, isCurved: false },
      { id: 'q8', x: 0.18, y: 1.38, isCurved: true },
      { id: 'q9', x: 0.33, y: 1.68, isCurved: true },
      { id: 'q10', x: 0.35, y: 1.78, isCurved: false },
      { id: 'q11', x: 0.13, y: 1.78, isCurved: true },
      { id: 'q12', x: 0.07, y: 1.86, isCurved: true },
      { id: 'q13', x: 0.0, y: 1.90, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.18,
    rookBoreRadius: 0.22,
    bishopSlitWidth: 0.03,
    bishopSlitDepth: 0.35,
    bishopSlitAngle: 25,
    kingCrossHeight: 0.35,
    kingCrossWidth: 0.3,
    queenCoronetPoints: 10,
    queenCoronetDepth: 0.14,
    knightSidePoints: [],
    knightThickness: 0.24
  },
  king: {
    type: 'king',
    profilePoints: [
      { id: 'k0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'k1', x: 0.44, y: 0.0, isCurved: false },
      { id: 'k2', x: 0.44, y: 0.12, isCurved: true },
      { id: 'k3', x: 0.36, y: 0.25, isCurved: true },
      { id: 'k4', x: 0.29, y: 0.50, isCurved: false },
      { id: 'k5', x: 0.21, y: 0.95, isCurved: true },
      { id: 'k6', x: 0.18, y: 1.25, isCurved: true },
      { id: 'k7', x: 0.28, y: 1.38, isCurved: false },
      { id: 'k8', x: 0.22, y: 1.48, isCurved: true },
      { id: 'k9', x: 0.34, y: 1.75, isCurved: true },
      { id: 'k10', x: 0.34, y: 1.82, isCurved: false },
      { id: 'k11', x: 0.18, y: 1.82, isCurved: true },
      { id: 'k12', x: 0.08, y: 1.88, isCurved: false },
      { id: 'k13', x: 0.0, y: 1.88, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.18,
    rookBoreRadius: 0.22,
    bishopSlitWidth: 0.03,
    bishopSlitDepth: 0.35,
    bishopSlitAngle: 25,
    kingCrossHeight: 0.36,
    kingCrossWidth: 0.34,
    queenCoronetPoints: 8,
    queenCoronetDepth: 0.18,
    knightSidePoints: [],
    knightThickness: 0.24
  },
  knight: {
    type: 'knight',
    profilePoints: [
      { id: 'kb0', x: 0.0, y: 0.0, isCurved: false },
      { id: 'kb1', x: 0.40, y: 0.0, isCurved: false },
      { id: 'kb2', x: 0.40, y: 0.10, isCurved: true },
      { id: 'kb3', x: 0.32, y: 0.22, isCurved: true },
      { id: 'kb4', x: 0.26, y: 0.40, isCurved: false },
      { id: 'kb5', x: 0.24, y: 0.60, isCurved: false }
    ],
    rookNotchCount: 6,
    rookNotchDepth: 0.18,
    rookBoreRadius: 0.18,
    bishopSlitWidth: 0.03,
    bishopSlitDepth: 0.32,
    bishopSlitAngle: 25,
    kingCrossHeight: 0.32,
    kingCrossWidth: 0.28,
    queenCoronetPoints: 8,
    queenCoronetDepth: 0.18,
    knightSidePoints: [
      { id: 'kn0', x: -0.21, y: 0.60, isCurved: false },
      { id: 'kn1', x: -0.28, y: 0.90, isCurved: false },
      { id: 'kn2', x: -0.32, y: 1.20, isCurved: false },
      { id: 'kn3', x: -0.22, y: 1.55, isCurved: false },
      { id: 'kn4', x: -0.19, y: 1.80, isCurved: false },
      { id: 'kn5', x: -0.06, y: 1.60, isCurved: false },
      { id: 'kn6', x: 0.15, y: 1.45, isCurved: false },
      { id: 'kn7', x: 0.28, y: 1.35, isCurved: false },
      { id: 'kn8', x: 0.22, y: 1.18, isCurved: false },
      { id: 'kn9', x: 0.04, y: 1.05, isCurved: false },
      { id: 'kn10', x: 0.18, y: 0.82, isCurved: false },
      { id: 'kn11', x: 0.20, y: 0.60, isCurved: false }
    ],
    knightThickness: 0.24
  }
};

// Also copy knight points to other templates where needed to guarantee valid initialized structs
DEFAULT_PIECES.pawn.knightSidePoints = [...DEFAULT_PIECES.knight.knightSidePoints];
DEFAULT_PIECES.rook.knightSidePoints = [...DEFAULT_PIECES.knight.knightSidePoints];
DEFAULT_PIECES.bishop.knightSidePoints = [...DEFAULT_PIECES.knight.knightSidePoints];
DEFAULT_PIECES.queen.knightSidePoints = [...DEFAULT_PIECES.knight.knightSidePoints];
DEFAULT_PIECES.king.knightSidePoints = [...DEFAULT_PIECES.knight.knightSidePoints];
