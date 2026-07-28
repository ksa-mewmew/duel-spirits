export type UpdateCheckResult =
  | { status: 'up-to-date'; currentVersion: string }
  | {
      status: 'available'
      currentVersion: string
      latestVersion: string
      title: string
      notes: string
      publishedAt: string
      downloadPageUrl: string
    }
  | { status: 'unavailable'; currentVersion: string; reason: string }
