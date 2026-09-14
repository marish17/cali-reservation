/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Esportazione statica: il sito diventa un pacchetto di file serviti
  // così come sono, senza un processo acceso a generarli. Tutti i dati
  // arrivano da Supabase dal browser, quindi non c'è niente che debba
  // girare sul server.
  output: "export",
  // I file statici vogliono la barra finale, altrimenti /privacy non
  // trova /privacy/index.html.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
