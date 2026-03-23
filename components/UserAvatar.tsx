import React from 'react';
import { CURRENT_USER_AVATAR_SRC } from '../constants';

const SIZE_CLASS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
};

export const UserAvatar: React.FC<{
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  alt?: string;
}> = ({ size = 'md', className = '', alt = '' }) => (
  <div
    className={`${SIZE_CLASS[size]} rounded-full overflow-hidden shrink-0 border border-black/[0.06] bg-neutral-100 ${className}`}
  >
    <img src={CURRENT_USER_AVATAR_SRC} alt={alt} className="h-full w-full object-cover" />
  </div>
);
