# DEADROT

We lost the sky. Now we burn it back.

## Development

Open `index.html` in your browser or use a local server:

```bash
npx serve .
```

## Deployment

This project is configured for Vercel deployment:

1. Push to GitHub
2. Import in Vercel
3. Deploy

Or deploy directly:

```bash
npx vercel
```

## Configuration

Edit `data.json` to customize:

- **title**: Product name
- **tagline**: Value proposition
- **features**: Feature cards
- **faq**: FAQ items
- **formspree**: Your Formspree form ID (get one at https://formspree.io)

## Email Capture

To enable email capture:

1. Create a free form at [Formspree](https://formspree.io)
2. Copy your form ID (e.g., `xyzabcde`)
3. Add it to `data.json`: `"formspree": "xyzabcde"`

## Files

- `index.html` - Main page
- `styles.css` - Dark theme styles
- `script.js` - Dynamic content loading
- `data.json` - Editable content
- `vercel.json` - Deployment config
