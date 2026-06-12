export type Rect = [number, number, number, number] // x0,y0,x1,y1 PDF points, top-left origin
export type Point = [number, number]

export interface DocumentInfo {
  id: string
  name: string
  page_count: number
  current_version: number
  created_at: string
  folder_id?: string | null
}

export interface VersionInfo {
  number: number
  created_at: string
  ops_summary: string[]
}

export interface DocumentDetail extends DocumentInfo {
  versions: VersionInfo[]
  max_version: number
}

export interface ReplFont {
  family: string
  label: string
  css: string
  bold: boolean
  italic: boolean
  embedded_available: boolean
}

export interface Span {
  id: string
  text: string
  bbox: Rect
  font: string
  size: number
  color: string
  flags: number
  origin: Point
  repl: ReplFont
}

export interface FontFamily {
  family: string
  label: string
  css: string
}

export interface ImageInfo {
  xref: number
  bbox: Rect
}

export interface Widget {
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'combobox' | 'listbox'
  value: string | boolean | null
  rect: Rect
  options: string[] | null
}

export interface PageLayout {
  width: number
  height: number
  rotation: number
  spans: Span[]
  images: ImageInfo[]
  widgets: Widget[]
}

export interface VersionState {
  current_version: number
  page_count: number
  max_version: number
}

export type Op =
  | { type: 'edit_text'; page: number; bbox: Rect; origin: Point; new_text: string; font: string; size: number; color: string; flags: number; new_bbox?: Rect; wrap?: boolean; orig_size?: number; repl_family?: string | null; bold?: boolean | null; italic?: boolean | null; underline?: boolean }
  | { type: 'insert_text'; page: number; bbox: Rect; text: string; size?: number; color?: string; font?: string; bold?: boolean | null; italic?: boolean | null; underline?: boolean }
  | { type: 'delete_text'; page: number; bbox: Rect }
  | { type: 'insert_image'; page: number; bbox: Rect; asset_id: string }
  | { type: 'delete_image'; page: number; bbox: Rect }
  | { type: 'move_image'; page: number; xref: number; old_bbox: Rect; new_bbox: Rect }
  | { type: 'page_add'; page: number }
  | { type: 'page_delete'; page: number }
  | { type: 'page_reorder'; order: number[] }
  | { type: 'page_rotate'; page: number; degrees?: number }
  | { type: 'fill_form'; page: number; field_name: string; value: string | boolean }
  | { type: 'place_signature'; page: number; bbox: Rect; asset_id: string }
  | { type: 'watermark'; text: string; pages?: number[] | null; opacity?: number; size?: number; color?: string; angle?: number }

export type Tool = 'select' | 'text' | 'addText' | 'image' | 'signature' | 'forms'

export interface User {
  id: number
  username: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  created_at?: string
}
