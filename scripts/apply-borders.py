#!/usr/bin/env python3
"""Apply element-colored ornate borders to Triple Triad state card images.

The border template frames the card artwork from the OUTSIDE. The card art is
scaled down to fit inside the border's center opening, then the tinted border
is composited on top.

Each border side is tinted to match the card's element for that compass direction
using a multiply blend that preserves the metallic filigree detail.

Usage:
    python3 scripts/apply-borders.py --card 06-colorado
    python3 scripts/apply-borders.py --all
"""

import argparse
import math
import os
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageEnhance

# --- Element colors (RGB) ---
ELEMENT_COLORS = {
    "ocean":    (30, 100, 180),
    "mountain": (100, 70, 50),
    "desert":   (200, 120, 40),
    "plain":    (80, 150, 60),
    "swamp":    (40, 100, 80),
    "forest":   (30, 80, 30),
}

# --- Side elements per card: (top, right, bottom, left) = (N, E, S, W) ---
# Each side assigned based on real geography of that state's borders.
# Only elements from the card's element list are used.
SIDE_ELEMENTS = {
    #                            N            E            S            W
    "01-alabama":       ("forest",   "plain",    "forest",   "forest"),
    "02-alaska":        ("ocean",    "mountain", "ocean",    "ocean"),
    "03-arizona":       ("mountain", "desert",   "desert",   "desert"),
    "04-arkansas":      ("forest",   "swamp",    "swamp",    "forest"),
    "05-california":    ("mountain", "mountain", "mountain", "ocean"),
    "06-colorado":      ("mountain", "plain",    "mountain", "mountain"),
    "07-connecticut":   ("forest",   "forest",   "ocean",    "forest"),
    "08-delaware":      ("swamp",    "ocean",    "swamp",    "swamp"),
    "09-florida":       ("swamp",    "ocean",    "ocean",    "ocean"),
    "10-georgia":       ("forest",   "ocean",    "forest",   "forest"),
    "11-hawaii":        ("ocean",    "forest",   "ocean",    "ocean"),
    "12-idaho":         ("forest",   "mountain", "mountain", "mountain"),
    "13-illinois":      ("plain",    "forest",   "forest",   "plain"),
    "14-indiana":       ("plain",    "plain",    "forest",   "plain"),
    "15-iowa":          ("plain",    "forest",   "plain",    "forest"),
    "16-kansas":        ("plain",    "plain",    "plain",    "desert"),
    "17-kentucky":      ("forest",   "mountain", "forest",   "forest"),
    "18-louisiana":     ("swamp",    "swamp",    "ocean",    "swamp"),
    "19-maine":         ("forest",   "ocean",    "ocean",    "forest"),
    "20-maryland":      ("forest",   "ocean",    "ocean",    "forest"),
    "21-massachusetts": ("forest",   "ocean",    "ocean",    "forest"),
    "22-michigan":      ("forest",   "ocean",    "forest",   "ocean"),
    "23-minnesota":     ("forest",   "forest",   "plain",    "plain"),
    "24-mississippi":   ("forest",   "forest",   "swamp",    "swamp"),
    "25-missouri":      ("plain",    "forest",   "forest",   "plain"),
    "26-montana":       ("mountain", "plain",    "plain",    "mountain"),
    "27-nebraska":      ("plain",    "plain",    "plain",    "desert"),
    "28-nevada":        ("desert",   "desert",   "desert",   "mountain"),
    "29-new-hampshire": ("mountain", "forest",   "forest",   "forest"),
    "30-new-jersey":    ("swamp",    "ocean",    "swamp",    "swamp"),
    "31-new-mexico":    ("mountain", "desert",   "desert",   "mountain"),
    "32-new-york":      ("mountain", "mountain", "ocean",    "ocean"),
    "33-north-carolina":("mountain", "ocean",    "ocean",    "mountain"),
    "34-north-dakota":  ("plain",    "plain",    "plain",    "plain"),
    "35-ohio":          ("plain",    "forest",   "forest",   "plain"),
    "36-oklahoma":      ("plain",    "plain",    "plain",    "desert"),
    "37-oregon":        ("forest",   "forest",   "forest",   "ocean"),
    "38-pennsylvania":  ("mountain", "forest",   "forest",   "mountain"),
    "39-rhode-island":  ("ocean",    "ocean",    "ocean",    "ocean"),
    "40-south-carolina":("swamp",    "ocean",    "ocean",    "swamp"),
    "41-south-dakota":  ("plain",    "plain",    "plain",    "mountain"),
    "42-tennessee":     ("forest",   "mountain", "forest",   "forest"),
    "43-texas":         ("plain",    "plain",    "desert",   "desert"),
    "44-utah":          ("mountain", "desert",   "desert",   "desert"),
    "45-vermont":       ("mountain", "forest",   "forest",   "mountain"),
    "46-virginia":      ("mountain", "ocean",    "mountain", "mountain"),
    "47-washington":    ("mountain", "mountain", "mountain", "ocean"),
    "48-west-virginia": ("mountain", "mountain", "forest",   "mountain"),
    "49-wisconsin":     ("forest",   "forest",   "plain",    "forest"),
    "50-wyoming":       ("mountain", "plain",    "plain",    "mountain"),
}

