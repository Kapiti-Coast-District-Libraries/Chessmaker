import { PieceDesign, Point2D } from '../types';

/**
 * Interpolates a set of 2D control points into a high-resolution, smooth path
 * using Hermite / Cardinal splines for curved segments, and simple lines elsewhere.
 */
export function interpolateProfile(points: Point2D[], subdivisions: number = 8): { x: number; y: number }[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];

  const result: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    // If either this point or the segment asks for a curve, we interpolate
    if (p0.isCurved) {
      // Find neighbors for tangents
      const pm1 = i > 0 ? points[i - 1] : p0;
      const pp2 = i < points.length - 2 ? points[i + 2] : p1;

      // Tension parameter (0.5 is standard Cardinal spline)
      const tension = 0.5;
      const m0x = (p1.x - pm1.x) * tension;
      const m0y = (p1.y - pm1.y) * tension;
      const m1x = (pp2.x - p0.x) * tension;
      const m1y = (pp2.y - p0.y) * tension;

      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        const t2 = t * t;
        const t3 = t2 * t;

        // Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const x = h00 * p0.x + h10 * m0x + h01 * p1.x + h11 * m1x;
        const y = h00 * p0.y + h10 * m0y + h01 * p1.y + h11 * m1y;

        // Keep values positive and clean
        result.push({ x: Math.max(0, x), y: Math.max(0, y) });
      }
    } else {
      // Linear interpolation
      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        const x = p0.x + (p1.x - p0.x) * t;
        const y = p0.y + (p1.y - p0.y) * t;
        result.push({ x, y });
      }
    }
  }

  // Push final point
  const last = points[points.length - 1];
  result.push({ x: last.x, y: last.y });

  return result;
}

/**
 * Limits outward profile expansion to a maximum of 45-degrees relative to the vertical axis.
 * Mathematically, for each step upwards where y increases, the horizontal outward step dx (if any)
 * is capped to be at most the vertical rise dy.
 */
export function enforceOverhangOnProfile(profile: { x: number; y: number }[]): { x: number; y: number }[] {
  if (profile.length <= 1) return profile;

  const result: { x: number; y: number }[] = [];
  const minY = profile[0].y;

  result.push({ ...profile[0] });

  for (let i = 1; i < profile.length; i++) {
    const pt = profile[i];
    const prevPt = result[i - 1];

    let x = pt.x;
    let y = pt.y;

    // Preserve the bottom-most shape (flat base disc resting on the 3D print bed)
    if (Math.abs(y - minY) < 0.005) {
      result.push({ x, y });
      continue;
    }

    if (y > prevPt.y) {
      const dy = y - prevPt.y;
      if (x > prevPt.x + dy) {
        x = prevPt.x + dy;
      }
    } else if (y === prevPt.y) {
      if (x > prevPt.x) {
        x = prevPt.x;
      }
    }

    result.push({ x, y });
  }

  return result;
}

interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Builds standard box geometry.
 */
function createBox(
  cx: number, cy: number, cz: number,
  w: number, h: number, d: number
): { vertices: number[]; indices: number[] } {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;

  // 8 vertices
  const rawVerts = [
    cx - x, cy - y, cz - z, // 0
    cx + x, cy - y, cz - z, // 1
    cx + x, cy + y, cz - z, // 2
    cx - x, cy + y, cz - z, // 3
    cx - x, cy - y, cz + z, // 4
    cx + x, cy - y, cz + z, // 5
    cx + x, cy + y, cz + z, // 6
    cx - x, cy + y, cz + z  // 7
  ];

  // 12 triangles (faces)
  const rawIndices = [
    // Back
    0, 2, 1,   0, 3, 2,
    // Front
    4, 5, 6,   4, 6, 7,
    // Left
    0, 7, 3,   0, 4, 7,
    // Right
    1, 2, 6,   1, 6, 5,
    // Bottom
    0, 1, 5,   0, 5, 4,
    // Top
    3, 6, 2,   3, 7, 6
  ];

  return { vertices: rawVerts, indices: rawIndices };
}

/**
 * Generates the full watertight 3D mesh for any given piece.
 */
