export interface FrameTemplate {
  name: string;
  category: string;
  svg: (width: number, height: number, options?: any) => string;
  preview: string;
  options?: {
    color?: string;
    strokeWidth?: number;
    pattern?: string;
  };
}

export const FRAME_CATEGORIES = {
  'Basic': 'Simple borders and shapes',
  'Decorative': 'Ornate and artistic frames',
  'Modern': 'Contemporary and minimalist designs',
  'Vintage': 'Classic and retro styles',
  'Nature': 'Organic and nature-inspired patterns',
  'Geometric': 'Mathematical and geometric patterns',
  'Patterns': 'Repeating patterns and textures',
} as const;

export const FRAME_TEMPLATES: Record<keyof typeof FRAME_CATEGORIES, FrameTemplate[]> = {
  'Basic': [
    {
      name: 'Simple Border',
      category: 'Basic',
      svg: (width: number, height: number, options = {}) => {
        const { color = '#333333', strokeWidth = 2 } = options;
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${strokeWidth/2}" y="${strokeWidth/2}" width="${width-strokeWidth}" height="${height-strokeWidth}" 
                fill="none" stroke="${color}" stroke-width="${strokeWidth}" rx="4"/>
        </svg>`;
      },
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="1" y="1" width="58" height="38" fill="none" stroke="#333" stroke-width="2" rx="2"/></svg>`
    },
    {
      name: 'Double Border',
      category: 'Basic',
      svg: (width: number, height: number, options = {}) => {
        const { color = '#333333', strokeWidth = 1 } = options;
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${strokeWidth*2}" y="${strokeWidth*2}" width="${width-strokeWidth*4}" height="${height-strokeWidth*4}" 
                fill="none" stroke="${color}" stroke-width="${strokeWidth}" rx="4"/>
          <rect x="${strokeWidth*6}" y="${strokeWidth*6}" width="${width-strokeWidth*12}" height="${height-strokeWidth*12}" 
                fill="none" stroke="${color}" stroke-width="${strokeWidth}" rx="2"/>
        </svg>`;
      },
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="none" stroke="#333" stroke-width="1" rx="2"/><rect x="6" y="6" width="48" height="28" fill="none" stroke="#333" stroke-width="1" rx="1"/></svg>`
    },
    {
      name: 'Rounded',
      category: 'Basic',
      svg: (width: number, height: number, options = {}) => {
        const { color = '#666666', strokeWidth = 3 } = options;
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${strokeWidth}" y="${strokeWidth}" width="${width-strokeWidth*2}" height="${height-strokeWidth*2}" 
                fill="rgba(255,255,255,0.1)" stroke="${color}" stroke-width="${strokeWidth}" rx="15"/>
        </svg>`;
      },
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="3" y="3" width="54" height="34" fill="rgba(255,255,255,0.1)" stroke="#666" stroke-width="2" rx="8"/></svg>`
    },
    {
      name: 'Dashed Border',
      category: 'Basic',
      svg: (width: number, height: number, options = {}) => {
        const { color = '#4a90e2', strokeWidth = 2 } = options;
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${strokeWidth}" y="${strokeWidth}" width="${width-strokeWidth*2}" height="${height-strokeWidth*2}" 
                fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="10,5" rx="4"/>
        </svg>`;
      },
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="2" y="2" width="56" height="36" fill="none" stroke="#4a90e2" stroke-width="2" stroke-dasharray="6,3" rx="2"/></svg>`
    }
  ],
  'Decorative': [
    {
      name: 'Ornate Gold',
      category: 'Decorative',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
            </linearGradient>
            <pattern id="dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1" fill="#B8860B"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="20" fill="url(#goldGrad)"/>
          <rect x="0" y="${height-20}" width="${width}" height="20" fill="url(#goldGrad)"/>
          <rect x="0" y="20" width="20" height="${height-40}" fill="url(#goldGrad)"/>
          <rect x="${width-20}" y="20" width="20" height="${height-40}" fill="url(#goldGrad)"/>
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="url(#dots)" stroke="#B8860B" stroke-width="2" stroke-dasharray="3,3"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="0" y="0" width="60" height="8" fill="#FFD700"/><rect x="0" y="32" width="60" height="8" fill="#FFD700"/><rect x="0" y="8" width="8" height="24" fill="#FFD700"/><rect x="52" y="8" width="8" height="24" fill="#FFD700"/></svg>`
    },
    {
      name: 'Floral Pattern',
      category: 'Decorative',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="floral" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="8" fill="none" stroke="#4a5568" stroke-width="1"/>
              <path d="M 20 12 Q 16 16 20 20 Q 24 16 20 12 Z" fill="#68d391"/>
              <path d="M 28 20 Q 24 16 20 20 Q 24 24 28 20 Z" fill="#68d391"/>
              <path d="M 20 28 Q 24 24 20 20 Q 16 24 20 28 Z" fill="#68d391"/>
              <path d="M 12 20 Q 16 24 20 20 Q 16 16 12 20 Z" fill="#68d391"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#floral)" opacity="0.3"/>
          <rect x="10" y="10" width="${width-20}" height="${height-20}" 
                fill="none" stroke="#2d3748" stroke-width="3" rx="8"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="5" y="5" width="50" height="30" fill="none" stroke="#2d3748" stroke-width="2" rx="4"/><circle cx="15" cy="15" r="3" fill="#68d391" opacity="0.5"/><circle cx="45" cy="25" r="3" fill="#68d391" opacity="0.5"/></svg>`
    },
    {
      name: 'Celtic Knot',
      category: 'Decorative',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="celtic" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 5 5 Q 15 0 25 5 Q 30 15 25 25 Q 15 30 5 25 Q 0 15 5 5 Z" 
                    fill="none" stroke="#8b4513" stroke-width="2"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="#f7fafc"/>
          <rect x="15" y="15" width="${width-30}" height="${height-30}" 
                fill="url(#celtic)" opacity="0.6"/>
          <rect x="10" y="10" width="${width-20}" height="${height-20}" 
                fill="none" stroke="#8b4513" stroke-width="4" rx="10"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="5" y="5" width="50" height="30" fill="none" stroke="#8b4513" stroke-width="2" rx="5"/><path d="M 15 15 Q 20 12 25 15 Q 28 20 25 25 Q 20 28 15 25 Q 12 20 15 15 Z" fill="none" stroke="#8b4513" stroke-width="1"/></svg>`
    }
  ],
  'Modern': [
    {
      name: 'Neon Glow',
      category: 'Modern',
      svg: (width: number, height: number, options = {}) => {
        const { color = '#00ffff' } = options;
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect x="10" y="10" width="${width-20}" height="${height-20}" 
                fill="none" stroke="${color}" stroke-width="3" rx="8" 
                filter="url(#glow)"/>
          <rect x="15" y="15" width="${width-30}" height="${height-30}" 
                fill="none" stroke="#ff00ff" stroke-width="1" rx="5" 
                opacity="0.7"/>
        </svg>`;
      },
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="5" y="5" width="50" height="30" fill="none" stroke="#00ffff" stroke-width="2" rx="4"/></svg>`
    },
    {
      name: 'Gradient Shadow',
      category: 'Modern',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="shadowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
            <filter id="dropshadow" x="0" y="0" width="120%" height="120%">
              <feDropShadow dx="5" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/>
            </filter>
          </defs>
          <rect x="10" y="10" width="${width-20}" height="${height-20}" 
                fill="url(#shadowGrad)" rx="12" filter="url(#dropshadow)" opacity="0.9"/>
          <rect x="15" y="15" width="${width-30}" height="${height-30}" 
                fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" 
                stroke-width="1" rx="8"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="5" y="5" width="50" height="30" fill="#667eea" rx="6" opacity="0.8"/></svg>`
    },
    {
      name: 'Minimal Line',
      category: 'Modern',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="none" stroke="#2d3748" stroke-width="1" rx="2"/>
          <line x1="0" y1="0" x2="30" y2="0" stroke="#2d3748" stroke-width="2"/>
          <line x1="${width-30}" y1="0" x2="${width}" y2="0" stroke="#2d3748" stroke-width="2"/>
          <line x1="0" y1="${height}" x2="30" y2="${height}" stroke="#2d3748" stroke-width="2"/>
          <line x1="${width-30}" y1="${height}" x2="${width}" y2="${height}" stroke="#2d3748" stroke-width="2"/>
          <line x1="0" y1="0" x2="0" y2="30" stroke="#2d3748" stroke-width="2"/>
          <line x1="0" y1="${height-30}" x2="0" y2="${height}" stroke="#2d3748" stroke-width="2"/>
          <line x1="${width}" y1="0" x2="${width}" y2="30" stroke="#2d3748" stroke-width="2"/>
          <line x1="${width}" y1="${height-30}" x2="${width}" y2="${height}" stroke="#2d3748" stroke-width="2"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="10" y="10" width="40" height="20" fill="none" stroke="#2d3748" stroke-width="1"/><line x1="0" y1="0" x2="15" y2="0" stroke="#2d3748" stroke-width="1"/><line x1="45" y1="0" x2="60" y2="0" stroke="#2d3748" stroke-width="1"/></svg>`
    }
  ],
  'Vintage': [
    {
      name: 'Victorian',
      category: 'Vintage',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="vintage" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#8b4513;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#a0522d;stop-opacity:1" />
            </radialGradient>
            <pattern id="damask" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 25 5 Q 15 15 25 25 Q 35 15 25 5 Z" fill="#654321" opacity="0.3"/>
              <path d="M 25 45 Q 35 35 25 25 Q 15 35 25 45 Z" fill="#654321" opacity="0.3"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vintage)"/>
          <rect x="25" y="25" width="${width-50}" height="${height-50}" fill="url(#damask)"/>
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="none" stroke="#654321" stroke-width="4" rx="8"/>
          <rect x="25" y="25" width="${width-50}" height="${height-50}" 
                fill="none" stroke="#8b4513" stroke-width="2" rx="5"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="0" y="0" width="60" height="40" fill="#8b4513"/><rect x="10" y="10" width="40" height="20" fill="none" stroke="#654321" stroke-width="2" rx="4"/></svg>`
    },
    {
      name: 'Art Deco',
      category: 'Vintage',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="artdeco" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#ffa500;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
            </linearGradient>
          </defs>
          <polygon points="0,0 ${width},0 ${width-30},30 30,30" fill="url(#artdeco)"/>
          <polygon points="0,${height} ${width},${height} ${width-30},${height-30} 30,${height-30}" fill="url(#artdeco)"/>
          <polygon points="0,30 30,30 30,${height-30} 0,${height-30}" fill="url(#artdeco)"/>
          <polygon points="${width-30},30 ${width},0 ${width},${height} ${width-30},${height-30}" fill="url(#artdeco)"/>
          <rect x="30" y="30" width="${width-60}" height="${height-60}" 
                fill="none" stroke="#b8860b" stroke-width="3"/>
          ${Array.from({length: Math.floor((width-60)/40)}, (_, i) => 
            `<line x1="${40 + i*40}" y1="40" x2="${45 + i*40}" y2="${height-40}" stroke="#b8860b" stroke-width="2"/>`
          ).join('')}
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><polygon points="0,0 60,0 45,15 15,15" fill="#ffd700"/><polygon points="0,40 60,40 45,25 15,25" fill="#ffd700"/><rect x="15" y="15" width="30" height="10" fill="none" stroke="#b8860b" stroke-width="1"/></svg>`
    }
  ],
  'Nature': [
    {
      name: 'Wood Grain',
      category: 'Nature',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wood" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
              <rect width="40" height="20" fill="#deb887"/>
              <path d="M 0 10 Q 10 5 20 10 Q 30 15 40 10" 
                    stroke="#8b4513" stroke-width="1" fill="none"/>
              <path d="M 0 5 Q 15 8 30 5 Q 35 7 40 5" 
                    stroke="#a0522d" stroke-width="0.5" fill="none"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#wood)"/>
          <rect x="15" y="15" width="${width-30}" height="${height-30}" 
                fill="none" stroke="#654321" stroke-width="4" rx="8"/>
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="rgba(255,255,255,0.1)" stroke="#8b4513" stroke-width="2" rx="5"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="0" y="0" width="60" height="40" fill="#deb887"/><path d="M 0 20 Q 15 15 30 20 Q 45 25 60 20" stroke="#8b4513" stroke-width="1" fill="none"/><rect x="8" y="8" width="44" height="24" fill="none" stroke="#654321" stroke-width="2" rx="4"/></svg>`
    },
    {
      name: 'Bamboo',
      category: 'Nature',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bamboo" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#90ee90;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#228b22;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#006400;stop-opacity:1" />
            </linearGradient>
          </defs>
          <!-- Bamboo stalks on sides -->
          <rect x="0" y="0" width="15" height="${height}" fill="url(#bamboo)"/>
          <rect x="${width-15}" y="0" width="15" height="${height}" fill="url(#bamboo)"/>
          <!-- Bamboo joints -->
          ${Array.from({length: Math.floor(height/40)}, (_, i) => 
            `<line x1="0" y1="${(i+1)*40}" x2="15" y2="${(i+1)*40}" stroke="#006400" stroke-width="3"/>
             <line x1="${width-15}" y1="${(i+1)*40}" x2="${width}" y2="${(i+1)*40}" stroke="#006400" stroke-width="3"/>`
          ).join('')}
          <rect x="15" y="20" width="${width-30}" height="${height-40}" 
                fill="rgba(255,255,255,0.05)" stroke="#228b22" stroke-width="2" rx="5"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="0" y="0" width="8" height="40" fill="#228b22"/><rect x="52" y="0" width="8" height="40" fill="#228b22"/><line x1="0" y1="20" x2="8" y2="20" stroke="#006400" stroke-width="2"/><line x1="52" y1="20" x2="60" y2="20" stroke="#006400" stroke-width="2"/><rect x="8" y="10" width="44" height="20" fill="none" stroke="#228b22" stroke-width="1" rx="3"/></svg>`
    }
  ],
  'Geometric': [
    {
      name: 'Hexagon Pattern',
      category: 'Geometric',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hexagons" x="0" y="0" width="40" height="35" patternUnits="userSpaceOnUse">
              <polygon points="20,0 30,8.66 30,26 20,35 10,26 10,8.66" 
                       fill="none" stroke="#4a90e2" stroke-width="1"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#hexagons)" opacity="0.3"/>
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="none" stroke="#2c5aa0" stroke-width="3" rx="5"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><polygon points="15,5 20,8 20,12 15,15 10,12 10,8" fill="none" stroke="#4a90e2" stroke-width="1"/><polygon points="45,20 50,23 50,27 45,30 40,27 40,23" fill="none" stroke="#4a90e2" stroke-width="1"/><rect x="10" y="10" width="40" height="20" fill="none" stroke="#2c5aa0" stroke-width="2" rx="3"/></svg>`
    },
    {
      name: 'Triangle Mosaic',
      category: 'Geometric',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="triangles" x="0" y="0" width="30" height="26" patternUnits="userSpaceOnUse">
              <polygon points="15,0 30,26 0,26" fill="#e6f3ff" stroke="#2196f3" stroke-width="1"/>
              <polygon points="15,26 0,0 30,0" fill="#f0f8ff" stroke="#1976d2" stroke-width="1"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#triangles)" opacity="0.4"/>
          <rect x="25" y="25" width="${width-50}" height="${height-50}" 
                fill="none" stroke="#1565c0" stroke-width="4" rx="8"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><polygon points="15,5 25,15 5,15" fill="#e6f3ff" stroke="#2196f3" stroke-width="1"/><polygon points="45,25 55,35 35,35" fill="#f0f8ff" stroke="#1976d2" stroke-width="1"/><rect x="12" y="12" width="36" height="16" fill="none" stroke="#1565c0" stroke-width="2" rx="4"/></svg>`
    }
  ],
  'Patterns': [
    {
      name: 'Polka Dots',
      category: 'Patterns',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="3" fill="#e2e8f0"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#dots)" opacity="0.5"/>
          <rect x="15" y="15" width="${width-30}" height="${height-30}" 
                fill="none" stroke="#4a5568" stroke-width="3" rx="8"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><circle cx="15" cy="15" r="2" fill="#e2e8f0"/><circle cx="35" cy="25" r="2" fill="#e2e8f0"/><circle cx="45" cy="15" r="2" fill="#e2e8f0"/><rect x="8" y="8" width="44" height="24" fill="none" stroke="#4a5568" stroke-width="2" rx="4"/></svg>`
    },
    {
      name: 'Chevron Pattern',
      category: 'Patterns',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="chevron" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 10 L 20 0 L 40 10 L 20 20 Z" fill="none" stroke="#cbd5e0" stroke-width="1"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#chevron)" opacity="0.3"/>
          <rect x="20" y="20" width="${width-40}" height="${height-40}" 
                fill="none" stroke="#2d3748" stroke-width="3" rx="5"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><path d="M 10 15 L 20 10 L 30 15 L 40 10 L 50 15" fill="none" stroke="#cbd5e0" stroke-width="1"/><rect x="10" y="10" width="40" height="20" fill="none" stroke="#2d3748" stroke-width="2" rx="3"/></svg>`
    },
    {
      name: 'Stripes',
      category: 'Patterns',
      svg: (width: number, height: number) => `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="stripes" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="10" height="20" fill="#f7fafc"/>
              <rect x="10" y="0" width="10" height="20" fill="#e2e8f0"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#stripes)" opacity="0.6"/>
          <rect x="18" y="18" width="${width-36}" height="${height-36}" 
                fill="none" stroke="#2d3748" stroke-width="3" rx="6"/>
        </svg>`,
      preview: `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="0" y="0" width="5" height="40" fill="#f7fafc"/><rect x="5" y="0" width="5" height="40" fill="#e2e8f0"/><rect x="10" y="0" width="5" height="40" fill="#f7fafc"/><rect x="50" y="0" width="5" height="40" fill="#e2e8f0"/><rect x="55" y="0" width="5" height="40" fill="#f7fafc"/><rect x="9" y="9" width="42" height="22" fill="none" stroke="#2d3748" stroke-width="2" rx="3"/></svg>`
    }
  ]
};

/**
 * Get all frame templates as a flat array
 */
export const getAllFrameTemplates = (): FrameTemplate[] => {
  return Object.values(FRAME_TEMPLATES).flat();
};

/**
 * Get frame templates by category
 */
export const getFrameTemplatesByCategory = (category: keyof typeof FRAME_CATEGORIES): FrameTemplate[] => {
  return FRAME_TEMPLATES[category] || [];
};

/**
 * Search frame templates by name
 */
export const searchFrameTemplates = (query: string): FrameTemplate[] => {
  const allTemplates = getAllFrameTemplates();
  return allTemplates.filter(template => 
    template.name.toLowerCase().includes(query.toLowerCase()) ||
    template.category.toLowerCase().includes(query.toLowerCase())
  );
}; 