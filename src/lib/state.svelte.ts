export type View = 'blend' | 'ground' | 'register'
export type Path = 'all' | 'Enlil' | 'Anu' | 'Ea'
export interface CatalogueStar {
  raDeg: number | null
  decDeg: number | null
  mag?: number | null
  hip?: number
  gaiaDr2Id?: string
  [key: string]: unknown
}
export interface AtlasState {
  view: View
  center: 'ncp' | 'polaris' | 'thuban' | 'kochab'
  poleChoice: 'ncp' | 'polaris' | 'thuban' | 'kochab' | 'custom'
  magnitudeLimit: number
  wheelRotation: number
  wheelOpacity: number
  wheelLayer: boolean
  catalogueLayer: boolean
  path: Path
  month: number
  search: string
  selected: string | null
  selectedStar: CatalogueStar | null
  labels: boolean
  rotation: number
  background: boolean
  grid: boolean
  references: boolean
  poleInset: boolean
  observer: {
    enabled: boolean
    latitude: number
    longitude: number
    year: number
    era: 'bce' | 'ce'
    calendarDay: number
    period: 'morning' | 'evening'
    twilight: number
    timing: 'solar' | 'culmination'
    targetKey: string
  }
}
// Application-lifetime state shared by controls, pages and the renderer.
export const atlas: AtlasState = $state({
  view: 'blend', center: 'ncp', poleChoice: 'ncp', magnitudeLimit: 6.5,
  wheelRotation: 0, wheelOpacity: 0.75, wheelLayer: true, catalogueLayer: true,
  path: 'all', month: 0, search: '', selected: null, selectedStar: null,
  labels: true, rotation: 0, background: true, grid: true, references: true,
  poleInset: false,
  observer: {
    enabled: true, latitude: 32.54, longitude: 44.42, year: 1200, era: 'bce',
    calendarDay: 90, period: 'morning', twilight: -9, timing: 'solar', targetKey: '',
  },
})
export const pages: { page: string; view: View; label: string }[] = [
  { page: 'atlas', view: 'blend', label: 'Atlas' },
  { page: 'ground-sky', view: 'ground', label: 'Ground sky' },
  { page: 'register', view: 'register', label: 'Register' },
]
export const months = [
  'Nisannu / Nisan', 'Ayyāru / Iyyar', 'Simānu / Sivan', 'Duʾūzu / Tammuz',
  'Abu / Av', 'Ulūlu / Elul', 'Tašrītu / Tishrei', 'Araḫsamna / Cheshvan',
  'Kislimu / Kislev', 'Ṭebētu / Tevet', 'Šabāṭu / Shevat', 'Addaru / Adar',
]
