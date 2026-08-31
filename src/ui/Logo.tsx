export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none" aria-label="PlayRook">
      <span className="size-7.5 grid place-items-center rounded-md border border-[#edd493]/50 bg-gradient-to-b from-[#f3dfa7] via-primary to-[#caa353] text-primary-foreground font-heading font-bold text-base leading-none shadow-xs">
        ش
      </span>
      <strong className="font-heading text-base font-semibold tracking-tight text-foreground">
        PlayRook
      </strong>
    </div>
  );
}