export function generatePieceMesh(design: PieceDesign, subdivisions2D: number = 6, enforceOverhang: boolean = false): MeshData {
  if (design.type === 'knight') {
    return generateKnightMesh(design, enforceOverhang);
  }

  // 1. Interpolate profile points
  let profile = interpolateProfile(design.profilePoints, subdivisions2D);
  if (enforceOverhang) {
    profile = enforceOverhangOnProfile(profile);
  }
  const segments = 48; // radial segments around Y axis (chosen as multiple of rook notches)

  const vertices: number[] = [];
  const indices: number[] = [];

  const topY = profile[profile.length - 1].y;
  const bottomY = profile[0].y;

  // Find peak height of profile (e.g. the top rim of a rook) for carving cutoffs
  let peakY = topY;
  for (const pt of profile) {
    if (pt.y > peakY) peakY = pt.y;
  }

  // Find max and min bounding details
  let maxR = 0;
  for (const pt of profile) {
    if (pt.x > maxR) maxR = pt.x;
  }

  // Helper variables for special modifications
  // Rook notches parameters
  const isRook = design.type === 'rook';
  const rookDepth = design.rookNotchDepth;
  const rookBoreR = design.rookBoreRadius;
  const rookNotchCount = design.rookNotchCount;
  const rookCutoffY = peakY - rookDepth;

  // Bishop miter slit parameters
  const isBishop = design.type === 'bishop';
  const bishopSlitAngleRad = (design.bishopSlitAngle * Math.PI) / 180;
  const bishopSlitD = design.bishopSlitDepth;
  const bishopSlitW = design.bishopSlitWidth;
  const bishopCutoffY = peakY - bishopSlitD;

  // Queen coronet parameters
  const isQueen = design.type === 'queen';
  const queenCorPoints = design.queenCoronetPoints;
  const queenCorDepth = design.queenCoronetDepth;
  const queenCutoffY = peakY - queenCorDepth;

  // Generate Revolve Vertices
  // We lay out vertices in grid: profile point i, radial segment j [0..segments]
  // To avoid seams, radial segment j = segments wraps exactly to 0
  for (let i = 0; i < profile.length; i++) {
    const pt = profile[i];
    const r = pt.x;
    const y = pt.y;

    for (let j = 0; j < segments; j++) {
      const theta = (j * 2 * Math.PI) / segments;
      let vx = r * Math.cos(theta);
      let vy = y;
      let vz = r * Math.sin(theta);

      // --- Apply Special Carving Deformations ---

      if (isRook && y > rookCutoffY) {
        // Rook crenellations
        // Divide circle into 2 * rookNotchCount sectors
        const sectorSize = (2 * Math.PI) / (2 * rookNotchCount);
        // Add tiny offset to avoid boundary float issues
        const currentSector = Math.floor((theta + 0.0001) / sectorSize);
        const isNotchGap = currentSector % 2 === 1;

        if (isNotchGap) {
          // Check if it's the top rim or outer profile
          // We pull the height of gap vertices down to the "notch floor"
          vy = rookCutoffY;
          
          // If boring is enabled, push outer profile inward slightly inside the gap to look clean
          if (r < rookBoreR + 0.05) {
            // This forms the notch floor nicely
          }
        }
      } else if (isBishop && y > bishopCutoffY) {
        // Bishop slit deformation
        // Projection plane normal: (sin(angle), 0, -cos(angle))
        const nx = Math.sin(bishopSlitAngleRad);
        const nz = -Math.cos(bishopSlitAngleRad);
        const dist = vx * nx + vz * nz; // Signed distance from plane

        // Is it inside the vertical slab of the slit?
        if (Math.abs(dist) < bishopSlitW / 2) {
          // Push vertices to the walls of the miter
          const pushSign = dist >= 0 ? 1 : -1;
          const targetDist = (bishopSlitW / 2) * pushSign;
          const delta = targetDist - dist;

          // Deform horizontally to create slot
          vx += delta * nx;
          vz += delta * nz;

          // Pull their height down towards the bottom of the slit if they are near the center line
          const rCoeff = 1.0 - Math.abs(dist) / (bishopSlitW / 2);
          vy = Math.max(bishopCutoffY, vy - (peakY - bishopCutoffY) * rCoeff * 0.85);
        }
      } else if (isQueen && y > queenCutoffY) {
        // Queen coronet crenellations (peaked spikes)
        // Cosine wave around the crown rim
        const wave = Math.sin(theta * queenCorPoints); // -1.0 to 1.0
        // Scale the heights of the top of the crown
        const heightReduction = ((1.0 - wave) / 2.0) * queenCorDepth;
        vy = Math.max(queenCutoffY, y - heightReduction);
      }

      vertices.push(vx, vy, vz);
    }
  }

  // Generate Revolve Quad faces
  // i index of profile point, j radial segment
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const nextJ = (j + 1) % segments;

      const v00 = i * segments + j;
      const v01 = i * segments + nextJ;
      const v10 = (i + 1) * segments + j;
      const v11 = (i + 1) * segments + nextJ;

      // 2 Triangles for the quad
      indices.push(v00, v10, v01);
      indices.push(v01, v10, v11);
    }
  }

  // CAPPING THE ENDS so the STL is airtight (solid manifold)
  // 1. Bottom Cap (Y = bottomY)
  // We append a center vertex
  const capBottomCenterIndex = vertices.length / 3;
  vertices.push(0, bottomY, 0);

  // Connect the first profile slice (Y = bottomY) outward to form circular base disk
  for (let j = 0; j < segments; j++) {
    const nextJ = (j + 1) % segments;
    const vCurr = j;
    const vNext = nextJ;
    // Bottom triangle (clockwise to face downwards)
    indices.push(capBottomCenterIndex, vNext, vCurr);
  }

  // 2. Top Cap (Y = topY)
  // We append a center vertex
  const capTopCenterIndex = vertices.length / 3;
  vertices.push(0, topY, 0);

  // Connect the last profile slice (Y = topY) outward to cap it
  const offset = (profile.length - 1) * segments;
  for (let j = 0; j < segments; j++) {
    const nextJ = (j + 1) % segments;
    const vCurr = offset + j;
    const vNext = offset + nextJ;
    // Top triangle (counterclockwise to face upwards)
    indices.push(capTopCenterIndex, vCurr, vNext);
  }

  // 3. KING CROSS APPEND
  // If King, we will build a composite 3D Cross geometry and append it
  if (design.type === 'king') {
    const ch = design.kingCrossHeight;
    const cw = design.kingCrossWidth;
    const ct = 0.12; // thickness of cross

    // Vertical post
    const vOffset = vertices.length / 3;
    const post = createBox(0, topY + ch / 2, 0, cw * 0.4, ch, ct);
    post.vertices.forEach(v => vertices.push(v));
    post.indices.forEach(idx => indices.push(idx + vOffset));

    // Horizontal bar
    const hOffset = vertices.length / 3;
    const bar = createBox(0, topY + ch * 0.65, 0, cw, ch * 0.3, ct);
    bar.vertices.forEach(v => vertices.push(v));
    bar.indices.forEach(idx => indices.push(idx + hOffset));
  }

  // Calculate normals
  const normArray = calculateNormals(vertices, indices);

  return {
    vertices: new Float32Array(vertices),
    normals: normArray,
    indices: new Uint32Array(indices)
  };
}

