# Dreamboard Module

The Dreamboard module is a creative visual board where users can draw, add text, and upload images to create their dream boards and visualize their goals and aspirations.

## Features

### 🎨 Drawing Tools
- **Freehand Drawing**: Click and drag to draw with custom brush sizes and colors
- **Brush Size Control**: Adjust brush size from 1px to 50px
- **Color Palette**: Choose from preset colors or use a custom color picker
- **Drawing Controls**: Undo last drawing and clear all drawings

### 📝 Text Elements
- **Add Text**: Click anywhere on the canvas or use the "Add Text" button
- **Edit Text**: Double-click any text element to edit its content
- **Drag to Move**: Click and drag text elements to reposition them

### 🖼️ Image Upload
- **Image Upload**: Upload images directly to the dreamboard
- **Supported Formats**: All standard image formats (JPG, PNG, GIF, etc.)
- **Image Manipulation**: Resize and move uploaded images
- **File Size Limit**: Maximum 10MB per image

### 🎯 Interactive Features
- **Drag and Drop**: All elements can be dragged to different positions
- **Selection**: Click to select elements (highlighted with blue border)
- **Layer Management**: Elements are automatically layered based on creation time
- **Delete**: Press Delete key to remove selected elements

## How to Use

### Getting Started
1. Navigate to `/dreamboard` from the main dashboard
2. Select your desired tool from the toolbar:
   - **Select**: Default tool for moving and selecting elements
   - **Text**: Click anywhere to add text elements
   - **Draw**: Enter drawing mode with brush controls
   - **Image**: Upload and manage images

### Drawing
1. Select the "Draw" tool from the toolbar
2. The drawing toolbar will appear with brush controls:
   - Adjust brush size with the slider
   - Choose colors from the palette or use custom color picker
   - Use "Undo" to remove the last drawing stroke
   - Use "Clear" to remove all drawings
3. Click and drag on the canvas to draw
4. Switch to "Select" tool to interact with other elements

### Adding Text
1. Select the "Text" tool or click "Add Text" button
2. Click anywhere on the canvas to add a new text element
3. Double-click any text element to edit its content
4. Press Enter to save changes or Escape to cancel

### Uploading Images
1. Click the "Upload Image" button in the toolbar
2. Select an image file from your device
3. The image will be automatically placed on the canvas
4. Drag to reposition or select and use handles to resize

### Managing Elements
- **Move**: Click and drag any element to move it
- **Select**: Click on an element to select it (blue border appears)
- **Delete**: Select an element and press the Delete key
- **Edit Text**: Double-click text elements to edit content

## Technical Details

### Data Storage
- All dreamboard items are stored in the `dreamboard_items` table
- Images are uploaded to Supabase storage bucket: `dreamboard-assets`
- Drawing data includes path coordinates, brush color, and stroke width
- Text elements store content and positioning information

### File Structure
```
components/dreamboard/
├── DreamboardCanvas.tsx      # Main canvas with Konva integration
├── DreamboardToolbar.tsx     # Main toolbar with tool selection
└── DrawingToolbar.tsx        # Drawing-specific controls

app/dreamboard/
└── page.tsx                  # Main dreamboard page component
```

### Dependencies
- `react-konva`: Canvas rendering and drawing functionality
- `konva`: 2D canvas library
- `use-image`: Image loading hook for Konva
- `@supabase/supabase-js`: Database and storage integration

## Tips and Tricks

1. **Organize Your Board**: Use different colors and text sizes to create visual hierarchy
2. **Layer Elements**: Newer elements appear on top - plan your layout accordingly
3. **Save Frequently**: Changes are automatically saved to the database
4. **Image Quality**: Upload high-quality images for better visual impact
5. **Drawing Precision**: Use smaller brush sizes for detailed drawings
6. **Color Coordination**: Use the color palette to maintain consistent themes

## Troubleshooting

### Common Issues
- **Images not loading**: Check internet connection and file format
- **Slow performance**: Try reducing the number of elements or image sizes
- **Drawing lag**: Reduce brush size or clear unnecessary drawings

### Browser Compatibility
- Works best in modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Canvas functionality requires HTML5 support