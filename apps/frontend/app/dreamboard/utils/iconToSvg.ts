import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Converts a React Icon component to an SVG string
 * @param IconComponent The React Icon component
 * @param props Props to pass to the icon (size, color, etc.)
 * @returns SVG string
 */
export const iconToSvg = (
  IconComponent: React.ComponentType<any>, 
  props: { size?: number; color?: string; [key: string]: any } = {}
): string => {
  const { size = 64, color = '#000000', ...otherProps } = props;
  
  try {
    // Create the React element
    const iconElement = React.createElement(IconComponent, {
      size,
      color,
      ...otherProps,
    });

    // Render to static markup
    const markup = renderToStaticMarkup(iconElement);
    
    // If it's already an SVG, return it directly
    if (markup.startsWith('<svg')) {
      return markup;
    }
    
    // Otherwise, wrap it in an SVG
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      ${markup}
    </svg>`;
  } catch (error) {
    console.error('Error converting icon to SVG:', error);
    // Return a fallback SVG
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}"/>
    </svg>`;
  }
};

/**
 * Creates a data URL from an SVG string
 * @param svgString The SVG string
 * @returns Data URL string
 */
export const svgToDataUrl = (svgString: string): string => {
  try {
    const base64 = btoa(unescape(encodeURIComponent(svgString)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.error('Error creating data URL:', error);
    return '';
  }
};

/**
 * Alternative method for client-side icon to SVG conversion
 * This method works better in browser environments
 */
export const iconToSvgClient = (
  IconComponent: React.ComponentType<any>,
  props: { size?: number; color?: string; [key: string]: any } = {}
): Promise<string> => {
  const { size = 64, color = '#000000', ...otherProps } = props;
  
  return new Promise((resolve) => {
    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Import ReactDOM dynamically for client-side rendering
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(container);
        
        const iconElement = React.createElement(IconComponent, {
          size,
          color,
          ...otherProps,
        });

        root.render(iconElement);

        // Wait a bit for rendering to complete
        setTimeout(() => {
          const svgElement = container.querySelector('svg');
          if (svgElement) {
            // Clone the SVG to avoid issues with the original
            const clonedSvg = svgElement.cloneNode(true) as SVGElement;
            
            // Ensure proper attributes are set
            clonedSvg.setAttribute('width', size.toString());
            clonedSvg.setAttribute('height', size.toString());
            
            // Get the outer HTML
            const svgString = clonedSvg.outerHTML;
            
            // Clean up
            root.unmount();
            document.body.removeChild(container);
            
            resolve(svgString);
          } else {
            // Fallback if no SVG found
            const fallbackSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" fill="${color}"/>
            </svg>`;
            
            // Clean up
            root.unmount();
            document.body.removeChild(container);
            
            resolve(fallbackSvg);
          }
        }, 100);
      }).catch((error) => {
        console.error('Error loading ReactDOM:', error);
        document.body.removeChild(container);
        
        // Return fallback
        const fallbackSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="${color}"/>
        </svg>`;
        resolve(fallbackSvg);
      });
    } catch (error) {
      console.error('Error in iconToSvgClient:', error);
      
      // Return fallback
      const fallbackSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" fill="${color}"/>
      </svg>`;
      resolve(fallbackSvg);
    }
  });
};

/**
 * Icon library collections for easy organization
 */
export const ICON_LIBRARIES = {
  'Font Awesome': 'fa',
  'Heroicons': 'hi',
  'Lucide': 'lu',
  'Material Design': 'md',
  'Tabler': 'tb',
  'Bootstrap': 'bs',
  'Feather': 'fi',
} as const;

/**
 * Common icon categories
 */
export const ICON_CATEGORIES = {
  'Popular': ['heart', 'star', 'home', 'user', 'settings'],
  'Business': ['briefcase', 'chart', 'graph', 'money', 'target'],
  'Communication': ['mail', 'phone', 'message', 'chat', 'bell'],
  'Navigation': ['arrow', 'chevron', 'menu', 'close', 'search'],
  'Media': ['play', 'pause', 'stop', 'volume', 'camera'],
  'Weather': ['sun', 'cloud', 'rain', 'snow', 'lightning'],
  'Animals': ['cat', 'dog', 'bird', 'fish', 'butterfly'],
  'Food': ['apple', 'coffee', 'pizza', 'cake', 'ice-cream'],
  'Transportation': ['car', 'bike', 'plane', 'train', 'ship'],
  'Technology': ['computer', 'phone', 'wifi', 'database', 'code'],
} as const; 