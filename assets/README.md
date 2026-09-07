# Chaduranga 2.0 — Custom Assets Directory

## Directory Structure

```
assets/
├── models/         # 3D piece models (.glb, .gltf, .obj, .fbx)
│   ├── pieces/     # Individual piece models
│   └── boards/     # Custom board designs
├── textures/       # Textures for pieces, board, terrain
│   ├── pieces/     # Piece material textures
│   ├── board/      # Board surface textures
│   └── terrain/    # Terrain overlay textures
├── backgrounds/    # Background scenery (HDR, skyboxes, images)
├── sounds/         # Sound effects (move, capture, check, etc.)
└── ui/             # Custom UI assets (icons, logos, fonts)
```

## How to Use Custom 3D Pieces

1. Export your Blender model as `.glb` (recommended) or `.gltf`
2. Place it in `assets/models/pieces/`
3. Name it by piece type: `king.glb`, `queen.glb`, `tiger.glb`, etc.
4. Update `renderer3d.js` to load models via THREE.GLTFLoader

## Supported Formats
- **Models**: .glb, .gltf (recommended), .obj, .fbx
- **Textures**: .png, .jpg, .webp, .hdr
- **Audio**: .mp3, .ogg, .wav
- **UI**: .svg, .png, .woff2
