import React from 'react';

export interface SkeletonProps {
  /** Classes adicionais; use para tamanho fixo (ex: w-10 h-10) e evitar layout shift */
  className?: string;
  /** Largura fixa (evita layout shift) */
  width?: number | string;
  /** Altura fixa (evita layout shift) */
  height?: number | string;
  /** Estilo inline para dimensões */
  style?: React.CSSProperties;
}

/**
 * Skeleton com shimmer sutil. Use width/height ou className com tamanho fixo
 * para reservar espaço e evitar layout shift quando o conteúdo carregar.
 * A animação skeleton-shimmer é definida em index.html.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  style = {},
}) => {
  const sizeStyle: React.CSSProperties = {};
  if (width !== undefined) sizeStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) sizeStyle.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      role="presentation"
      aria-hidden
      className={`skeleton-shimmer rounded-md bg-gray-100 overflow-hidden ${className}`}
      style={{ ...sizeStyle, ...style }}
    />
  );
};

/** Skeleton para linha de texto (1 linha). Altura fixa evita layout shift. */
export const SkeletonText: React.FC<{ className?: string; width?: string | number }> = ({
  className = '',
  width = '100%',
}) => (
  <Skeleton
    className={`inline-block align-middle ${className}`}
    height={16}
    width={width}
  />
);

/** Skeleton para ícone (quadrado). Use o mesmo tamanho do ícone que substitui. */
export const SkeletonIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <Skeleton
    className={`flex-shrink-0 rounded ${className}`}
    width={size}
    height={size}
  />
);

/** Skeleton para imagem/thumbnail. Use as mesmas dimensões do container da imagem. */
export const SkeletonImage: React.FC<{ className?: string; width?: number | string; height?: number | string }> = ({
  className = '',
  width,
  height,
}) => (
  <Skeleton
    className={className}
    width={width}
    height={height}
  />
);
