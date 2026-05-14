'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'solid', className, ...rest },
  ref,
) {
  const cls = [styles.btn, variant === 'ghost' && styles.ghost, className].filter(Boolean).join(' ');
  return <button ref={ref} className={cls} {...rest} />;
});
