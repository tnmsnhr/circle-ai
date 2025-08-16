# Installation Guide

## Quick Setup

1. **Build the Extension**:
   ```bash
   npm install
   npm run build
   ```

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

3. **Start Using**:
   - Navigate to any webpage
   - Hold **⌘** (Command) key and draw circles/areas
   - Release to get AI analysis

## Troubleshooting

### Extension not loading?
- Make sure all files are in the `dist` folder
- Check that `manifest.json` is present
- Verify Chrome developer mode is enabled

### Drawing not working?
- Ensure you're holding the **⌘** (Command) key
- Try refreshing the webpage
- Check browser console for errors

### AI analysis not showing?
- The extension uses simulated AI responses
- Check the popup appears next to your selection
- Verify the extension is enabled

## Development

For development mode:
```bash
npm run dev
```

This will start a development server for the popup interface.
