# Offline rendering dependency

Three.js 0.160.0, MIT, is pinned as `three.module.min.js` from the released
unpkg package. It supplies core rendering and geometry only. No examples,
loaders, models, or external assets are included. The game imports this local
file and generates its own meshes, textures, post-processing, and audio.