/**
 * Specialized Knight Generator
 * Revolves lower points (Y <= 0.6) and generates a beautifully tapered,
 * organic extruded horse head for the upper portion.
 */
function generateKnightMesh(design: PieceDesign, enforceOverhang: boolean = false): MeshData {
  const segments = 48;
  const vertices: number[] = [];
  const indices: number[] = [];

  const tMax = design.knightThickness; // Maximum base thickness of the cheek

  // 1. Separate revolve base of Knight (Y <= 0.6)
  // Filter the design profile points for bottom pedestal
  const pedestalPoints = design.profilePoints.filter(p => p.y <= 0.601);
  if (pedestalPoints.length < 2) {
    // Fallback if user cleared base points
    pedestalPoints.push({ id: 'f1', x: 0.45, y: 0.0 }, { id: 'f2', x: 0.25, y: 0.6 });
  }

  let profile = interpolateProfile(pedestalPoints, 6);
  if (enforceOverhang) {
    profile = enforceOverhangOnProfile(profile);
  }
  const bottomY = profile[0].y;
  const pedestalTopY = profile[profile.length - 1].y;

  const headPoints = design.knightSidePoints;

  // Revolve the pedestal with a smooth loft transition to the horse neck's rectangular base profile
  const kn0 = headPoints[0] || { x: -0.21, y: 0.60 };
  const kn11 = headPoints[headPoints.length - 1] || { x: 0.20, y: 0.60 };
  const xCenter = (kn0.x + kn11.x) / 2;
  const xHalf = (kn11.x - kn0.x) / 2;

  for (let i = 0; i < profile.length; i++) {
    const pt = profile[i];
    
    // Blend from circular base to horse-matching rectangular base shape from y = 0.15 to y = pedestalTopY
    const blendStart = 0.15;
    const blendEnd = pedestalTopY;
    const blend = Math.max(0, Math.min(1, (pt.y - blendStart) / (blendEnd - blendStart)));
    
    // Center of cross section transitions from (0, 0) to (xCenter, 0)
    const cx = xCenter * blend;
    
    for (let j = 0; j < segments; j++) {
      const theta = (j * 2 * Math.PI) / segments;
      
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      
      // 1. Circle boundary point (blend = 0)
      const C_x = pt.x * cosT;
      const C_z = pt.x * sinT;
      
      // 2. Rectangle boundary point (blend = 1, bounds: xHalf width, tMax / 2 thickness)
      const A = xHalf;
      const B = tMax / 2;
      let r_rect = 0;
      if (Math.abs(cosT) * B > Math.abs(sinT) * A) {
        r_rect = A / Math.abs(cosT);
      } else {
        r_rect = B / Math.abs(sinT || 1e-6);
      }
      
      const R_x = cx + r_rect * cosT;
      const R_z = r_rect * sinT;
      
      // Build the morphed hybrid point
      const px = C_x * (1.0 - blend) + R_x * blend;
      const py = pt.y;
      const pz = C_z * (1.0 - blend) + R_z * blend;
      
      vertices.push(px, py, pz);
    }
  }

  // Draw pedestal faces
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const nextJ = (j + 1) % segments;
      const v00 = i * segments + j;
      const v01 = i * segments + nextJ;
      const v10 = (i + 1) * segments + j;
      const v11 = (i + 1) * segments + nextJ;

      indices.push(v00, v10, v01);
      indices.push(v01, v10, v11);
    }
  }

  // Cap bottom of pedestal
  const capBottomIndex = vertices.length / 3;
  vertices.push(0, bottomY, 0);
  for (let j = 0; j < segments; j++) {
    indices.push(capBottomIndex, (j + 1) % segments, j);
  }

  // Cap top of pedestal base
  const capTopBaseIndex = vertices.length / 3;
  vertices.push(xCenter, pedestalTopY, 0);
  const offset = (profile.length - 1) * segments;
  for (let j = 0; j < segments; j++) {
    indices.push(capTopBaseIndex, offset + j, offset + (j + 1) % segments);
  }

  // 2. Extrude the organic Knight Horse Head (Y > 0.6) with exquisite edge filleting
  const headPointsStartOffset = vertices.length / 3;
  const n = headPoints.length;

  // Function to calculate tapering width of the horse head based on point position
  const getTaper = (x: number, y: number): number => {
    // Nose snout area (X standard nose > 0.15) tapers narrow
    if (x > 0.1) {
      const dist = x - 0.1;
      return Math.max(0.35, 1.0 - dist * 1.5);
    }
    // Tips of the ears taper narrow
    if (y > 1.6) {
      return Math.max(0.35, 1.0 - (y - 1.6) * 2.0);
    }
    // Neck base is thick
    return 1.0;
  };

  // Calculate inward normals of the CW knight side loop
  const inwards: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    const p = headPoints[i];
    const pPrev = headPoints[prev];
    const pNext = headPoints[next];
    
    const dx1 = p.x - pPrev.x;
    const dy1 = p.y - pPrev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
    const ux1 = dx1 / len1;
    const uy1 = dy1 / len1;
    
    const dx2 = pNext.x - p.x;
    const dy2 = pNext.y - p.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
    const ux2 = dx2 / len2;
    const uy2 = dy2 / len2;
    
    // Average clockwise right-hand normal (inwards)
    const nx1 = uy1;
    const ny1 = -ux1;
    const nx2 = uy2;
    const ny2 = -ux2;
    
    let nix = (nx1 + nx2) / 2;
    let niy = (ny1 + ny2) / 2;
    const nLen = Math.sqrt(nix * nix + niy * niy);
    if (nLen > 0.0001) {
      nix /= nLen;
      niy /= nLen;
    }
    inwards.push({ x: nix, y: niy });
  }

  // Add 4 layers of vertices for smooth rounded fillets:
  // Loop 0: Front cap (inset in X-Y, flat at max positive Z)
  for (let i = 0; i < n; i++) {
    const pt = headPoints[i];
    const isBottom = pt.y <= 0.601;
    const pyAdjusted = isBottom ? pt.y - 0.02 : pt.y; // overlap by 0.02 (1mm) to guarantee watertight connection
    const taper = getTaper(pt.x, pt.y);
    const tHalf = (tMax * taper) / 2;
    const heightBlend = Math.max(0, Math.min(1, (pt.y - 0.6) / 0.15));
    const rFillet = Math.min(0.025, tHalf * 0.4) * heightBlend;
    
    const px = pt.x + inwards[i].x * rFillet;
    const py = pyAdjusted + inwards[i].y * rFillet;
    const pz = tHalf;
    vertices.push(px, py, pz);
  }

  // Loop 1: Front shoulder (outer boundary profile, stepped Z)
  for (let i = 0; i < n; i++) {
    const pt = headPoints[i];
    const isBottom = pt.y <= 0.601;
    const pyAdjusted = isBottom ? pt.y - 0.02 : pt.y; // overlap by 0.02 (1mm) to guarantee watertight connection
    const taper = getTaper(pt.x, pt.y);
    const tHalf = (tMax * taper) / 2;
    const heightBlend = Math.max(0, Math.min(1, (pt.y - 0.6) / 0.15));
    const rFillet = Math.min(0.025, tHalf * 0.4) * heightBlend;
    
    const px = pt.x;
    const py = pyAdjusted;
    const pz = Math.max(0, tHalf - rFillet);
    vertices.push(px, py, pz);
  }

  // Loop 2: Back shoulder (outer boundary profile, stepped Z)
  for (let i = 0; i < n; i++) {
    const pt = headPoints[i];
    const isBottom = pt.y <= 0.601;
    const pyAdjusted = isBottom ? pt.y - 0.02 : pt.y; // overlap by 0.02 (1mm) to guarantee watertight connection
    const taper = getTaper(pt.x, pt.y);
    const tHalf = (tMax * taper) / 2;
    const heightBlend = Math.max(0, Math.min(1, (pt.y - 0.6) / 0.15));
    const rFillet = Math.min(0.025, tHalf * 0.4) * heightBlend;
    
    const px = pt.x;
    const py = pyAdjusted;
    const pz = -Math.max(0, tHalf - rFillet);
    vertices.push(px, py, pz);
  }

  // Loop 3: Back cap (inset in X-Y, flat at max negative Z)
  for (let i = 0; i < n; i++) {
    const pt = headPoints[i];
    const isBottom = pt.y <= 0.601;
    const pyAdjusted = isBottom ? pt.y - 0.02 : pt.y; // overlap by 0.02 (1mm) to guarantee watertight connection
    const taper = getTaper(pt.x, pt.y);
    const tHalf = (tMax * taper) / 2;
    const heightBlend = Math.max(0, Math.min(1, (pt.y - 0.6) / 0.15));
    const rFillet = Math.min(0.025, tHalf * 0.4) * heightBlend;
    
    const px = pt.x + inwards[i].x * rFillet;
    const py = pyAdjusted + inwards[i].y * rFillet;
    const pz = -tHalf;
    vertices.push(px, py, pz);
  }

  // Construct Triangulation for Front Face (counterclockwise)
  const horseTriangles = triangulatePolygon(headPoints);

  // Append Front Triangles (using Loop 0 vertices)
  for (const tri of horseTriangles) {
    indices.push(
      headPointsStartOffset + tri[0],
      headPointsStartOffset + tri[1],
      headPointsStartOffset + tri[2]
    );
  }

  // Append Back Triangles (using Loop 3 vertices) with reversed order for correct back-facing normals
  for (const tri of horseTriangles) {
    indices.push(
      headPointsStartOffset + 3 * n + tri[0],
      headPointsStartOffset + 3 * n + tri[2],
      headPointsStartOffset + 3 * n + tri[1]
    );
  }

  // Build the Perimeter Side Walls and Filleted Corners (Quads bridging loops in sequence)
  // Strip 1: Front Cap (Loop 0) to Front Shoulder (Loop 1)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const v0_curr = headPointsStartOffset + i;
    const v0_next = headPointsStartOffset + next;
    const v1_curr = headPointsStartOffset + n + i;
    const v1_next = headPointsStartOffset + n + next;
    
    indices.push(v0_curr, v1_next, v1_curr);
    indices.push(v0_curr, v0_next, v1_next);
  }

  // Strip 2: Front Shoulder (Loop 1) to Back Shoulder (Loop 2)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const v1_curr = headPointsStartOffset + n + i;
    const v1_next = headPointsStartOffset + n + next;
    const v2_curr = headPointsStartOffset + 2 * n + i;
    const v2_next = headPointsStartOffset + 2 * n + next;
    
    indices.push(v1_curr, v2_next, v2_curr);
    indices.push(v1_curr, v1_next, v2_next);
  }

  // Strip 3: Back Shoulder (Loop 2) to Back Cap (Loop 3)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const v2_curr = headPointsStartOffset + 2 * n + i;
    const v2_next = headPointsStartOffset + 2 * n + next;
    const v3_curr = headPointsStartOffset + 3 * n + i;
    const v3_next = headPointsStartOffset + 3 * n + next;
    
    indices.push(v2_curr, v3_next, v3_curr);
    indices.push(v2_curr, v2_next, v3_next);
  }

  // Calculate normals
  const normArray = calculateNormals(vertices, indices);

  return {
    vertices: new Float32Array(vertices),
    normals: normArray,
    indices: new Uint32Array(indices)
  };
}

