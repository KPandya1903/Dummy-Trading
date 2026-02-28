import { useEffect, useRef, useState } from 'react';
import { Typography, TypographyProps } from '@mui/material';

interface AnimatedNumberProps extends Omit<TypographyProps, 'children'> {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  colorOnChange?: boolean;
}

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  duration = 600,
  colorOnChange = true,
  ...typographyProps
}: AnimatedNumberProps) {
  const prevValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null);
  const animationFrame = useRef<number>();

  useEffect(() => {
    if (prevValue.current === value) return;

    const direction = value > prevValue.current ? 'up' : 'down';
    setChangeDirection(direction);

    const start = prevValue.current;
    const diff = value - start;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + diff * eased);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        setTimeout(() => setChangeDirection(null), 400);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);
    prevValue.current = value;

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [value, duration]);

  const formatted = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const flashColor =
    colorOnChange && changeDirection
      ? changeDirection === 'up'
        ? 'success.main'
        : 'error.main'
      : undefined;

  return (
    <Typography
      {...typographyProps}
      sx={{
        ...((typographyProps.sx as object) ?? {}),
        transition: 'color 0.3s ease',
        ...(flashColor && { color: flashColor }),
      }}
    >
      {prefix}{formatted}{suffix}
    </Typography>
  );
}
