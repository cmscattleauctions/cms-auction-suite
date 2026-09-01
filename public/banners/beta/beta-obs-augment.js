/* =============================================================
 * Beta OBS Builder — OBS scene collection augmentation
 * -------------------------------------------------------------
 * PURE post-processing pass over the OBS JSON Classic already
 * produces (public/banners/index.html's buildObsJson()). Beta never
 * touches buildObsJson() itself — it calls it unmodified, then adds
 * scene items on top. This is the isolation boundary between Classic
 * (unchanged, production-critical) and Beta (additive).
 *
 * Adds:
 *   - ONE INDEPENDENT ffmpeg_source scene item, per "<lot> Video" scene,
 *     for the matched cattle video. Even when two lots share the same
 *     physical .mp4 (same CMS Video ID), each lot's scene gets its OWN
 *     ffmpeg_source object (own uuid, own name "VIDEO - <lot>") pointed
 *     at the same local file — never a shared source_uuid, so every
 *     lot's playback state and restart behavior is fully independent.
 *     The local FILE is still deduped (beta-main.js's
 *     `uniqueVideoSources`) purely for manifest/path-lookup purposes,
 *     never for sharing an OBS source object.
 *   - one shared image_source scene item PER DETECTED TAG (static
 *     images have no playback state, so sharing is safe). Each scene's
 *     own scene item still gets independent pos/scale/visible, so
 *     hiding a tag on one lot never touches another lot.
 *   - a native OBS Stinger Transition ("CMS Stinger"), applied as a
 *     per-scene Transition Override on every "<lot> Video" scene, and on
 *     a Transition-type scene ("<lot> Transition" or a breed/"type"
 *     transition) ONLY when it's immediately preceded — in the real
 *     scene_order sequence, not just by name — by a Lot Video scene. That
 *     excludes the show's opening Transition scene and a Lot Transition
 *     immediately following a breed/type Transition, since neither
 *     follows an actual lot video. See buildStingerTransition()/
 *     applyStingerOverride() and the scene_order walk in
 *     augmentObsJsonForBeta() for the full verified mechanism.
 *
 * SCHEMA NOTES (per project rule: don't invent OBS fields — everything
 * below was verified against OBS Studio's actual open-source frontend/
 * libobs source (obsproject/obs-studio, version matching the OBS 31.0.3
 * installed during this project), not guessed or inferred from
 * template.json alone):
 *   - Scene item shape (pos/pos_rel/scale/align/bounds_type: 0/id/etc.)
 *     is copied verbatim from Classic's own makeBannerSceneItem(), which
 *     is already verified against this exact template.json.
 *   - `ffmpeg_source` ("Media Source") is a source TYPE Classic's
 *     template never uses (it has zero video sources — cattle video is
 *     always dragged in live by the operator today), so there is no
 *     in-file example to copy. Its settings here are OBS's own
 *     long-standing built-in Media Source fields (local_file,
 *     is_local_file, looping, restart_on_activate, close_when_inactive,
 *     clear_on_media_end) — the most stable, documented part of OBS's
 *     source schema.
 *   - The Stinger transition + per-scene Transition Override are
 *     verified against libobs/obs-source-transition.c,
 *     frontend/widgets/OBSBasic_Transitions.cpp, and
 *     plugins/obs-transitions/transition-stinger.c — see
 *     buildStingerTransition() / applyStingerOverride() below for the
 *     exact field-by-field citations.
 * ============================================================= */

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const STINGER_NAME = 'CMS Stinger';

function normalizeSceneName(name) { return String(name).replace(/\s+/g, ' ').trim(); }
function isLotVideoScene(name) { return /^\d+(-[A-Z])? Video$/i.test(normalizeSceneName(name)); }
function lotFromVideoSceneName(name) { return normalizeSceneName(name).replace(/ Video$/i, '').trim(); }

// Mirrors index.html's own isLotTransitionScene/isBreedTransitionScene
// (Classic's scene-sequencing code) — kept in sync by hand since Classic's
// script isn't a module Beta can import from. "Type Transition" in the
// spec is Classic's "breed transition": a fixed interlude scene (never
// tied to a specific lot) inserted between groups of a given breed.
function isLotTransitionScene(name) { return /^\d+(-[A-Z])? Transition$/i.test(normalizeSceneName(name)); }
function isBreedTransitionScene(name) {
  return ['Charolais Transition', 'Native Transition', 'Holstein Transition'].includes(normalizeSceneName(name));
}

/**
 * Build a scene item — same shape/keys as Classic's makeBannerSceneItem,
 * generalized for reuse (video / tags both need this).
 */