CARDS_DIR = "public/images/cards"
BORDER_TEMPLATE = os.path.join(CARDS_DIR, "border-template-v1.png")
OUTPUT_DIR = os.path.join(CARDS_DIR, "bordered")

# Brightness threshold: pixels below this in the template become transparent
BRIGHTNESS_THRESHOLD = 40
# Post-multiply brightness boost to compensate for darkening
BRIGHTNESS_BOOST = 1.4
# Angular gradient width (degrees) at diagonal seams between quadrant colors.
# At 0° the seam is a hard line; at 30° each side blends 15° into its neighbor.
GRADIENT_WIDTH_DEG = 30
# Border inset: where the border's inner edge sits (px from each side).
# Card art fills this opening. Use the "typical" edge value, not corner ornament max,
# so corner ornaments overlap the art slightly (looks natural).
BORDER_INSET = 148
# Flood fill threshold for background removal (pixels with max RGB <= this are "outside")
BG_FLOOD_THRESHOLD = 30


def remove_background(img: Image.Image) -> Image.Image:
    """Remove black exterior background via flood fill from edges. Returns RGBA."""
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    brightness = arr[:, :, :3].max(axis=2)

    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Seed from all dark edge pixels
    for x in range(w):
        for y in (0, h - 1):
            if brightness[y, x] <= BG_FLOOD_THRESHOLD:
                queue.append((y, x))
                visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if brightness[y, x] <= BG_FLOOD_THRESHOLD:
                queue.append((y, x))
                visited[y, x] = True

    # BFS through connected dark pixels
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and brightness[ny, nx] <= BG_FLOOD_THRESHOLD:
                visited[ny, nx] = True
                queue.append((ny, nx))

    # Flooded pixels become fully transparent
    arr[visited, 3] = 0

    # Anti-alias: non-flooded pixels adjacent to flooded get alpha from brightness
    border_mask = np.zeros((h, w), dtype=bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.roll(visited, (dy, dx), axis=(0, 1))
        border_mask |= (~visited & shifted)
    arr[border_mask, 3] = np.clip(brightness[border_mask] * 2.55, 0, 255).astype(np.uint8)

    return Image.fromarray(arr)


def make_border_alpha(template_gray: Image.Image) -> Image.Image:
    """Create alpha channel: bright pixels opaque, dark pixels transparent."""
    return template_gray.point(lambda p: 255 if p > BRIGHTNESS_THRESHOLD else 0)


def make_quadrant_weights(size: tuple) -> list:
    """Create 4 weight arrays (top, right, bottom, left) with angular gradients.

    Each pixel gets weights based on its angle from center. At the diagonal
    boundaries, weights blend smoothly over GRADIENT_WIDTH_DEG degrees.
    Weights are normalized to sum to 1.0 at every pixel.

    Returns list of 4 numpy float32 arrays, shape (h, w).
    """
    w, h = size
    cx, cy = w / 2, h / 2
    half_grad = math.radians(GRADIENT_WIDTH_DEG / 2)

    # Center angles for each quadrant (radians, math convention: 0=right, CCW positive)
    # But atan2 with image coords (y increases down) gives: right=0, down=+, up=-
    # Quadrant center angles in atan2 space:
    #   top: -pi/2, right: 0, bottom: pi/2, left: pi (or -pi)
    quad_centers = {
        "top":    -math.pi / 2,
        "right":  0,
        "bottom": math.pi / 2,
        "left":   math.pi,
    }
    # Diagonal boundary angles (between adjacent quadrants)
    # top-right: -pi/4, right-bottom: pi/4, bottom-left: 3pi/4, left-top: -3pi/4
    boundaries = [-3 * math.pi / 4, -math.pi / 4, math.pi / 4, 3 * math.pi / 4]

    # Compute angle for every pixel
    ys, xs = np.mgrid[0:h, 0:w]
    dx = xs - cx
    dy = ys - cy
    angles = np.arctan2(dy, dx)  # range [-pi, pi]

    def angular_distance(a, b):
        """Shortest angular distance, handling wraparound."""
        d = a - b
        return np.abs(np.arctan2(np.sin(d), np.cos(d)))

    quad_names = ["top", "right", "bottom", "left"]
    raw_weights = []
    for name in quad_names:
        center = quad_centers[name]
        # Weight = 1 at quadrant center, falls to 0 at half_grad past boundary
        dist = angular_distance(angles, center)
        # Max angular distance within this quadrant is pi/4 (to nearest boundary)
        # Start fading at pi/4 - half_grad, reach 0 at pi/4 + half_grad
        fade_start = math.pi / 4 - half_grad
        fade_end = math.pi / 4 + half_grad
        if fade_end <= fade_start:
            # Gradient width >= 90°, just use linear from 0 to pi/2
            weight = np.clip(1.0 - dist / (math.pi / 2), 0, 1)
        else:
            weight = np.where(
                dist <= fade_start, 1.0,
                np.where(dist >= fade_end, 0.0,
                         1.0 - (dist - fade_start) / (fade_end - fade_start))
            )
        raw_weights.append(weight.astype(np.float32))

    # Normalize so weights sum to 1.0 at every pixel
    total = raw_weights[0] + raw_weights[1] + raw_weights[2] + raw_weights[3]
    total = np.maximum(total, 1e-6)  # avoid division by zero at exact center
    return [w / total for w in raw_weights]


def tint_multiply(image: Image.Image, color: tuple) -> Image.Image:
    """Multiply-blend image RGB with a solid color. Uses Pillow ops (fast)."""
    color_layer = Image.new("RGB", image.size, color)
    multiplied = ImageChops.multiply(image.convert("RGB"), color_layer)
    # Brightness boost to compensate for multiply darkening
    multiplied = ImageEnhance.Brightness(multiplied).enhance(BRIGHTNESS_BOOST)
    return multiplied


def apply_border(card_name: str) -> str:
    """Apply element-tinted border to a single card. Returns output path."""
    if card_name not in SIDE_ELEMENTS:
        raise ValueError(f"No side elements defined for '{card_name}'")

    elements = SIDE_ELEMENTS[card_name]  # (top, right, bottom, left)
    card_path = os.path.join(CARDS_DIR, f"{card_name}.png")
    if not os.path.exists(card_path):
        raise FileNotFoundError(f"Card image not found: {card_path}")

    print(f"Processing {card_name}...")
    print(f"  Elements: top={elements[0]}, right={elements[1]}, bottom={elements[2]}, left={elements[3]}")

    # Load images
    template = Image.open(BORDER_TEMPLATE).convert("RGB")
    card = Image.open(card_path).convert("RGB")
    w, h = template.size

    # --- Step 1: Create border alpha (bright=opaque, dark=transparent) ---
    template_gray = template.convert("L")
    border_alpha = make_border_alpha(template_gray)

    # --- Step 2: Build tinted border with gradient blending at seams ---
    print("  Computing quadrant weights (gradient blend)...")
    quad_weights = make_quadrant_weights((w, h))  # [top, right, bottom, left]
    quadrant_names = ["top", "right", "bottom", "left"]

    # Create 4 tinted versions and weight-average them
    print("  Tinting and blending border quadrants...")
    blended = np.zeros((h, w, 3), dtype=np.float32)
    for i, quad_name in enumerate(quadrant_names):
        element = elements[i]
        color = ELEMENT_COLORS[element]
        print(f"    {quad_name}: {element} -> rgb{color}")

        tinted = tint_multiply(template, color)
        tinted_arr = np.array(tinted, dtype=np.float32)
        weight = quad_weights[i][:, :, np.newaxis]  # broadcast to (h, w, 3)
        blended += tinted_arr * weight

    tinted_rgb = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8), "RGB")

    # Combine tinted RGB with border alpha into RGBA border layer
    border_layer = tinted_rgb.convert("RGBA")
    border_layer.putalpha(border_alpha)

    # --- Step 3: Scale card art to fit inside the border opening ---
    opening_w = w - 2 * BORDER_INSET
    opening_h = h - 2 * BORDER_INSET
    print(f"  Scaling card art to {opening_w}x{opening_h} for center opening...")
    card_resized = card.resize((opening_w, opening_h), Image.LANCZOS)

    # --- Step 4: Composite — card art as base, border on top ---
    print("  Compositing...")
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    canvas.paste(card_resized, (BORDER_INSET, BORDER_INSET))
    result = Image.alpha_composite(canvas, border_layer)

    # --- Step 5: Remove black exterior background ---
    print("  Removing background...")
    result = remove_background(result)

    # Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{card_name}.png")
    result.save(output_path, "PNG")
    print(f"  Saved: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Apply element-colored borders to card images")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--card", help="Single card to process, e.g. '06-colorado'")
    group.add_argument("--all", action="store_true", help="Process all cards with defined side elements")
    args = parser.parse_args()

    if args.card:
        apply_border(args.card)
    elif args.all:
        for card_name in sorted(SIDE_ELEMENTS.keys()):
            try:
                apply_border(card_name)
            except Exception as e:
                print(f"  ERROR: {e}", file=sys.stderr)
        print(f"\nDone. Processed {len(SIDE_ELEMENTS)} cards.")


if __name__ == "__main__":
    main()
