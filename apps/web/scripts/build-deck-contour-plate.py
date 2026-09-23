#!/usr/bin/env python3
"""Draw the deck's contour plate from the Sacred Valley's real elevation.

The sponsorship design base sets one of its four templates on a topographic
contour field. That artwork could not ship: it carries another author's
signature baked into the image, below and left of centre. This replaces it with
the same drawing made from the ground the hackathon actually happens on.

It is not an imitation of the shader — it is the shader's own measure, run on
the same DEM from directly overhead instead of from a camera in the valley:

    band    = elevation / spacing
    toLine  = |fract(band) - 0.5| / fwidth(band)
    contour = 1 - smoothstep(0, linePixels, toLine)

`components/landing/terrain-shader.ts` explains why that middle line is the
whole character of the drawing, and the reason holds here. Dividing by the
derivative keeps the stroke one pixel wide wherever the slope is gentle; where a
face steepens and the slices crowd closer than a pixel the measure collapses,
coverage saturates, and the flank fills solid white. Bright crowded walls, black
open valley floor, and no shading anywhere.

Two things differ from the landing, both because the camera is overhead:

The interval is fixed. On the landing it opens with distance, because one
spacing for a frame that runs from the valley floor to the far cordillera leaves
either the back as moire or the front as an empty shelf. Straight down, every
pixel is the same distance away, so there is nothing to compensate for.

There is no silhouette rim and no aerial fade. Both are functions of a viewing
direction this render does not have.

Usage:
    uv run --with numpy --with pillow python apps/web/scripts/build-deck-contour-plate.py

Elevation: Mapzen Terrain Tiles (terrarium) via AWS Open Data, SRTM courtesy of
the U.S. Geological Survey. Same source and the same on-disk cache as the GLB
builders beside this file — see public/models/README.md for attribution.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from terrain_common import (  # noqa: E402
    DEM_URL,
    DEM_ZOOM,
    SACRED_VALLEY_AREA,
    decode_terrarium,
    fetch_mosaic,
    mercator_xy,
)

OUT = Path(__file__).resolve().parents[1] / "public" / "deck" / "contour.avif"

# Metres between slices.
#
# 110 m, which is wide for a map and the point. At the 45 m a chart would use,
# the Andes at 19 m per pixel put a line through nearly every pixel and the
# plate reads as grain — fine as a drawing, useless as a ground for white type.
CONTOUR_METRES = 110.0

# Radius, in DEM pixels, of the blur applied before slicing.
#
# The ridges here are genuinely rough at 19 m per pixel, and every one of those
# roughnesses becomes its own closed contour. Smoothing first is what turns a
# survey map into the flowing field the design base draws: it keeps the valley's
# real shape and drops the scree.
SMOOTH_PIXELS = 4.0

# Stroke width, in output pixels, before the supersample is resolved.
#
# Wider than a hairline because this plate is never seen raw: it sits under a
# veil that takes more than half its light before any type lands on it.
LINE_PIXELS = 1.7

# Width the plate is written at.
#
# The DEM gives 3320 px across the valley, which is more than the deck can show
# — the PDF export screenshots at 3200 for the whole slide, and this plate is
# cropped to fill it. 2048 stays sharp there and costs a third of the bytes.
OUT_WIDTH = 2048

# Contours are computed at twice the output resolution and averaged down. A
# contour is a hairline by construction, and a hairline rasterised at 1:1
# aliases into dashes the moment the slope turns diagonal.
SUPERSAMPLE = 2


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def crop_to_area(elevation: np.ndarray, tile_x0: int, tile_y0: int) -> np.ndarray:
    """Trim the tile mosaic to the area itself.

    `fetch_mosaic` returns whole tiles, so the mosaic overhangs the bounding box
    by up to a tile on each side. The overhang is real ground and would render
    fine, but it makes the plate's framing depend on where the tile grid happens
    to fall rather than on the valley.
    """
    west, north = mercator_xy(
        SACRED_VALLEY_AREA.lat_north, SACRED_VALLEY_AREA.lon_west, DEM_ZOOM
    )
    east, south = mercator_xy(
        SACRED_VALLEY_AREA.lat_south, SACRED_VALLEY_AREA.lon_east, DEM_ZOOM
    )
    x0 = int(round((west - tile_x0) * 256.0))
    y0 = int(round((north - tile_y0) * 256.0))
    x1 = int(round((east - tile_x0) * 256.0))
    y1 = int(round((south - tile_y0) * 256.0))
    return elevation[y0:y1, x0:x1]


def smooth(elevation: np.ndarray, radius: float) -> np.ndarray:
    """Separable Gaussian blur, written out rather than imported.

    Pillow's own filter refuses float images, and pulling scipy in for one
    convolution would be the heaviest dependency in this directory. A Gaussian
    is separable, so two 1-D passes do it, each one a weighted sum of shifted
    views — no Python loop over pixels.
    """
    sigma = radius / 2.0
    half = max(1, int(round(radius * 3.0)))
    offsets = np.arange(-half, half + 1)
    kernel = np.exp(-(offsets**2) / (2.0 * sigma**2))
    kernel /= kernel.sum()

    rows, cols = elevation.shape

    padded = np.pad(elevation, ((0, 0), (half, half)), mode="edge")
    blurred = sum(
        weight * padded[:, i : i + cols] for i, weight in enumerate(kernel)
    )

    padded = np.pad(blurred, ((half, half), (0, 0)), mode="edge")
    return sum(weight * padded[i : i + rows, :] for i, weight in enumerate(kernel))


def upsample(elevation: np.ndarray, factor: int) -> np.ndarray:
    height, width = elevation.shape
    image = Image.fromarray(elevation.astype(np.float32), mode="F")
    resized = image.resize((width * factor, height * factor), Image.BILINEAR)
    return np.asarray(resized, dtype=np.float64)


def contour_coverage(elevation: np.ndarray, spacing: float) -> np.ndarray:
    band = elevation / spacing

    # `fwidth` in GLSL is |dFdx| + |dFdy|. np.gradient gives the central
    # difference per axis, which is the same measure on a raster.
    d_rows, d_cols = np.gradient(band)
    fwidth = np.abs(d_cols) + np.abs(d_rows)

    to_line = np.abs(np.mod(band, 1.0) - 0.5) / np.maximum(fwidth, 1e-5)
    return 1.0 - smoothstep(0.0, LINE_PIXELS, to_line)


def main() -> None:
    mosaic, tile_x0, tile_y0 = fetch_mosaic(
        DEM_URL, SACRED_VALLEY_AREA, DEM_ZOOM, "dem"
    )
    elevation = crop_to_area(decode_terrarium(mosaic), tile_x0, tile_y0)
    print(
        f"valley: {elevation.shape[1]}x{elevation.shape[0]} px, "
        f"{elevation.min():.0f}-{elevation.max():.0f} m"
    )

    coverage = contour_coverage(
        upsample(smooth(elevation, SMOOTH_PIXELS), SUPERSAMPLE), CONTOUR_METRES
    )

    plate = Image.fromarray(
        np.clip(coverage * 255.0, 0, 255).astype(np.uint8), mode="L"
    )
    height = round(plate.height * OUT_WIDTH / plate.width)
    plate = plate.resize((OUT_WIDTH, height), Image.LANCZOS)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # AVIF preserves the one-pixel contour field at less than half the bytes of
    # the previous WebP. Pillow's `speed` is inverse to encoder effort.
    plate.save(OUT, quality=48, speed=4, subsampling="4:2:0")
    print(f"wrote {OUT.relative_to(Path.cwd())} — {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