function makeSourceItem({ sourceName, sourceUuid, itemId, canvasW, canvasH, posX, posY, scaleX = 1, scaleY = 1 }) {
  const halfH = canvasH / 2;
  const posRelX = (posX - canvasW / 2) / halfH;
  const posRelY = (posY - canvasH / 2) / halfH;
  return {
    name: sourceName,
    source_uuid: sourceUuid,
    visible: true,
    locked: false,
    rot: 0.0,
    scale_ref: { x: canvasW, y: canvasH },
    align: 5,
    bounds_type: 0,
    bounds_align: 0,
    bounds_crop: false,
    crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0,
    id: itemId,
    group_item_backup: false,
    pos: { x: posX, y: posY },
    pos_rel: { x: posRelX, y: posRelY },
    scale: { x: scaleX, y: scaleY },
    scale_rel: { x: scaleX, y: scaleY },
    bounds: { x: 0, y: 0 },
    bounds_rel: { x: 0, y: 0 },
    scale_filter: 'disable',
    blend_method: 'default',
    blend_type: 'normal',
    show_transition: { duration: 0 },
    hide_transition: { duration: 0 },
    private_settings: {},
  };
}

function makeImageSource(localFilePath, sourceName) {
  return {
    prev_ver: 536936449,
    name: sourceName,
    uuid: uuidv4(),
    id: 'image_source',
    versioned_id: 'image_source',
    settings: { file: localFilePath },
    mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5,
    enabled: true, muted: false,
    'push-to-mute': false, 'push-to-mute-delay': 0,
    'push-to-talk': false, 'push-to-talk-delay': 0,
    hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0,
    private_settings: {},
  };
}

/**
 * OBS's built-in Media Source. See file header re: schema confidence.
 *
 * `close_when_inactive: true` matters a lot given every lot gets its OWN
 * source object instead of sharing one per video: with 100+ lots each
 * holding an independent ffmpeg_source, we do NOT want OBS to keep every
 * single one decoded/buffered simultaneously — only the source(s)
 * belonging to the currently-active scene should ever be opened. This
 * also forces a clean re-open (a true from-the-beginning restart) every
 * time the scene reactivates, rather than a lighter-weight seek-to-0 on
 * an already-open file.
 *
 * `clear_on_media_end: false` — the cattle video freezes on its last
 * frame if it's shorter than the time spent on that lot, it never vanishes.
 */
function makeMediaSource(localFilePath, sourceName) {
  return {
    prev_ver: 536936449,
    name: sourceName,
    uuid: uuidv4(),
    id: 'ffmpeg_source',
    versioned_id: 'ffmpeg_source',
    settings: {
      local_file: localFilePath,
      is_local_file: true,
      looping: false,
      restart_on_activate: true,
      close_when_inactive: true,
      clear_on_media_end: false,
    },
    mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5,
    enabled: true, muted: false,
    'push-to-mute': false, 'push-to-mute-delay': 0,
    'push-to-talk': false, 'push-to-talk-delay': 0,
    hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0,
    private_settings: {},
  };
}

/**
 * Compute bottom-right positions for a lot's active tags, left-to-right
 * in ascending sortOrder, right-aligned as a group against the margins.
 * `tagAssets` entries need naturalWidth/naturalHeight (read from the
 * localized PNG once per build) so height-locked scaling doesn't distort.
 */