/**
 * Standard vertex flat face normal generation for pristine lighting on sharp/deformed edges
 */
function calculateNormals(vertices: number[], indices: number[]): Float32Array {
  const normals = new Float32Array(vertices.length);
  const count = new Int32Array(vertices.length / 3);

  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];

    const ax = vertices[i1 * 3];
    const ay = vertices[i1 * 3 + 1];
    const az = vertices[i1 * 3 + 2];

    const bx = vertices[i2 * 3];
    const by = vertices[i2 * 3 + 1];
    const bz = vertices[i2 * 3 + 2];

    const cx = vertices[i3 * 3];
    const cy = vertices[i3 * 3 + 1];
    const cz = vertices[i3 * 3 + 2];

    // u = B - A
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;

    // v = C - A
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;

    // Normal = u x v
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    // Accumulate normals for vertices
    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;

    normals[i3 * 3] += nx;
    normals[i3 * 3 + 1] += ny;
    normals[i3 * 3 + 2] += nz;
  }

  // Normalize
  for (let idx = 0; idx < vertices.length / 3; idx++) {
    const nx = normals[idx * 3];
    const ny = normals[idx * 3 + 1];
    const nz = normals[idx * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len > 0.0001) {
      normals[idx * 3] = nx / len;
      normals[idx * 3 + 1] = ny / len;
      normals[idx * 3 + 2] = nz / len;
    } else {
      normals[idx * 3] = 0;
      normals[idx * 3 + 1] = 1;
      normals[idx * 3 + 2] = 0;
    }
  }

  return normals;
}

