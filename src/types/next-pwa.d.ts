declare module "next-pwa" {
  import type { NextConfig } from "next"

  interface RuntimeCachingRule {
    urlPattern: RegExp | string | ((context: { url: URL; request: Request }) => boolean)
    handler: string
    method?: string
    options?: Record<string, unknown>
  }

  interface PWAConfig {
    dest: string
    register?: boolean
    skipWaiting?: boolean
    disable?: boolean
    runtimeCaching?: RuntimeCachingRule[]
    customWorkerDir?: string
  }

  export default function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig
}
