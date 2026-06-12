import { QuartzComponent, QuartzComponentConstructor } from "./types"

const dsn = process.env.VITE_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? ""
const environment = process.env.VITE_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production"
const release =
  process.env.VITE_DEADROT_RELEASE ?? process.env.NEXT_PUBLIC_DEADROT_RELEASE ?? process.env.SENTRY_RELEASE
const tracesSampleRate = process.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
const replayErrorSampleRate = process.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE ?? "1"
const replaySessionSampleRate = process.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? "0"

const Sentry: QuartzComponent = () => null

Sentry.afterDOMLoaded = dsn
  ? `
const sentryScript = document.createElement("script")
sentryScript.src = "https://browser.sentry-cdn.com/10.57.0/bundle.tracing.replay.min.js"
sentryScript.crossOrigin = "anonymous"
sentryScript.onload = () => {
  if (!window.Sentry) return
  window.Sentry.init({
    dsn: ${JSON.stringify(dsn)},
    environment: ${JSON.stringify(environment)},
    release: ${JSON.stringify(release)},
    sendDefaultPii: false,
    tracesSampleRate: Number(${JSON.stringify(tracesSampleRate)}),
    replaysOnErrorSampleRate: Number(${JSON.stringify(replayErrorSampleRate)}),
    replaysSessionSampleRate: Number(${JSON.stringify(replaySessionSampleRate)}),
  })
}
document.head.appendChild(sentryScript)
`
  : undefined

export default (() => Sentry) satisfies QuartzComponentConstructor