export function layoutTagRow(activeTagIds, tagAssets, layout, canvasW, canvasH) {
  const items = activeTagIds
    .map(id => tagAssets.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const placed = items.map(t => {
    const scale = layout.tagHeight / (t.naturalHeight || layout.tagHeight);
    const w = Math.round((t.naturalWidth || layout.tagHeight) * scale);
    return { ...t, scale, width: w };
  });

  const totalWidth = placed.reduce((sum, t) => sum + t.width, 0) + layout.spacing * Math.max(0, placed.length - 1);
  let x = canvasW - layout.rightMargin - totalWidth;
  const y = canvasH - layout.bottomMargin - layout.tagHeight;

  return placed.map(t => {
    const pos = { tagId: t.id, name: t.name, x, y, scale: t.scale };
    x += t.width + layout.spacing;
    return pos;
  });
}

/**
 * Build the ONE "CMS Stinger" transition object for the collection's
 * top-level `transitions` array (already present as `[]` on the real
 * template.json — this is populating an existing empty array, not
 * inventing a new top-level field).
 *
 * Verified field-by-field against plugins/obs-transitions/transition-stinger.c:
 *   id: "obs_stinger_transition"                        (stinger_transition.id, line ~807)
 *   settings.path            <- video file               ("path", read at line 70)
 *   settings.tp_type: 0                                   (TIMING_TIME=0 vs TIMING_FRAME=1, #define lines 5-6;
 *                                                          we always use ms, not frame count)
 *   settings.transition_point <- ms                       ("transition_point", read at line 96, ms when tp_type=0)
 *   settings.hw_decode: false, settings.preload: false     (both real settings, left off/conservative;
 *                                                          the plugin's own get_defaults() fills in every
 *                                                          other field we don't set — track matte, audio
 *                                                          fade style, etc. — so nothing is left invalid)
 *
 * IMPORTANT VERIFIED FACT (see applyStingerOverride's comment): OBS
 * auto-enables a FIXED duration equal to the stinger clip's own real
 * length + 250ms (transition-stinger.c line ~575,
 * `obs_transition_enable_fixed(s->source, true, duration_ns/1e6)`), so
 * the `transition_duration` we set per-scene below is really only a
 * fallback/display value — OBS overrides it with the clip's actual
 * length at runtime regardless of what we put there.
 */
function buildStingerTransition(localPath, transitionPointMs) {
  return {
    name: STINGER_NAME,
    id: 'obs_stinger_transition',
    settings: {
      path: localPath,
      tp_type: 0,
      transition_point: Math.max(0, transitionPointMs || 0),
      hw_decode: false,
      preload: false,
    },
  };
}

/**
 * Applies the Stinger as a per-scene Transition Override on `scene` —
 * unconditional here; the CALLER (augmentObsJsonForBeta) decides which
 * scenes to call this on, using scene_order adjacency to gate the
 * Transition-scene case — see the comment above that call site for why.
 *
 * Verified against frontend/widgets/OBSBasic_Transitions.cpp:
 *   - GetOverrideTransition(source) / GetOverrideTransitionDuration(source)
 *     both read `obs_source_get_private_settings(source)` — i.e. the
 *     scene's own `private_settings` object, keys "transition" (string,
 *     matched by NAME against the collection's `transitions` list) and
 *     "transition_duration" (int ms, defaults to 300).
 *   - `private_settings` is a field ALREADY PRESENT (always `{}`) on
 *     every single scene in the real production template.json — this
 *     is populating an existing field, not inventing one.
 *
 * VERIFIED DIRECTIONAL BEHAVIOR (OBSBasic::TransitionToScene, in the
 * same file): `GetOverrideTransition(source)` is called with `source`
 * = the DESTINATION scene being entered. The engine never inspects
 * which scene you're coming FROM — there is no native "only when
 * leaving X" override; OBS has no concept of a source-scene condition
 * at all. That's exactly why the caller has to work it out itself from
 * scene_order before deciding which scenes to apply this to, rather
 * than there being an OBS-native way to express it directly.
 *   - Jumping directly from one Video scene to another still fires the
 *     destination Video scene's own Stinger — this is inherent to OBS,
 *     not a gap in this implementation.
 *
 * ONE VERIFIED LIMITATION, stated plainly rather than hidden behind a
 * silent workaround (see libobs/obs-source-transition.c,
 * obs_transition_start()): the destination scene's sources — including
 * the cattle Media Source — become active, and restart_on_activate
 * fires, at the START of the Stinger, not at its `transition_point`.
 * OBS has no native mechanism to delay a source's activation until a
 * transition completes; transitions are built to cross-fade two
 * simultaneously-live sources. This means the cattle video is always
 * some fraction of a second into playback by the time the Stinger
 * finishes and reveals it — bounded by the Stinger's own (short)
 * duration, not eliminated. True zero-frame-loss would require a
 * script hooking transition-start/stop events, which this project
 * intentionally does not use.
 */
function applyStingerOverride(scene, transitionDurationMs) {
  scene.private_settings = {
    ...(scene.private_settings || {}),
    transition: STINGER_NAME,
    transition_duration: Math.max(0, transitionDurationMs || 0),
  };
}

/**
 * Main entry point. Does not mutate `baseObsJson`.
 *
 * @param baseObsJson  output of Classic's buildObsJson() — untouched
 * @param opts.canvasW/canvasH  must match Classic's CANVAS_W/CANVAS_H
 * @param opts.lotPlans  Map<lotId, { cmsVideoId: string|null, videoScale, tagIds: string[] }>
 * @param opts.uniqueVideoSources  Map<cmsVideoId, localPath>  (FILE dedup for the local-path lookup only — never source sharing, see header)
 * @param opts.tagAssets  Map<tagId, { id, name, localPath, naturalWidth, naturalHeight, sortOrder }>
 * @param opts.tagLayout  { rightMargin, bottomMargin, spacing, tagHeight }
 * @param opts.stingerConfig  { enabled, localPath, durationMs, transitionPointMs } | null
 */
export function augmentObsJsonForBeta(baseObsJson, opts) {
  const { canvasW, canvasH, lotPlans, uniqueVideoSources, tagAssets, tagLayout, stingerConfig } = opts;
  const output = deepClone(baseObsJson);
  output.transitions = Array.isArray(output.transitions) ? output.transitions : [];

  const newSources = [];

  // One image_source per configured tag actually used anywhere in this auction.
  const usedTagIds = new Set();
  for (const plan of lotPlans.values()) (plan.tagIds || []).forEach(id => usedTagIds.add(id));
  const tagSourceById = new Map();
  for (const tagId of usedTagIds) {
    const asset = tagAssets.get(tagId);
    if (!asset) continue; // missing local image — handled as a build warning upstream, never a crash
    const src = makeImageSource(asset.localPath, `TAG - ${asset.name}`);
    tagSourceById.set(tagId, src);
    newSources.push(src);
  }

  const stingerEnabled = !!(stingerConfig && stingerConfig.enabled && stingerConfig.localPath);
  if (stingerEnabled) {
    output.transitions.push(buildStingerTransition(stingerConfig.localPath, stingerConfig.transitionPointMs));
  }

  // Walk scene_order (the REAL sequential playback order — output.sources
  // is an unordered bag) rather than output.sources directly, because
  // whether a Transition-type scene gets the stinger override depends on
  // what actually precedes it: only when that's a Lot Video scene. Video
  // scenes themselves are unconditional — every lot's video gets the
  // stinger going in, first lot included.
  //
  // This single adjacency rule is what excludes the two cases OBS's
  // destination-only mechanism would otherwise wrongly include (see
  // applyStingerOverride's comment for why there's no way to special-case
  // these without scripting, which this project intentionally does not
  // use — this scene_order check is the actual mechanism, not that one):
  //   - The show's very first Transition scene, entered right after the
  //     fixed intro scenes (CMS Logo, Waiting Room Scene, ...) — there's
  //     no preceding lot video for a stinger to visually follow.
  //   - A Lot Transition scene immediately preceded by a breed/type
  //     Transition scene (Charolais/Native/Holstein Transition) rather
  //     than a Video scene — same reasoning.
  const sceneByName = new Map();
  for (const s of output.sources) {
    if (s.id === 'scene') sceneByName.set(normalizeSceneName(s.name), s);
  }
  const sceneOrder = Array.isArray(output.scene_order) ? output.scene_order : [];

  let prevName = null;
  for (const entry of sceneOrder) {
    const name = normalizeSceneName(entry.name);
    const scene = sceneByName.get(name);
    const precededByLotVideo = isLotVideoScene(prevName || '');
    prevName = name;
    if (!scene) continue;

    if (isLotTransitionScene(name) || isBreedTransitionScene(name)) {
      if (stingerEnabled && precededByLotVideo) applyStingerOverride(scene, stingerConfig.durationMs);
      continue;
    }
    if (!isLotVideoScene(name)) continue;

    const lot = lotFromVideoSceneName(name);
    const plan = lotPlans.get(lot);
    if (!plan) continue; // lot outside the parsed CSV set — leave scene exactly as Classic built it

    const settings = scene.settings = scene.settings || {};
    const items = settings.items = settings.items || [];
    let nextId = Math.max(settings.id_counter || 0, ...items.map(it => Number(it.id) || 0), 0) + 1;

    // 1. Cattle video — bottom layer. INDEPENDENT ffmpeg_source per lot,
    //    even when two lots share the same physical file (see file
    //    header — this is the one non-negotiable architectural point).
    if (plan.cmsVideoId) {
      const localPath = uniqueVideoSources.get(plan.cmsVideoId);
      if (localPath) {
        const vsrc = makeMediaSource(localPath, `VIDEO - ${lot}`);
        newSources.push(vsrc);
        const scale = plan.videoScale || 1;
        items.push(makeSourceItem({
          sourceName: vsrc.name, sourceUuid: vsrc.uuid, itemId: nextId++,
          canvasW, canvasH, posX: 0, posY: 0, scaleX: scale, scaleY: scale,
        }));
      }
    }

    // 2. Stinger — a Transition Override on THIS scene only (see
    //    applyStingerOverride's comment for the full verified mechanism).
    //    This is NOT a scene item — it never touches `items`.
    if (stingerEnabled) {
      applyStingerOverride(scene, stingerConfig.durationMs);
    }

    // 3. Verification tags — top layer, bottom-right row, one independent
    //    scene item per tag (never combined into one composite image).
    const positions = layoutTagRow(plan.tagIds || [], tagAssets, tagLayout, canvasW, canvasH);
    for (const p of positions) {
      const tsrc = tagSourceById.get(p.tagId);
      if (!tsrc) continue;
      items.push(makeSourceItem({
        sourceName: tsrc.name, sourceUuid: tsrc.uuid, itemId: nextId++,
        canvasW, canvasH, posX: p.x, posY: p.y, scaleX: p.scale, scaleY: p.scale,
      }));
    }

    settings.id_counter = nextId;
  }

  output.sources = [...output.sources, ...newSources];
  return output;
}
