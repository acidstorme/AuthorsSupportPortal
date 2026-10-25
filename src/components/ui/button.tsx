import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground shadow-[0_3px_0_0_#8f253c,0_6px_14px_-7px_#b9345066] hover:bg-[#a42b45] hover:border-[#a42b45] active:translate-y-px active:shadow-none",
        outline: "border border-input bg-white text-foreground shadow-sm hover:border-primary/40 hover:bg-muted hover:text-primary active:bg-[#f7e2e7]",
      },
      size: { default: "min-h-11 px-5 py-2.5", sm: "min-h-10 px-3 py-2" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