/**
 * Exports the 3D meshes to STL format (Standard Triangle Language)
 * Fully watertight and compliant with slicing engines.
 * scaleFactor converts local 1-unit bounds into physical millimeters (e.g., 50mm height)
 */
export function exportToSTL(
  vertices: Float32Array,
  indices: Uint32Array,
  pieceName: string,
  scaleFactor: number = 40
): string {
  let stl = `solid ${pieceName.replace(/\s+/g, '_')}\n`;

  // Scale the piece bounding heights
  // Find min and max height to scale properly
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < vertices.length; i += 3) {
    const yVal = vertices[i];
    if (yVal < minY) minY = yVal;
    if (yVal > maxY) maxY = yVal;
  }
  const modelHeight = maxY - minY;
  const factor = scaleFactor / modelHeight;

  // Process triangles
  for (let i = 0; i < indices.length; i += 3) {
    const idx1 = indices[i];
    const idx2 = indices[i + 1];
    const idx3 = indices[i + 2];

    // Scale and adjust coordinates so zero height rests flat on build plate!
    const x1 = vertices[idx1 * 3] * factor;
    const y1 = (vertices[idx1 * 3 + 1] - minY) * factor;
    const z1 = vertices[idx1 * 3 + 2] * factor;

    const x2 = vertices[idx2 * 3] * factor;
    const y2 = (vertices[idx2 * 3 + 1] - minY) * factor;
    const z2 = vertices[idx2 * 3 + 2] * factor;

    const x3 = vertices[idx3 * 3] * factor;
    const y3 = (vertices[idx3 * 3 + 1] - minY) * factor;
    const z3 = vertices[idx3 * 3 + 2] * factor;

    // Calculate flat face normal
    const ux = x2 - x1;
    const uy = y2 - y1;
    const uz = z2 - z1;

    const vx = x3 - x1;
    const vy = y3 - y1;
    const vz = z3 - z1;

    // Cross product
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    stl += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
    stl += `    outer loop\n`;
    stl += `      vertex ${x1.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}\n`;
    stl += `      vertex ${x2.toFixed(6)} ${y2.toFixed(6)} ${z2.toFixed(6)}\n`;
    stl += `      vertex ${x3.toFixed(6)} ${y3.toFixed(6)} ${z3.toFixed(6)}\n`;
    stl += `    endloop\n`;
    stl += `  endfacet\n`;
  }

  stl += `endsolid ${pieceName.replace(/\s+/g, '_')}\n`;
  return stl;
}

