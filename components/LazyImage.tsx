import React, { useState } from 'react';
import { Skeleton } from './Skeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Skeleton com mesmo espaço da imagem para evitar layout shift */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        aria-hidden
      >
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-contain transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
};
