const FIXED_STAGE_WIDTH = 1920
const FIXED_STAGE_HEIGHT = 1080

let initialized = false

export function updateFixedStageScale(): void {
  const scale = Math.min(
    window.innerWidth / FIXED_STAGE_WIDTH,
    window.innerHeight / FIXED_STAGE_HEIGHT,
  )
  document.documentElement.style.setProperty('--game-stage-scale', String(scale))
}

export function initializeFixedStageScaling(): void {
  if (initialized) return
  initialized = true
  document.body.classList.add('fixed-stage-active')
  window.addEventListener('resize', updateFixedStageScale, { passive: true })
  updateFixedStageScale()
}
