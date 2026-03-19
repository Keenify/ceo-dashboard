import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ModuleCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  borderColor: string;
  iconColor: string;
  completed?: boolean | null; // null means status not applicable or loading
  disabled?: boolean; // for unpurchased modules
  compact?: boolean; // for smaller card variant
  listView?: boolean; // for list view variant
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  href,
  title,
  description,
  icon: Icon,
  borderColor,
  iconColor,
  completed,
  disabled = false,
  compact = false,
  listView = false,
}) => {
  const hoverRingClass = ''; // Removed ring effect
  
  // List View - Card with tooltip description
  if (listView) {
    const listCardContent = (
      <div
        className={`group relative rounded-xl border-2 bg-card p-6 shadow-sm transition-all duration-300 h-full z-0 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed border-muted-foreground/20' 
            : `hover:shadow-xl ${borderColor} ${hoverRingClass} hover:scale-105`
        }`}
      >
        {/* Content - Icon and Title centered */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <div className="flex items-center justify-center mb-3">
            <Icon className={`h-8 w-8 ${disabled ? 'text-muted-foreground/50' : iconColor}`} />
          </div>
          <h3 className={`text-lg font-semibold text-center ${disabled ? 'text-muted-foreground' : ''}`}>
            {title}
          </h3>
          {!disabled && completed === true && (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-2" aria-label="Completed" />
          )}
          {!disabled && completed === false && (
            <AlertCircle className="h-5 w-5 text-orange-500 mt-2" aria-label="Pending" />
          )}
        </div>

        {/* Status indicators for disabled state */}
        {disabled && (
          <div className="absolute bottom-2 left-2 right-2">
            <span className="text-muted-foreground/70 font-medium text-sm block text-center">
              Purchase to access
            </span>
          </div>
        )}
      </div>
    );

    if (disabled) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="block">{listCardContent}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href} className="block">
              {listCardContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Compact View - Enhanced with tooltip
  if (compact) {
    const compactCardContent = (
      <div
        className={`group relative rounded-lg border-2 bg-card p-4 shadow-sm transition-all duration-300 h-full z-0 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed border-muted-foreground/20' 
            : `hover:shadow-lg ${borderColor} ${hoverRingClass} hover:scale-105`
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center min-w-0 flex-1 z-0">
              <Icon className={`mr-2 h-5 w-5 flex-shrink-0 ${disabled ? 'text-muted-foreground/50' : iconColor}`} />
              <h3 className={`text-base font-semibold truncate ${disabled ? 'text-muted-foreground' : ''}`}>
                {title}
              </h3>
            </div>
            {!disabled && completed === true && (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 ml-1" aria-label="Completed" />
            )}
            {!disabled && completed === false && (
              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 ml-1" aria-label="Pending" />
            )}
          </div>
          
          {!disabled && completed === false && (
            <span className="text-orange-600 dark:text-orange-400 font-medium text-sm block mt-1">Action needed!</span>
          )}
          {disabled && (
            <span className="text-muted-foreground/70 font-medium text-sm block mt-1">Purchase to access</span>
          )}
        </div>
      </div>
    );

    if (disabled) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="block">{compactCardContent}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href} className="block">
              {compactCardContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Full View - Enhanced with tooltip
  const cardContent = (
    <div
      className={`group relative rounded-xl border-2 bg-card p-6 shadow-sm transition-all duration-300 h-full z-0 ${
        disabled 
          ? 'opacity-50 cursor-not-allowed border-muted-foreground/20' 
          : `hover:shadow-xl ${borderColor} ${hoverRingClass} hover:scale-105`
      }`}
    >
      {/* Content - Icon and Title centered */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
        <div className="flex items-center justify-center mb-4">
          <Icon className={`h-8 w-8 ${disabled ? 'text-muted-foreground/50' : iconColor}`} />
        </div>
        
        <h2 className={`text-xl font-semibold mb-2 ${disabled ? 'text-muted-foreground' : ''}`}>
          {title}
        </h2>
        
        {/* Status indicators */}
        <div className="mb-4">
          {!disabled && completed === true && (
            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" aria-label="Completed" />
          )}
          {!disabled && completed === false && (
            <AlertCircle className="h-5 w-5 text-orange-500 mx-auto" aria-label="Pending" />
          )}
        </div>
        
        {!disabled && completed === false && (
          <span className="text-orange-600 dark:text-orange-400 font-medium block">Action needed today!</span>
        )}
        {disabled && (
          <span className="text-muted-foreground/70 font-medium block">Purchase to access</span>
        )}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="block">{cardContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} className="block">
            {cardContent}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 