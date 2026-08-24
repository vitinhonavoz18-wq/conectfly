export default function Loading() {
  return (
    <div className="container-page py-20">
      <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full w-1/3 animate-[marquee_1.1s_linear_infinite] rounded-full bg-neon-500" />
      </div>
      <p className="mt-5 text-center text-xs uppercase tracking-[0.24em] text-smoke-400">
        Carregando
      </p>
    </div>
  );
}
