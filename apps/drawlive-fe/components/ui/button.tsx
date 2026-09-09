// components/Button.tsx
"use client";

import { ButtonHTMLAttributes, ReactNode, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md cursor-pointer font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      color: {
        black: "bg-black text-white hover:bg-neutral-800 focus-visible:ring-black",
        white: "bg-white text-black border border-neutral-300 hover:bg-neutral-100 focus-visible:ring-neutral-400",
      },
      size: {
        small: "h-8 px-3 text-sm",
        medium: "h-10 px-4 text-base",
        large: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      color: "black",
      size: "medium",
    },
  }
);

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "color">,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  loadingText?: string;
}

export default function Button({
  children,
  className = "",
  onClick,
  loadingText,
  disabled,
  color,
  size,
  ...rest
}: ButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!onClick || loading) return;
    try {
      setLoading(true);
      await onClick();
    } catch {
      // Individual button actions present their own user-facing failures.
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={buttonVariants({ color, size, className })}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