/**
 * Triggers web browser file download
 */
export function downloadMeshFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.id = `dl-${filename.replace(/\./g, '-')}`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Robust 2D polygon triangulation using Ear Clipping algorithm
 * Supports arbitrary convex/concave polygons and returns triangles
 */
export function triangulatePolygon(points: { x: number; y: number }[]): number[][] {
  const n = points.length;
  if (n < 3) return [];

  const indices = Array.from({ length: n }, (_, i) => i);
  const triangles: number[][] = [];

  const isPointInTriangle = (
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ) => {
    const v0x = c.x - a.x;
    const v0y = c.y - a.y;
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = p.x - a.x;
    const v2y = p.y - a.y;

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;

    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-9) return false;

    const u = (dot11 * dot02 - dot01 * dot12) / denom;
    const v = (dot00 * dot12 - dot01 * dot02) / denom;

    return u >= -1e-9 && v >= -1e-9 && (u + v) <= 1 + 1e-9;
  };

  // Determine standard clockwise shoelace winding
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  const isClockwise = sum > 0;

  let attempts = 0;
  const maxAttempts = indices.length * indices.length;

  while (indices.length > 3 && attempts < maxAttempts) {
    attempts++;
    let earFound = false;

    for (let i = 0; i < indices.length; i++) {
      const prevIdx = indices[(i - 1 + indices.length) % indices.length];
      const currIdx = indices[i];
      const nextIdx = indices[(i + 1) % indices.length];

      const a = points[prevIdx];
      const b = points[currIdx];
      const c = points[nextIdx];

      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      const convex = isClockwise ? (cross < -1e-9) : (cross > 1e-9);

      if (!convex) continue;

      let hasPointInside = false;
      for (let j = 0; j < indices.length; j++) {
        const checkIdx = indices[j];
        if (checkIdx === prevIdx || checkIdx === currIdx || checkIdx === nextIdx) continue;
        if (isPointInTriangle(points[checkIdx], a, b, c)) {
          hasPointInside = true;
          break;
        }
      }

      if (!hasPointInside) {
        triangles.push([prevIdx, currIdx, nextIdx]);
        indices.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      // Fallback ear cut to avoid getting stuck if self-intersecting
      const cutIdx = 1 % indices.length;
      const prevIdx = indices[(cutIdx - 1 + indices.length) % indices.length];
      const currIdx = indices[cutIdx];
      const nextIdx = indices[(cutIdx + 1) % indices.length];
      triangles.push([prevIdx, currIdx, nextIdx]);
      indices.splice(cutIdx, 1);
    }
  }

  if (indices.length === 3) {
    triangles.push([indices[0], indices[1], indices[2]]);
  }

  // Double check all triangle winding represents CCW face direction in 2D
  for (const tri of triangles) {
    const a = points[tri[0]];
    const b = points[tri[1]];
    const c = points[tri[2]];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (cross < 0) {
      const temp = tri[1];
      tri[1] = tri[2];
      tri[2] = temp;
    }
  }

  return triangles;
}
