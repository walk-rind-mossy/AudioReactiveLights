# Music Map Lab

Translates music into light: load audio, extract features, see them on a timeline, and drive a simulated neon sign.

## Run

Open `index.html` in a browser (a double-click is enough, no server needed).

To get a single self-contained file to share:

```
python3 build.py        # writes dist/music_map_lab.html
```

## Folder layout

```
index.html           page markup + <script> tags (the load order matters)
css/style.css        all styles
js/
  core.js            DOM handles, global state, params
  config.js          feature definitions + light output definitions (static data)
  audio.js           file loading, decoding, playback, live analysis
  analysis.js        FFT + offline feature extraction
  postprocess.js     smoothing, normalisation, event detection (bass impact, transient, rhythm, chaos, drop, note)
  controls.js        zoom, calibration, parameter controls, helpers
  export.js          JSON / CSV export
  feature-panels.js  advanced parameter panels + help text
  draw-tracks.js     canvas drawing of tracks and waveform
  light-preview.js   light preview series + light output selection
  timeline.js        timeline rows, hover, scroll, painting
  inspector.js       playhead, inspectors, event browser
  sign.js            neon sign simulation: themes, presets
  main.js            event wiring + startup (loaded last)
legacy/              the original single-file v42, kept for reference
tests/smoke.js       regression test (see below)
build.py             bundles everything into dist/music_map_lab.html
```

## Important: shared scope

The original was one big function, so every part could call every other part freely.
The split files are plain scripts that share the page's global scope, so that still
works exactly as before. The price: **load order in `index.html` matters**, and names
must stay unique across files. Moving to real ES modules (`import` / `export`) is a
later step.

One cleanup was made along the way: the old file patched `updatePlayhead` at the very
end to also call `tickSign()`. That call now lives inside `updatePlayhead` itself in
`js/inspector.js`.

## Regression test

```
npm i -D playwright && npx playwright install chromium
node tests/smoke.js                            # compare against tests/baseline.json
node tests/smoke.js --update                   # accept new output as baseline (after an intended change)
node tests/smoke.js dist/music_map_lab.html    # test the bundled build
```

It loads a synthetic 16 s track, runs the analysis, and compares frame count, event
counts and hashes of all features and events. Any behaviour change in the analysis
shows up as a diff.
