export function AdPlaceholder({ label = "Advertisement" }: { label?: string }) {
  return (
    <div className="ad-placeholder mx-auto my-8 flex h-20 w-full max-w-[520px] items-center justify-center rounded-lg text-xs tracking-[1.5px] uppercase">
      {label} • Demo Placeholder
    </div>
  );
}
