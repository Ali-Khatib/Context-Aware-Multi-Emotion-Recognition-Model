export function AmbientBlobs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-purple-600/25 blur-[100px]" />
      <div className="absolute right-[-120px] top-1/4 h-[480px] w-[480px] rounded-full bg-fuchsia-600/20 blur-[110px]" />
      <div className="absolute bottom-[-80px] left-1/3 h-[380px] w-[380px] rounded-full bg-violet-700/22 blur-[95px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-purple-500/18 blur-[80px]" />
      <div className="absolute left-1/2 top-[60%] h-[260px] w-[260px] -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-[90px]" />
    </div>
  )
}
