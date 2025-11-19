'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-6 w-full overflow-hidden rounded-full border-2 border-violet-400/60 bg-gray-200 dark:bg-gray-700 shadow-inner shadow-black/20',
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full flex-1 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-[0_0_20px_rgba(168,85,247,0.8)] transition-transform duration-500 ease-out relative"
      style={{ 
        transform: `translateX(-${100 - (value || 0)}%)`,
        width: '100%'
      }}
    >
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" 
           style={{ 
             backgroundSize: '200% 100%',
             animation: 'shimmer 2s infinite'
           }} 
      />
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
