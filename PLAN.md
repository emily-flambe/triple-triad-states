# Card Image Generation Plan

## Context

The Triple Triad game has 50 US state cards rendered as text-only with colored gradients. We want to generate artwork for each card using Gemini's image generation (nanobanana) and integrate the images into the card UI.

## Phase 1: Set Up nanobanana-mcp

```bash
# Clone and build
cd /tmp
git clone https://github.com/YCSE/nanobanana-mcp.git
cd nanobanana-mcp
npm install
npm run build

# Add to Claude Code (user provides GOOGLE_AI_API_KEY)
claude mcp add nanobanana-mcp "node" "$(pwd)/dist/index.js" \
  -e "GOOGLE_AI_API_KEY=<key>"
```

**Prereqs:** Node 18+, Google AI API key from https://makersuite.google.com/app/apikey

## Phase 2: Generate Card Images

### Directory Structure

```
public/
  images/
    cards/
      01-alabama.png
      02-alaska.png
      ...
      50-wyoming.png
```

### Generation Strategy

- **Model:** `gemini-2.5-flash-image` (fast) for drafts, `gemini-3-pro-image-preview` (quality) for finals
- **Aspect ratio:** `4:5` (matches card proportions ~100x130)
- **Consistency:** Use a shared `conversation_id` + `use_image_history` to maintain style across cards
- **Output path:** Directly to `public/images/cards/`

### Prompt Template

Each state gets a prompt based on its name and elements. Example structure:

```
A stylized illustration of [State] for a trading card game.
Featuring iconic [State] landscape: [element-specific scenery].
Style: vibrant, painterly, slightly fantastical. Top-down or panoramic perspective.
No text or labels.
```

Element-to-scenery mapping:
| Element | Scenery Keywords |
|---------|-----------------|
| ocean | coastline, waves, beaches, harbors |
| mountain | peaks, ridges, alpine terrain |
| desert | arid land, mesas, canyons, dunes |
| plain | rolling grasslands, prairies, farmland |
| swamp | wetlands, bayous, marshes, cypress trees |
| forest | dense woodlands, canopy, trails |

### Batch Workflow

Generate in batches of ~10 states, reviewing quality between batches. Use session consistency to keep art style uniform. Re-generate any outliers.

## Phase 3: Integrate Images into UI

### Files to Modify

- `public/index.html` — card CSS and `createCardElement()` function

### CSS Changes

Add background image layer to cards with a semi-transparent overlay to keep stats readable:

```css
.card {
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  z-index: 0;
}

.card.owner-0::before {
  background: linear-gradient(135deg, rgba(26,58,106,0.75), rgba(42,74,138,0.75));
}

.card.owner-1::before {
  background: linear-gradient(135deg, rgba(90,26,26,0.75), rgba(122,42,42,0.75));
}

.card-name, .card-values, .card-elements {
  position: relative;
  z-index: 1;
}
```

### JS Changes

Update `createCardElement()` (~line 768) to set background image:

```js
function createCardElement(card, owner, isHand) {
  const el = document.createElement('div');
  el.className = `${isHand ? 'hand-card' : 'card'} owner-${owner}`;

  // Add card image as background
  const padId = String(card.id).padStart(2, '0');
  const slug = card.name.toLowerCase().replace(/\s+/g, '-');
  el.style.backgroundImage = `url('/images/cards/${padId}-${slug}.png')`;

  // ... rest unchanged
}
```

### Player Color Distinction

The semi-transparent overlay preserves player colors (blue/red) while letting the artwork show through. The overlay opacity (0.75) can be tuned — lower = more art visible, higher = stronger color distinction.

## Phase 4: Optimization

- Compress PNGs with a tool like `pngquant` or convert to WebP
- Target ~50-100KB per image (50 cards = ~2.5-5MB total)
- Consider lazy loading for cards not yet visible

## Verification

1. Run `npm run dev` and play a game — confirm images appear on cards
2. Verify stats are readable over images
3. Verify player colors are distinguishable
4. Test on mobile viewport
5. Deploy with `npm run deploy` and verify on production
