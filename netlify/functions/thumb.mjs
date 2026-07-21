/* =============================================================
 * CMS Auction Suite — Lot Images thumbnail proxy
 * -------------------------------------------------------------
 * The Lot Images tab needs to download YouTube's auto-generated
 * frame images (vi/<id>/1.jpg, 2.jpg, 3.jpg — real frames from
 * the video, NOT the custom uploaded thumbnail) so it can zip
 * them up client-side. i.ytimg.com does not send CORS headers,
 * so the browser can't read the image bytes directly. This tiny
 * function fetches the image server-side and returns it with
 * CORS enabled.
 *
 * It also handles quality fallback: maxres → sd → hq, returning
 * the best size that exists for the video.
 *
 * GET /api/thumb?id=<11-char video id>&frame=<1|2|3>
 * ============================================================= */

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const frame = url.searchParams.get("frame") || "2";

  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return new Response("Invalid video id", { status: 400 });
  }
  if (!/^[123]$/.test(frame)) {
    return new Response("Invalid frame (use 1, 2, or 3)", { status: 400 });
  }

  // Best quality first. hq{n} (480x360) exists for almost every video.
  const names = [`maxres${frame}`, `sd${frame}`, `hq${frame}`, `${frame}`];

  for (const name of names) {
    try {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      // YouTube serves a tiny gray placeholder for some missing sizes
      if (buf.byteLength < 2000) continue;
      return new Response(buf, {
        headers: {
          "Content-Type": "image/jpeg",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
          "X-Thumb-Variant": name,
        },
      });
    } catch {
      /* try next size */
    }
  }
  return new Response("No frame image found for this video", { status: 404 });
};

export const config = { path: "/api/thumb" };
