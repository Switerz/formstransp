export function PageLoading({ label = "Carregando dados..." }: { label?: string }) {
  return (
    <main className="shell">
      <div className="loading-block">
        <div className="loading-bar" />
        <div className="loading-line wide" />
        <div className="loading-line" />
        <div className="loading-line short" />
        <span>{label}</span>
      </div>
    </main>
  );
}
