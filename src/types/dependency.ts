import type { Position } from './task'

export type RelationType = 'FS' | 'SS' | 'FF' | 'SF'
export type ReasonType = 'technical' | 'crew' | 'logistics' | 'scaffold' | 'safety' | 'other'
export type DependencyStatus = 'draft' | 'confirmed'

export interface DependencyBasis {
  why: string
  roomFactors?: Record<string, {
    areaSqm?: number
    heightM?: number
    volumeCbm?: number
  }>
  scaffoldRequired?: boolean
  travelTimeHours?: number
  constraints?: string[]
}

export interface Dependency {
  id: string
  predecessorTaskId: string
  successorTaskId: string
  relationType: RelationType
  lag: number

  reasonType: ReasonType
  basis: DependencyBasis

  status: DependencyStatus
  note?: string
  waypoints?: Position[]
  color?: string
}

export function createDependency(
  partial: Partial<Dependency> & {
    id: string
    predecessorTaskId: string
    successorTaskId: string
  }
): Dependency {
  return {
    relationType: 'FS',
    lag: 0,
    reasonType: 'other',
    basis: { why: '' },
    status: 'draft',
    ...partial,
  }
}
